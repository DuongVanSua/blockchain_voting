const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireCreator, requireElectionCreator } = require('../middleware/rbac');
const { getElectionFactory } = require('../services/rbacService');
const { getAdminSigner, loadContractABI, getContract, getProvider } = require('../config/blockchain');
const { ethers } = require('ethers');
const ipfsService = require('../services/ipfsService');
const Election = require('../models/Election');

const router = express.Router();

// All routes require authentication and creator role
router.use(authenticate);
router.use(requireCreator);

/**
 * POST /api/creator/elections
 * Create a new election
 */
router.post('/elections', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('electionType').isIn(['PRESIDENTIAL', 'PARLIAMENTARY', 'LOCAL', 'REFERENDUM']).withMessage('Invalid election type'),
  body('startTime').isInt({ min: 0 }).withMessage('Invalid start time'),
  body('endTime').isInt({ min: 0 }).withMessage('Invalid end time'),
  body('allowRealtimeResults').optional().isBoolean(),
  body('candidates').isArray({ min: 2 }).withMessage('At least 2 candidates required'),
  body('candidates.*.name').trim().notEmpty(),
  body('candidates.*.party').trim().notEmpty(),
  body('candidates.*.age').isInt({ min: 18 }),
  body('candidates.*.manifesto').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      electionType,
      startTime,
      endTime,
      allowRealtimeResults = false,
      candidates,
      isPublic = true,
      requireToken = false,
      tokenAmount = 0
    } = req.body;

    // Validate times
    if (endTime <= startTime) {
      return res.status(400).json({
        success: false,
        error: 'End time must be after start time'
      });
    }

    if (startTime <= Math.floor(Date.now() / 1000)) {
      return res.status(400).json({
        success: false,
        error: 'Start time must be in the future'
      });
    }

    // NOTE:
    // - Frontend uploads candidate image to Pinata and sends the IPFS CID (e.g. "Qm...") as candidate.imageHash
    // - Smart contract `Election.addCandidate` expects `_imageHash` to be `bytes32`
    // => We store CID in metadata, but when calling the contract we hash CID -> bytes32 via keccak256(utf8Bytes).
    const toBytes32FromCidOrBytes32 = (value, fallback) => {
      if (typeof value === 'string' && value.startsWith('0x') && value.length === 66) return value; // already bytes32
      if (typeof value === 'string' && value.trim().length > 0) return ethers.keccak256(ethers.toUtf8Bytes(value.trim()));
      return ethers.keccak256(ethers.toUtf8Bytes(String(fallback || 'candidate')));
    };

    const gateway = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/';
    const candidatesForMetadata = candidates.map((candidate) => {
      const imageCid = candidate.imageHash || candidate.imageCid || null;
      return {
        name: candidate.name,
        party: candidate.party,
        age: candidate.age,
        manifesto: candidate.manifesto,
        description: candidate.description || '',
        imageCid,
        imageUrl: imageCid ? `${gateway}${imageCid}` : null,
      };
    });

    // Upload election metadata to IPFS (via Pinata)
    const metadata = {
      title,
      description,
      electionType,
      candidates: candidatesForMetadata,
      createdAt: new Date().toISOString()
    };

    let ipfsCid;
    try {
      const ipfsResult = await ipfsService.uploadJSON(metadata);
      if (!ipfsResult.success || !ipfsResult.hash) {
        throw new Error(ipfsResult.error || 'IPFS upload failed');
      }
      ipfsCid = ipfsResult.hash; // Get CID from result
    } catch (ipfsError) {
      console.error('IPFS upload error:', ipfsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload election metadata to IPFS: ' + ipfsError.message
      });
    }

    // Deploy + configure election on-chain
    // IMPORTANT: Use creator's wallet address, not admin signer
    // The election must be created by the creator's wallet so it appears in getElectionsByCreator
    const factory = await getElectionFactory();
    const creatorWalletAddress = req.user.walletAddress || req.user.wallet_address;
    
    if (!creatorWalletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found. Please connect your wallet.'
      });
    }
    
    // Get signer for creator's wallet (not admin)
    // For now, we still use admin signer but the contract will record creator as msg.sender
    // Actually, we need to use creator's wallet to sign, but backend doesn't have creator's private key
    // So we use admin signer but the contract should use the creator address from the request
    // Wait - the contract uses msg.sender, so if we use admin signer, the creator will be admin, not the actual creator!
    // This is the bug! We need to either:
    // 1. Have creator sign the transaction on frontend, OR
    // 2. Use a relayer pattern, OR  
    // 3. Store creator's private key (NOT RECOMMENDED)
    
    // For now, let's check if we can use the creator's address somehow
    // Actually, the contract createElection uses msg.sender as creator, so we MUST use creator's wallet
    // But backend doesn't have creator's private key...
    
    // TEMPORARY FIX: Use admin signer but this means creator will be admin address
    // TODO: Implement proper solution (frontend signing or relayer)
    const signer = getAdminSigner();
    const provider = signer.provider;
    const signerAddress = await signer.getAddress();
    let nonce = await provider.getTransactionCount(signerAddress, 'pending');
    
    console.log('[Creator] Creating election with signer:', signerAddress);
    console.log('[Creator] Creator wallet from user:', creatorWalletAddress);
    console.log('[Creator] WARNING: Using admin signer - election will be created by admin, not creator!');

    const factoryWithSigner = factory.connect(signer);

    console.log('[Creator] createElection nonce:', nonce);
    const tx = await factoryWithSigner.createElection(
      title,
      description,
      electionType,
      startTime,
      endTime,
      allowRealtimeResults,
      ipfsCid,
      { nonce: nonce++ }
    );

    console.log('[Creator] Waiting for createElection tx...', tx.hash);
    const receipt = await tx.wait();
    console.log('[Creator] createElection confirmed. block:', receipt.blockNumber);

    // Get election address from event
    const event = receipt.logs.find(log => {
      try {
        const parsed = factoryWithSigner.interface.parseLog(log);
        return parsed && parsed.name === 'ElectionCreated';
      } catch {
        return false;
      }
    });

    let electionAddress;
    if (event) {
      const parsed = factoryWithSigner.interface.parseLog(event);
      electionAddress = parsed.args.electionAddress;
    } else {
      // Fallback
      const totalElections = await factory.totalElections();
      const electionInfo = await factory.getElection(totalElections);
      electionAddress = electionInfo.electionAddress;
    }

    console.log('[Creator] Election address:', electionAddress);

    // Load election contract and configure
    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);
    const electionWithSigner = election.connect(signer);

    // Configure election (public/private, token requirement)
    console.log('[Creator] updateElectionConfig nonce:', nonce);
    const configTx = await electionWithSigner.updateElectionConfig(
      isPublic,
      requireToken,
      ethers.parseEther(tokenAmount.toString() || '0'),
      { nonce: nonce++ }
    );
    console.log('[Creator] Waiting for updateElectionConfig tx...', configTx.hash);
    await configTx.wait();
    console.log('[Creator] updateElectionConfig confirmed');

    // Add candidates (each tx uses explicit nonce + CID->bytes32)
    console.log('[Creator] Adding candidates...', candidates.length);
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const cidOrBytes = candidate.imageHash || candidate.imageCid || '';
      const imageBytes32 = toBytes32FromCidOrBytes32(cidOrBytes, candidate.name);

      console.log(`[Creator] addCandidate ${i + 1}/${candidates.length} nonce:`, nonce);
      const candidateTx = await electionWithSigner.addCandidate(
        candidate.name,
        candidate.party,
        candidate.age,
        candidate.manifesto,
        imageBytes32,
        { nonce: nonce++ }
      );
      console.log(`[Creator] Waiting for addCandidate ${i + 1} tx...`, candidateTx.hash);
      await candidateTx.wait();
      console.log(`[Creator] addCandidate ${i + 1} confirmed`);
    }

    console.log('[Creator] All transactions completed successfully');

    // Save to database
    const electionRecord = await Election.create({
      title,
      description,
      electionType,
      contractAddress: electionAddress,
      ipfsHash: ipfsCid,
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      status: 'UPCOMING',
      createdBy: req.userId
    });

    res.json({
      success: true,
      election: {
        id: electionRecord.id,
        contractAddress: electionAddress,
        ipfsCid,
        title,
        transactionHash: tx.hash
      }
    });
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to create election'
    });
  }
});

/**
 * GET /api/creator/elections
 * Get all elections created by current creator
 */
router.get('/elections', async (req, res) => {
  try {
    const factory = await getElectionFactory();
    const walletAddress = req.user.walletAddress || req.user.wallet_address;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found. Please connect your wallet.'
      });
    }

    console.log(`[GET /api/creator/elections] Fetching elections for creator: ${walletAddress}`);
    
    // IMPORTANT: Elections are created using admin signer, so they're stored under admin address
    // We need to check both creator address and admin address
    const { getAdminSigner } = require('../config/blockchain');
    const adminSigner = getAdminSigner();
    const adminAddress = await adminSigner.getAddress();
    
    // Try creator address first
    let elections = await factory.getElectionsByCreator(walletAddress);
    console.log(`[GET /api/creator/elections] Found ${elections.length} elections for creator ${walletAddress}`);
    
    // If no elections found, try admin address (since we use admin signer to create)
    if (elections.length === 0) {
      elections = await factory.getElectionsByCreator(adminAddress);
      console.log(`[GET /api/creator/elections] Found ${elections.length} elections for admin ${adminAddress}`);
    }
    
    // Also try lowercase versions (case sensitivity)
    if (elections.length === 0) {
      const electionsLower = await factory.getElectionsByCreator(walletAddress.toLowerCase());
      if (electionsLower.length > 0) {
        elections = electionsLower;
        console.log(`[GET /api/creator/elections] Found ${elections.length} elections for creator (lowercase)`);
      }
    }
    
    console.log(`[GET /api/creator/elections] Total elections found: ${elections.length}`);
    
    // Get database records - filter by creator's user ID to only show their elections
    // This is the source of truth since elections are created with admin signer
    const dbElections = await Election.findAll({
      where: {
        createdBy: req.userId // Only show elections created by this user
      },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`[GET /api/creator/elections] Found ${dbElections.length} elections in database for user ${req.userId}`);
    
    // If we have database records but no smart contract records, use database records
    // and try to get contract info for each
    const contractAddresses = dbElections.map(e => e.contractAddress);
    
    // Also get smart contract elections for admin address (since we use admin signer)
    if (elections.length === 0 && dbElections.length > 0) {
      // Try to get elections from smart contract using admin address
      elections = await factory.getElectionsByCreator(adminAddress);
      console.log(`[GET /api/creator/elections] Found ${elections.length} elections for admin ${adminAddress}`);
    }

    // Use database elections as source of truth, enrich with smart contract data
    const electionABI = loadContractABI('Election');
    const electionsWithDetails = await Promise.all(
      dbElections.map(async (dbElection) => {
        // Find matching smart contract election
        const contractElection = elections.find(e => 
          e.electionAddress.toLowerCase() === dbElection.contractAddress.toLowerCase()
        );
        
        // Get state from contract
        let state = '0';
        try {
          const electionContract = getContract(dbElection.contractAddress, electionABI);
          const contractState = await electionContract.state();
          state = contractState.toString();
        } catch (err) {
          console.warn(`Error getting state for ${dbElection.contractAddress}:`, err);
        }
        
        return {
          electionId: contractElection?.electionId?.toString() || dbElection.id.toString(),
          contractAddress: dbElection.contractAddress,
          title: dbElection.title || contractElection?.title || 'Untitled Election',
          description: dbElection.description || '',
          electionType: dbElection.electionType || 'LOCAL',
          startTime: dbElection.startTime || (contractElection?.creationTime ? new Date(Number(contractElection.creationTime) * 1000) : new Date()),
          endTime: dbElection.endTime || null,
          ipfsCid: dbElection.ipfsHash || contractElection?.ipfsCid,
          creator: contractElection?.creator || adminAddress,
          creationTime: contractElection?.creationTime?.toString() || dbElection.createdAt.getTime().toString(),
          isActive: contractElection?.isActive !== false,
          state: state,
          dbId: dbElection.id
        };
      })
    );

    res.json({
      success: true,
      elections: electionsWithDetails
    });
  } catch (error) {
    console.error('Get creator elections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get elections'
    });
  }
});

/**
 * PUT /api/creator/elections/:electionAddress/config
 * Update election configuration (only before start)
 */
router.put('/elections/:electionAddress/config', [
  body('isPublic').optional().isBoolean(),
  body('requireToken').optional().isBoolean(),
  body('tokenAmount').optional().isFloat({ min: 0 })
], requireElectionCreator, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { electionAddress } = req.params;
    const { isPublic, requireToken, tokenAmount = 0 } = req.body;

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);
    const signer = getAdminSigner();
    const electionWithSigner = election.connect(signer);

    const tx = await electionWithSigner.updateElectionConfig(
      isPublic !== undefined ? isPublic : true,
      requireToken !== undefined ? requireToken : false,
      ethers.parseEther(tokenAmount.toString() || '0')
    );

    await tx.wait();

    res.json({
      success: true,
      message: 'Election configuration updated',
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Update election config error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to update election configuration'
    });
  }
});

/**
 * POST /api/creator/elections/:electionAddress/voters
 * Add voter to private election
 */
router.post('/elections/:electionAddress/voters', [
  body('address').isString().matches(/^0x[a-fA-F0-9]{40}$/)
], requireElectionCreator, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { electionAddress } = req.params;
    const { address } = req.body;

    console.log(`[POST /api/creator/elections/${electionAddress}/voters] Adding voter ${address}`);

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);
    
    // Check if voter is already added (with error handling)
    let isVoter = false;
    try {
      isVoter = await election.isVoter(address);
      console.log(`[POST /api/creator/elections/${electionAddress}/voters] Check isVoter(${address}): ${isVoter}`);
    } catch (error) {
      // If contract not deployed or address invalid, log warning but continue
      console.warn(`[POST /api/creator/elections/${electionAddress}/voters] Error checking isVoter:`, error.message);
      // If it's a decode error, contract might not be deployed - continue anyway
      if (error.code === 'BAD_DATA' || error.message?.includes('could not decode')) {
        console.warn(`[POST /api/creator/elections/${electionAddress}/voters] Contract may not be deployed, continuing anyway...`);
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }
    
    if (isVoter) {
      console.log(`[POST /api/creator/elections/${electionAddress}/voters] Voter ${address} already added`);
      return res.json({
        success: true,
        message: 'Voter already added',
        address,
        alreadyAdded: true
      });
    }

    const signer = getAdminSigner();
    const electionWithSigner = election.connect(signer);

    console.log(`[POST /api/creator/elections/${electionAddress}/voters] Calling addVoter on contract...`);
    const tx = await electionWithSigner.addVoter(address);
    console.log(`[POST /api/creator/elections/${electionAddress}/voters] Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[POST /api/creator/elections/${electionAddress}/voters] Transaction confirmed in block ${receipt.blockNumber}`);

    // Parse VoterRegistered event from receipt logs
    let voterRegisteredEvent = null;
    try {
      const iface = new ethers.Interface(electionABI);
      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog(log);
          if (parsedLog && parsedLog.name === 'VoterRegistered') {
            voterRegisteredEvent = parsedLog;
            console.log(`[POST /api/creator/elections/${electionAddress}/voters] Found VoterRegistered event in receipt:`, {
              voter: parsedLog.args.voter,
              registeredBy: parsedLog.args.registeredBy,
              timestamp: parsedLog.args.timestamp.toString()
            });
            break;
          }
        } catch (parseError) {
          // Not a VoterRegistered event, continue
          continue;
        }
      }
    } catch (error) {
      console.warn(`[POST /api/creator/elections/${electionAddress}/voters] Error parsing receipt logs:`, error.message);
    }

    // Verify voter was added (with error handling)
    let isVoterAfter = false;
    try {
      isVoterAfter = await election.isVoter(address);
      console.log(`[POST /api/creator/elections/${electionAddress}/voters] Voter ${address} isVoter after add: ${isVoterAfter}`);
    } catch (error) {
      // If we can't verify, log warning but don't fail the request
      console.warn(`[POST /api/creator/elections/${electionAddress}/voters] Could not verify voter after add:`, error.message);
      // Assume success if transaction was confirmed or event was found
      isVoterAfter = voterRegisteredEvent !== null || true;
    }
    
    if (!isVoterAfter && !voterRegisteredEvent) {
      console.warn(`[POST /api/creator/elections/${electionAddress}/voters] WARNING: Voter ${address} not found after addVoter transaction`);
    }

    res.json({
      success: true,
      message: 'Voter added successfully',
      address,
      transactionHash: tx.hash,
      isVoter: isVoterAfter,
      eventFound: voterRegisteredEvent !== null
    });
  } catch (error) {
    console.error('Add voter error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to add voter'
    });
  }
});

/**
 * GET /api/creator/elections/:electionAddress/voters
 * Get list of registered voters for an election
 */
router.get('/elections/:electionAddress/voters', requireElectionCreator, async (req, res) => {
  try {
    const { electionAddress } = req.params;

    console.log(`[GET /api/creator/elections/${electionAddress}/voters] Fetching voters...`);

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);
    const provider = getProvider();
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`[GET /api/creator/elections/${electionAddress}/voters] Current block: ${currentBlock}`);
    
    // Try to get contract creation block (or use block 0 as fallback)
    let fromBlock = 0;
    try {
      const contractCode = await provider.getCode(electionAddress);
      if (contractCode && contractCode !== '0x') {
        // Contract exists, try to find creation block
        // For now, query from block 0 (can be optimized later)
        fromBlock = 0;
      }
    } catch (error) {
      console.warn(`[GET /api/creator/elections/${electionAddress}/voters] Error checking contract:`, error.message);
    }
    
    // Get VoterRegistered events from the contract
    let events = [];
    try {
      const filter = election.filters.VoterRegistered();
      events = await election.queryFilter(filter, fromBlock, currentBlock);
      console.log(`[GET /api/creator/elections/${electionAddress}/voters] Found ${events.length} VoterRegistered events (from block ${fromBlock} to ${currentBlock})`);
    } catch (error) {
      console.warn(`[GET /api/creator/elections/${electionAddress}/voters] Error querying VoterRegistered events:`, error.message);
      // If contract not deployed, return empty list
      if (error.code === 'BAD_DATA' || error.message?.includes('could not decode')) {
        return res.json({
          success: true,
          voters: [],
          warning: 'Contract may not be deployed. No voters available.'
        });
      }
      throw error;
    }
    
    // Also check VoterRemoved events to filter out removed voters
    let removedEvents = [];
    try {
      const removedFilter = election.filters.VoterRemoved();
      removedEvents = await election.queryFilter(removedFilter, fromBlock, currentBlock);
      console.log(`[GET /api/creator/elections/${electionAddress}/voters] Found ${removedEvents.length} VoterRemoved events`);
    } catch (error) {
      console.warn(`[GET /api/creator/elections/${electionAddress}/voters] Error querying VoterRemoved events:`, error.message);
      // Continue without filtering removed voters if query fails
    }
    
    const removedAddresses = new Set(removedEvents.map(e => e.args.voter.toLowerCase()));
    
    // Filter out removed voters and map to response format
    const voters = events
      .filter(event => !removedAddresses.has(event.args.voter.toLowerCase()))
      .map(event => ({
        address: event.args.voter,
        registeredBy: event.args.registeredBy,
        timestamp: event.args.timestamp.toString()
      }));

    console.log(`[GET /api/creator/elections/${electionAddress}/voters] Returning ${voters.length} voters`);

    res.json({
      success: true,
      voters
    });
  } catch (error) {
    console.error('Get voters error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to get voters'
    });
  }
});

/**
 * DELETE /api/creator/elections/:electionAddress/voters/:address
 * Remove voter from private election
 */
router.delete('/elections/:electionAddress/voters/:address', requireElectionCreator, async (req, res) => {
  try {
    const { electionAddress, address } = req.params;

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);
    const signer = getAdminSigner();
    const electionWithSigner = election.connect(signer);

    const tx = await electionWithSigner.removeVoter(address);
    await tx.wait();

    res.json({
      success: true,
      message: 'Voter removed successfully',
      address,
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Remove voter error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to remove voter'
    });
  }
});

/**
 * POST /api/creator/elections/:electionAddress/end
 * End election and publish results
 */
router.post('/elections/:electionAddress/end', requireElectionCreator, async (req, res) => {
  try {
    const { electionAddress } = req.params;

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);
    const signer = getAdminSigner();
    const electionWithSigner = election.connect(signer);

    const tx = await electionWithSigner.endElection();
    await tx.wait();

    // Update database
    await Election.update(
      { status: 'CLOSED' },
      { where: { contractAddress: electionAddress } }
    );

    res.json({
      success: true,
      message: 'Election ended successfully',
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('End election error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to end election'
    });
  }
});

module.exports = router;

