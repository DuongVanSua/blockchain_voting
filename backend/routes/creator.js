const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const { requireCreator, requireElectionCreator } = require('../middleware/rbac');
const { getElectionFactory } = require('../services/rbacService');
const { getAdminSigner, loadContractABI, getContract, getProvider } = require('../config/blockchain');
const { ethers } = require('ethers');
const ipfsService = require('../services/ipfsService');
const Election = require('../models/Election');
const User = require('../models/User');
const ElectionVoter = require('../models/ElectionVoter');
const Candidate = require('../models/Candidate');

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
    const signerProvider = signer.provider;
    const signerAddress = await signer.getAddress();
    let nonce = await signerProvider.getTransactionCount(signerAddress, 'pending');
    
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

    // Verify contract was deployed by checking if it has code
    const contractProvider = getProvider();
    const contractCode = await contractProvider.getCode(electionAddress);
    if (contractCode === '0x' || contractCode === '0x0') {
      console.error('[Creator] ERROR: No contract code at address', electionAddress);
      return res.status(500).json({
        success: false,
        error: 'Election contract was not deployed successfully. Please try again.'
      });
    }
    console.log('[Creator] Verified contract code exists at address:', electionAddress);

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
    // Normalize contract address to lowercase for consistent querying
    const electionRecord = await Election.create({
      title,
      description,
      electionType,
      contractAddress: electionAddress.toLowerCase(),
      ipfsHash: ipfsCid,
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      status: 'ONGOING',
      createdBy: req.userId
    });
    
    console.log('[Creator] Saved election to database:', {
      id: electionRecord.id,
      contractAddress: electionRecord.contractAddress,
      title: electionRecord.title
    });

    // Save candidates to database
    try {
      const candidatesToSave = candidates.map((candidate, index) => {
        const imageCid = candidate.imageHash || candidate.imageCid || null;
        const gateway = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
        const imageUrl = imageCid ? `${gateway}${imageCid}` : null;
        
        return {
          electionId: electionRecord.id,
          candidateIndex: index,
          name: candidate.name,
          party: candidate.party,
          age: candidate.age,
          manifesto: candidate.manifesto,
          description: candidate.description || '',
          imageCid: imageCid,
          imageUrl: imageUrl,
          voteCount: 0 // Initial vote count
        };
      });

      await Candidate.bulkCreate(candidatesToSave);
      console.log(`[Creator] Saved ${candidatesToSave.length} candidates to database`);
    } catch (candidateError) {
      console.error('[Creator] Error saving candidates to database:', candidateError);
      // Don't fail the request - election was created successfully
    }

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
 * GET /api/creator/voters
 * Get all voters (users with role = 'VOTER') with optional search
 * Only returns voters with wallet_address (needed for election participation)
 * NOTE: This route must be defined BEFORE /elections/:electionAddress/voters to avoid route conflict
 */
router.get('/voters', async (req, res) => {
  try {
    const { search } = req.query;

    // Build where clause
    const whereConditions = [
      { role: 'VOTER' },
      {
        [Op.or]: [
          { walletAddress: { [Op.ne]: null } },
          { wallet_address: { [Op.ne]: null } }
        ]
      }
    ];

    // Add search condition if provided
    if (search) {
      whereConditions.push({
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ]
      });
    }

    const where = {
      [Op.and]: whereConditions
    };

    const voters = await User.findAll({
      attributes: ['id', 'name', 'email', 'walletAddress', 'wallet_address', 'role', 'createdAt'],
      where,
      order: [['createdAt', 'DESC']],
    });

    // Normalize wallet address field
    const normalizedVoters = voters.map(voter => ({
      id: voter.id,
      name: voter.name,
      email: voter.email,
      walletAddress: voter.walletAddress || voter.wallet_address,
      role: voter.role,
      createdAt: voter.createdAt
    }));

    res.json({
      success: true,
      voters: normalizedVoters
    });
  } catch (error) {
    console.error('Get voters error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get voters'
    });
  }
});

/**
 * GET /api/creator/elections
 * Get all elections created by current creator
 * IMPORTANT: Only returns elections where createdBy = req.userId (from database)
 */
router.get('/elections', async (req, res) => {
  try {
    console.log(`[GET /api/creator/elections] Fetching elections for creator user ID: ${req.userId}`);
    
    // CRITICAL: Only get elections from database where createdBy = req.userId
    // This ensures each creator only sees their own elections
    const dbElections = await Election.findAll({
      where: {
        createdBy: req.userId // Only show elections created by this user
      },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`[GET /api/creator/elections] Found ${dbElections.length} elections in database for user ${req.userId}`);
    
    if (dbElections.length === 0) {
      return res.json({
        success: true,
        elections: []
      });
    }

    // Enrich database elections with smart contract data (state, etc.)
    const electionABI = loadContractABI('Election');
    const electionsWithDetails = await Promise.all(
      dbElections.map(async (dbElection) => {
        // Get state and other info from contract
        let state = '0';
        let totalVotes = '0';
        let totalCandidates = '0';
        
        try {
          const electionContract = getContract(dbElection.contractAddress, electionABI);
          const [contractState, votes, candidates] = await Promise.all([
            electionContract.state().catch(() => '0'),
            electionContract.totalVotes().catch(() => '0'),
            electionContract.totalCandidates().catch(() => '0')
          ]);
          state = contractState.toString();
          totalVotes = votes.toString();
          totalCandidates = candidates.toString();
        } catch (err) {
          console.warn(`[GET /api/creator/elections] Error getting contract info for ${dbElection.contractAddress}:`, err.message);
        }
        
        return {
          electionId: dbElection.id.toString(),
          contractAddress: dbElection.contractAddress,
          title: dbElection.title || 'Untitled Election',
          description: dbElection.description || '',
          electionType: dbElection.electionType || 'LOCAL',
          startTime: dbElection.startTime,
          endTime: dbElection.endTime,
          ipfsCid: dbElection.ipfsHash,
          creator: dbElection.createdBy, // User ID who created this
          creationTime: dbElection.createdAt.getTime().toString(),
          isActive: true,
          state: state,
          totalVotes: totalVotes,
          totalCandidates: totalCandidates,
          dbId: dbElection.id
        };
      })
    );

    console.log(`[GET /api/creator/elections] Returning ${electionsWithDetails.length} elections for user ${req.userId}`);

    res.json({
      success: true,
      elections: electionsWithDetails
    });
  } catch (error) {
    console.error('[GET /api/creator/elections] Error:', error);
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
    
    // Even if voter is already in contract, we should still save to database
    // to ensure sync between contract and database
    if (isVoter) {
      console.log(`[POST /api/creator/elections/${electionAddress}/voters] Voter ${address} already in contract, but will still save to database to ensure sync`);
    }

    // NOTE: Contract addVoter() is now called from frontend via MetaMask
    // Backend only saves to database
    // This ensures the creator (chairperson) is the one calling the contract
    
    const normalizedAddress = address.toLowerCase();
    console.log(`[POST /api/creator/elections/${electionAddress}/voters] Saving voter to database: ${normalizedAddress}`);
    
    // Verify voter was added to contract (optional check - frontend already called it)
    // Wait a bit for state to sync
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let isVoterAfter = false;
    try {
      // Check with normalized address (lowercase)
      isVoterAfter = await election.isVoter(normalizedAddress);
      console.log(`[POST /api/creator/elections/${electionAddress}/voters] Voter ${normalizedAddress} isVoter in contract: ${isVoterAfter}`);
      
      // Also check with original address (in case contract stores it differently)
      if (!isVoterAfter) {
        const isVoterOriginal = await election.isVoter(address);
        console.log(`[POST /api/creator/elections/${electionAddress}/voters] Voter ${address} (original case) isVoter: ${isVoterOriginal}`);
        isVoterAfter = isVoterOriginal;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[POST /api/creator/elections/${electionAddress}/voters] Could not verify voter in contract:`, error.message);
      // Continue anyway - frontend already called the contract
      isVoterAfter = true; // Assume success since frontend called it
    }

    // Save to database for faster querying
    try {
      console.log(`[POST /api/creator/elections/${electionAddress}/voters] Looking for election in database with contractAddress: ${electionAddress.toLowerCase()}`);
      
      // Try both lowercase and original case
      const electionRecord = await Election.findOne({
        where: {
          [Op.or]: [
            { contractAddress: electionAddress.toLowerCase() },
            { contractAddress: electionAddress }
          ]
        }
      });

      if (electionRecord) {
        console.log(`[POST /api/creator/elections/${electionAddress}/voters] Found election: ID=${electionRecord.id}, contractAddress=${electionRecord.contractAddress}`);
        
        // Find user by wallet address
        const user = await User.findOne({
          where: {
            [Op.or]: [
              { walletAddress: address.toLowerCase() },
              { wallet_address: address.toLowerCase() }
            ]
          }
        });

        console.log(`[POST /api/creator/elections/${electionAddress}/voters] Found user:`, user ? { id: user.id, walletAddress: user.walletAddress || user.wallet_address } : 'null');

        const registeredByAddress = (req.user?.walletAddress || req.user?.wallet_address) || null;
        console.log(`[POST /api/creator/elections/${electionAddress}/voters] Registered by: ${registeredByAddress}`);

        // Find or create election voter record
        console.log(`[POST /api/creator/elections/${electionAddress}/voters] Attempting to find or create ElectionVoter:`, {
          electionId: electionRecord.id,
          userId: user?.id || null,
          voterAddress: normalizedAddress,
          registeredBy: registeredByAddress?.toLowerCase() || null,
          isActive: true
        });

        let electionVoter;
        let created = false;
        
        try {
          const result = await ElectionVoter.findOrCreate({
            where: {
              electionId: electionRecord.id,
              voterAddress: normalizedAddress
            },
            defaults: {
              electionId: electionRecord.id,
              userId: user?.id || null,
              voterAddress: normalizedAddress,
              registeredBy: registeredByAddress?.toLowerCase() || null,
              transactionHash: null, // Frontend handles the transaction
              isActive: true
            }
          });
          
          electionVoter = result[0];
          created = result[1];
          
          console.log(`[POST /api/creator/elections/${electionAddress}/voters] findOrCreate result:`, {
            wasCreated: created,
            electionVoterId: electionVoter?.id,
            electionId: electionVoter?.electionId,
            voterAddress: electionVoter?.voterAddress
          });
        } catch (findOrCreateError) {
          console.error(`[POST /api/creator/elections/${electionAddress}/voters] findOrCreate failed:`, {
            message: findOrCreateError.message,
            stack: findOrCreateError.stack,
            name: findOrCreateError.name
          });
          
          // If findOrCreate fails, try to create directly
          try {
            electionVoter = await ElectionVoter.create({
              electionId: electionRecord.id,
              userId: user?.id || null,
              voterAddress: normalizedAddress,
              registeredBy: registeredByAddress?.toLowerCase() || null,
              transactionHash: null,
              isActive: true
            });
            created = true;
            console.log(`[POST /api/creator/elections/${electionAddress}/voters] Created ElectionVoter directly after findOrCreate failed`);
          } catch (createError) {
            // If create also fails, check if it's a duplicate key error
            if (createError.name === 'SequelizeUniqueConstraintError' || createError.message?.includes('Duplicate entry')) {
              // Record already exists, try to find and update it
              console.log(`[POST /api/creator/elections/${electionAddress}/voters] Duplicate entry detected, trying to find existing record`);
              electionVoter = await ElectionVoter.findOne({
                where: {
                  electionId: electionRecord.id,
                  voterAddress: normalizedAddress
                }
              });
              
              if (electionVoter) {
                await electionVoter.update({
                  userId: user?.id || null,
                  registeredBy: registeredByAddress?.toLowerCase() || null,
                  isActive: true
                });
                created = false;
                console.log(`[POST /api/creator/elections/${electionAddress}/voters] Found and updated existing ElectionVoter record`);
              } else {
                throw new Error(`Failed to create or find ElectionVoter: ${createError.message}`);
              }
            } else {
              throw createError;
            }
          }
        }

        // If record already exists, update it
        if (!created && electionVoter) {
          await electionVoter.update({
            userId: user?.id || null,
            registeredBy: registeredByAddress?.toLowerCase() || null,
            isActive: true
          });
          console.log(`[POST /api/creator/elections/${electionAddress}/voters] Updated existing ElectionVoter record`);
        } else if (created) {
          console.log(`[POST /api/creator/elections/${electionAddress}/voters] Created new ElectionVoter record`);
        }

        // Verify the record was saved
        if (!electionVoter || !electionVoter.id) {
          throw new Error('Failed to create or retrieve ElectionVoter record');
        }

        console.log(`[POST /api/creator/elections/${electionAddress}/voters] ElectionVoter result:`, {
          id: electionVoter.id,
          electionId: electionVoter.electionId,
          voterAddress: electionVoter.voterAddress,
          userId: electionVoter.userId,
          wasCreated: created
        });

        console.log(`[POST /api/creator/elections/${electionAddress}/voters] ✅ Saved voter to database:`, {
          electionId: electionRecord.id,
          voterAddress: normalizedAddress,
          userId: user?.id || null
        });
      } else {
        console.error(`[POST /api/creator/elections/${electionAddress}/voters] ❌ Election not found in database with contractAddress: ${electionAddress.toLowerCase()}`);
        // Try to find all elections to debug
        const allElections = await Election.findAll({
          attributes: ['id', 'title', 'contractAddress'],
          limit: 10
        });
        console.error(`[POST /api/creator/elections/${electionAddress}/voters] Available elections in DB:`, allElections.map(e => ({ id: e.id, contractAddress: e.contractAddress })));
        
        // Throw error if election not found - this is a critical error
        throw new Error(`Election not found in database with contractAddress: ${electionAddress}. Please ensure the election was created and saved to the database first.`);
      }
    } catch (dbError) {
      // Log full error details
      console.error(`[POST /api/creator/elections/${electionAddress}/voters] ❌ Failed to save to database:`, {
        message: dbError.message,
        stack: dbError.stack,
        name: dbError.name
      });
      // Re-throw to return error to frontend
      throw dbError;
    }

    res.json({
      success: true,
      message: isVoter ? 'Voter already in contract, saved to database for sync' : 'Voter saved to database successfully',
      address: normalizedAddress,
      isVoter: isVoterAfter || isVoter,
      alreadyInContract: isVoter
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
 * GET /api/creator/elections/:electionAddress
 * Get election details by contract address
 */
router.get('/elections/:electionAddress', requireElectionCreator, async (req, res) => {
  try {
    const { electionAddress } = req.params;

    console.log(`[GET /api/creator/elections/${electionAddress}] Fetching election details...`);

    // Get election from database
    const electionRecord = await Election.findOne({
      where: {
        [Op.or]: [
          { contractAddress: electionAddress.toLowerCase() },
          { contractAddress: electionAddress }
        ]
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email']
      }]
    });

    if (!electionRecord) {
      return res.status(404).json({
        success: false,
        error: 'Election not found'
      });
    }

    // Get election contract info
    let contractInfo = null;
    try {
      const electionABI = loadContractABI('Election');
      const election = getContract(electionAddress, electionABI);
      const provider = getProvider();

      const [
        title,
        description,
        electionType,
        startTime,
        endTime,
        isPublic,
        state,
        totalCandidates,
        totalVotes
      ] = await Promise.all([
        election.title(),
        election.description(),
        election.electionType(),
        election.startTime(),
        election.endTime(),
        election.isPublic(),
        election.state(),
        election.totalCandidates().catch(() => 0),
        election.totalVotes().catch(() => 0)
      ]);

      // Get candidates from database first (faster and more reliable)
      let candidates = [];
      try {
        const dbCandidates = await Candidate.findAll({
          where: {
            electionId: electionRecord.id
          },
          order: [['candidate_index', 'ASC']]
        });

        if (dbCandidates.length > 0) {
          console.log(`[GET /api/creator/elections/${electionAddress}] Found ${dbCandidates.length} candidates in database`);
          
          // Get vote counts from contract if available
          try {
            const electionABI = loadContractABI('Election');
            const election = getContract(electionAddress, electionABI);
            
            for (let i = 0; i < dbCandidates.length; i++) {
              try {
                const contractCandidate = await election.candidates(i);
                dbCandidates[i].voteCount = contractCandidate.voteCount.toString();
              } catch (voteError) {
                // If can't get vote count from contract, keep database value
                console.warn(`[GET /api/creator/elections/${electionAddress}] Could not get vote count for candidate ${i}:`, voteError.message);
              }
            }
          } catch (contractError) {
            console.warn(`[GET /api/creator/elections/${electionAddress}] Could not get vote counts from contract:`, contractError.message);
          }

          candidates = dbCandidates.map(c => ({
            id: c.candidateIndex,
            name: c.name,
            party: c.party,
            age: c.age.toString(),
            manifesto: c.manifesto,
            description: c.description || '',
            imageCid: c.imageCid,
            imageUrl: c.imageUrl,
            voteCount: c.voteCount.toString()
          }));
        } else {
          // Fallback: Get candidates from contract if not in database
          console.log(`[GET /api/creator/elections/${electionAddress}] No candidates in database, fetching from contract...`);
          try {
            const electionABI = loadContractABI('Election');
            const election = getContract(electionAddress, electionABI);
            
            for (let i = 0; i < totalCandidates; i++) {
              const candidate = await election.candidates(i);
              candidates.push({
                id: i,
                name: candidate.name,
                party: candidate.party,
                age: candidate.age.toString(),
                manifesto: candidate.manifesto,
                voteCount: candidate.voteCount.toString()
              });
            }

            // Try to get metadata from IPFS
            if (electionRecord.ipfsHash) {
              try {
                const ipfsResult = await ipfsService.getJSONFromIPFS(electionRecord.ipfsHash);
                if (ipfsResult.success && ipfsResult.data?.candidates) {
                  const ipfsCandidates = ipfsResult.data.candidates;
                  candidates.forEach((contractCandidate, index) => {
                    const ipfsCandidate = ipfsCandidates[index];
                    if (ipfsCandidate) {
                      contractCandidate.description = ipfsCandidate.description || '';
                      contractCandidate.imageCid = ipfsCandidate.imageCid || null;
                      contractCandidate.imageUrl = ipfsCandidate.imageUrl || null;
                      
                      if (contractCandidate.imageCid && !contractCandidate.imageUrl) {
                        const gateway = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
                        contractCandidate.imageUrl = `${gateway}${contractCandidate.imageCid}`;
                      }
                    }
                  });
                }
              } catch (ipfsError) {
                console.warn(`[GET /api/creator/elections/${electionAddress}] Error loading IPFS metadata:`, ipfsError.message);
              }
            }
          } catch (candidateError) {
            console.warn(`[GET /api/creator/elections/${electionAddress}] Error fetching candidates from contract:`, candidateError.message);
          }
        }
      } catch (dbError) {
        console.error(`[GET /api/creator/elections/${electionAddress}] Error querying candidates from database:`, dbError);
        // Fallback to contract/IPFS as above
      }

      contractInfo = {
        title,
        description,
        electionType,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        isPublic,
        state: state.toString(),
        totalCandidates: totalCandidates.toString(),
        totalVotes: totalVotes.toString(),
        candidates
      };
    } catch (contractError) {
      console.warn(`[GET /api/creator/elections/${electionAddress}] Error fetching contract info:`, contractError.message);
      // Continue without contract info
    }

    // Get voters count from database
    let votersCount = 0;
    try {
      votersCount = await ElectionVoter.count({
        where: {
          electionId: electionRecord.id,
          isActive: true
        }
      });
    } catch (voterCountError) {
      console.warn(`[GET /api/creator/elections/${electionAddress}] Error counting voters:`, voterCountError.message);
    }

    res.json({
      success: true,
      election: {
        id: electionRecord.id,
        title: electionRecord.title,
        description: electionRecord.description,
        electionType: electionRecord.electionType,
        contractAddress: electionRecord.contractAddress,
        ipfsHash: electionRecord.ipfsHash,
        startTime: electionRecord.startTime,
        endTime: electionRecord.endTime,
        status: electionRecord.status,
        createdAt: electionRecord.createdAt,
        updatedAt: electionRecord.updatedAt,
        creator: electionRecord.creator,
        contractInfo,
        votersCount
      }
    });
  } catch (error) {
    console.error('Get election details error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get election details'
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
    console.log(`[GET /api/creator/elections/${electionAddress}/voters] Searching for election with contractAddress: ${electionAddress.toLowerCase()}`);

    // First, try to get voters from database (faster and more reliable)
    try {
      // Try both lowercase and original case
      const electionRecord = await Election.findOne({
        where: {
          [Op.or]: [
            { contractAddress: electionAddress.toLowerCase() },
            { contractAddress: electionAddress }
          ]
        }
      });

      if (electionRecord) {
        console.log(`[GET /api/creator/elections/${electionAddress}/voters] Found election in database: ID=${electionRecord.id}, contractAddress=${electionRecord.contractAddress}`);
        
        try {
        const dbVoters = await ElectionVoter.findAll({
          where: {
            electionId: electionRecord.id,
            isActive: true
          },
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'walletAddress', 'wallet_address'],
            required: false // LEFT JOIN
          }],
          order: [['created_at', 'DESC']]
        });

          console.log(`[GET /api/creator/elections/${electionAddress}/voters] Found ${dbVoters.length} voters in database`);
          console.log(`[GET /api/creator/elections/${electionAddress}/voters] Voter addresses:`, dbVoters.map(ev => ev.voterAddress));
          
          // Also log raw data for debugging
          if (dbVoters.length > 0) {
            console.log(`[GET /api/creator/elections/${electionAddress}/voters] Raw voter data:`, dbVoters.map(ev => ({
              id: ev.id,
              electionId: ev.electionId,
              voterAddress: ev.voterAddress,
              userId: ev.userId,
              isActive: ev.isActive
            })));
          }

          // Map to response format
          const voters = dbVoters.map(ev => ({
            address: ev.voterAddress,
            registeredBy: ev.registeredBy,
            timestamp: ev.createdAt ? Math.floor(new Date(ev.createdAt).getTime() / 1000).toString() : '0',
            user: ev.user ? {
              id: ev.user.id,
              name: ev.user.name,
              email: ev.user.email,
              walletAddress: ev.user.walletAddress || ev.user.wallet_address
            } : null
          }));

          console.log(`[GET /api/creator/elections/${electionAddress}/voters] Returning ${voters.length} voters from database`);
          
          return res.json({
            success: true,
            voters,
            source: 'database'
          });
        } catch (queryError) {
          console.error(`[GET /api/creator/elections/${electionAddress}/voters] Error querying ElectionVoter:`, queryError);
          console.error(`[GET /api/creator/elections/${electionAddress}/voters] Error stack:`, queryError.stack);
          // Fall through to blockchain query
        }
      } else {
        console.warn(`[GET /api/creator/elections/${electionAddress}/voters] Election not found in database with contractAddress: ${electionAddress.toLowerCase()}`);
        // Try to find all elections to debug
        const allElections = await Election.findAll({
          attributes: ['id', 'title', 'contractAddress'],
          limit: 10
        });
        console.log(`[GET /api/creator/elections/${electionAddress}/voters] Available elections in DB:`, allElections.map(e => ({ id: e.id, contractAddress: e.contractAddress })));
      }
    } catch (dbError) {
      console.error(`[GET /api/creator/elections/${electionAddress}/voters] Error querying database:`, dbError);
      console.error(`[GET /api/creator/elections/${electionAddress}/voters] Error stack:`, dbError.stack);
      // Fall through to blockchain query
    }

    // Fallback: Query from blockchain events
    console.log(`[GET /api/creator/elections/${electionAddress}/voters] Falling back to blockchain events...`);

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
          warning: 'Contract may not be deployed. No voters available.',
          source: 'blockchain'
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

    console.log(`[GET /api/creator/elections/${electionAddress}/voters] Returning ${voters.length} voters from blockchain`);

    res.json({
      success: true,
      voters,
      source: 'blockchain'
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

    // Remove from database
    try {
      const electionRecord = await Election.findOne({
        where: { contractAddress: electionAddress.toLowerCase() }
      });

      if (electionRecord) {
        await ElectionVoter.update(
          { isActive: false },
          {
            where: {
              electionId: electionRecord.id,
              voterAddress: address.toLowerCase()
            }
          }
        );
        console.log(`[DELETE /api/creator/elections/${electionAddress}/voters/${address}] Removed voter from database`);
      }
    } catch (dbError) {
      // Log error but don't fail the request - smart contract update succeeded
      console.warn(`[DELETE /api/creator/elections/${electionAddress}/voters/${address}] Failed to remove from database:`, dbError.message);
    }

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

    // Update database - keep status as ONGOING, frontend will derive "ENDED" from endTime
    // Note: We could set status to PAUSED if needed, but for now we keep ONGOING
    // Frontend will check endTime to determine if election has ended

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

/**
 * POST /api/creator/elections/save
 * Save election to database after deployment (frontend deploys contract via MetaMask)
 */
router.post('/elections/save', [
  body('contractAddress').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid contract address'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('electionType').isIn(['PRESIDENTIAL', 'PARLIAMENTARY', 'LOCAL', 'REFERENDUM']).withMessage('Invalid election type'),
  body('startTime').isInt({ min: 0 }).withMessage('Invalid start time'),
  body('endTime').isInt({ min: 0 }).withMessage('Invalid end time'),
  body('ipfsCid').trim().notEmpty().withMessage('IPFS CID is required'),
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
      contractAddress,
      title,
      description,
      electionType,
      startTime,
      endTime,
      ipfsCid,
      candidates
    } = req.body;

    // Verify contract exists
    const provider = getProvider();
    const contractCode = await provider.getCode(contractAddress);
    if (contractCode === '0x' || contractCode === '0x0') {
      return res.status(400).json({
        success: false,
        error: 'Contract does not exist at the provided address'
      });
    }

    // Check if election already exists
    const existingElection = await Election.findOne({
      where: { contractAddress: contractAddress.toLowerCase() }
    });

    if (existingElection) {
      // If election exists and was created by the same user, update it instead of creating new
      if (existingElection.createdBy === req.userId) {
        console.log(`[POST /api/creator/elections/save] Election already exists, updating existing record:`, {
          id: existingElection.id,
          contractAddress: existingElection.contractAddress,
          createdBy: existingElection.createdBy
        });
        
        // Update existing election
        await existingElection.update({
          title,
          description,
          electionType,
          ipfsHash: ipfsCid,
          startTime: new Date(startTime * 1000),
          endTime: new Date(endTime * 1000),
          status: 'ONGOING'
        });
        
        // Delete old candidates and create new ones
        const Candidate = require('../models/Candidate');
        await Candidate.destroy({
          where: { electionId: existingElection.id }
        });
        
        // Save new candidates
        try {
          const gateway = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
          const candidatesToSave = candidates.map((candidate, index) => {
            const imageCid = candidate.imageHash || candidate.imageCid || null;
            return {
              electionId: existingElection.id,
              candidateIndex: index,
              name: candidate.name,
              party: candidate.party,
              age: candidate.age,
              manifesto: candidate.manifesto,
              description: candidate.description || '',
              imageCid: imageCid,
              imageUrl: imageCid ? `${gateway}${imageCid}` : null,
              voteCount: 0
            };
          });

          await Candidate.bulkCreate(candidatesToSave);
          console.log(`[POST /api/creator/elections/save] Updated ${candidatesToSave.length} candidates for existing election`);
        } catch (candidateError) {
          console.error('[POST /api/creator/elections/save] Error updating candidates:', candidateError);
          // Don't fail the request - election was updated successfully
        }
        
        return res.json({
          success: true,
          election: {
            id: existingElection.id,
            contractAddress: contractAddress,
            title,
            ipfsCid,
            updated: true
          }
        });
      } else {
        // Election exists but created by different user
        return res.status(400).json({
          success: false,
          error: 'Election with this contract address already exists and was created by another user'
        });
      }
    }

    // Save to database
    console.log(`[POST /api/creator/elections/save] Saving election with:`, {
      contractAddress: contractAddress.toLowerCase(),
      userId: req.userId,
      userIdType: typeof req.userId,
      title
    });
    
    const electionRecord = await Election.create({
      title,
      description,
      electionType,
      contractAddress: contractAddress.toLowerCase(),
      ipfsHash: ipfsCid,
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      status: 'ONGOING',
      createdBy: req.userId
    });
    
    console.log(`[POST /api/creator/elections/save] Election saved:`, {
      id: electionRecord.id,
      createdBy: electionRecord.createdBy,
      createdByType: typeof electionRecord.createdBy,
      contractAddress: electionRecord.contractAddress
    });

    // Save candidates to database
    try {
      const gateway = process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
      const candidatesToSave = candidates.map((candidate, index) => {
        const imageCid = candidate.imageHash || candidate.imageCid || null;
        return {
          electionId: electionRecord.id,
          candidateIndex: index,
          name: candidate.name,
          party: candidate.party,
          age: candidate.age,
          manifesto: candidate.manifesto,
          description: candidate.description || '',
          imageCid: imageCid,
          imageUrl: imageCid ? `${gateway}${imageCid}` : null,
          voteCount: 0
        };
      });

      await Candidate.bulkCreate(candidatesToSave);
      console.log(`[POST /api/creator/elections/save] Saved ${candidatesToSave.length} candidates to database`);
    } catch (candidateError) {
      console.error('[POST /api/creator/elections/save] Error saving candidates:', candidateError);
      // Don't fail the request - election was saved successfully
    }

    console.log('[POST /api/creator/elections/save] Saved election to database:', {
      id: electionRecord.id,
      contractAddress: electionRecord.contractAddress,
      title: electionRecord.title
    });

    res.json({
      success: true,
      election: {
        id: electionRecord.id,
        contractAddress: contractAddress,
        title,
        ipfsCid
      }
    });
  } catch (error) {
    console.error('Save election error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save election'
    });
  }
});

module.exports = router;

