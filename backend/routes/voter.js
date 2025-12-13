const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { loadContractABI, getContract, getAdminSigner } = require('../config/blockchain');
const { ethers } = require('ethers');
const Election = require('../models/Election');
const Vote = require('../models/Vote');
const { getElectionFactory } = require('../services/rbacService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/voter/elections
 * Get all available elections (public and private where user is registered)
 */
router.get('/elections', async (req, res) => {
  try {
    const walletAddress = req.user.walletAddress || req.user.wallet_address;

    // Get all active elections from database (even without wallet address)
    const dbElections = await Election.findAll({
      where: {
        status: ['UPCOMING', 'LIVE']
      }
    });

    if (dbElections.length === 0) {
      return res.json({
        success: true,
        elections: []
      });
    }

    const electionABI = loadContractABI('Election');
    const electionsWithDetails = await Promise.all(
      dbElections.map(async (election) => {
        try {
          if (!election.contractAddress) {
            console.warn(`Election ${election.id} has no contract address`);
            return null;
          }

          const electionContract = getContract(election.contractAddress, electionABI);
          
          // Get basic election info
          const [isPublic, state] = await Promise.all([
            electionContract.isPublic().catch(() => false),
            electionContract.state().catch(() => 0)
          ]);

          // Get voter-specific info only if wallet address is available
          let canVote = false;
          let hasVoted = false;
          let isVoter = false;

          if (walletAddress) {
            try {
              [canVote, hasVoted, isVoter] = await Promise.all([
                electionContract.canVote(walletAddress).catch(() => false),
                electionContract.hasVoterVoted(walletAddress).catch(() => false),
                electionContract.isVoter(walletAddress).catch(() => false)
              ]);
            } catch (error) {
              console.warn(`Error getting voter info for election ${election.contractAddress}:`, error.message);
              // Continue with default values
            }
          }

          return {
            id: election.id,
            contractAddress: election.contractAddress,
            title: election.title,
            description: election.description,
            electionType: election.electionType,
            startTime: election.startTime,
            endTime: election.endTime,
            status: election.status,
            ipfsHash: election.ipfsHash,
            isPublic,
            state: state.toString(),
            canVote,
            hasVoted,
            isVoter
          };
        } catch (error) {
          console.error(`Error getting election ${election.contractAddress}:`, error);
          // Return election info even if contract call fails
          return {
            id: election.id,
            contractAddress: election.contractAddress,
            title: election.title,
            description: election.description,
            electionType: election.electionType,
            startTime: election.startTime,
            endTime: election.endTime,
            status: election.status,
            ipfsHash: election.ipfsHash,
            isPublic: false,
            state: '0',
            canVote: false,
            hasVoted: false,
            isVoter: false,
            error: 'Failed to load contract details'
          };
        }
      })
    );

    res.json({
      success: true,
      elections: electionsWithDetails.filter(e => e !== null)
    });
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get elections'
    });
  }
});

/**
 * POST /api/voter/elections/:electionAddress/register
 * Register for public election
 * Auto-registers and approves voter in VoterRegistry if needed
 */
router.post('/elections/:electionAddress/register', async (req, res) => {
  try {
    const { electionAddress } = req.params;
    const walletAddress = req.user.walletAddress || req.user.wallet_address;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found. Please connect your wallet.'
      });
    }

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);

    // Check if election is public
    const isPublic = await election.isPublic();
    if (!isPublic) {
      return res.status(403).json({
        success: false,
        error: 'This is a private election. Only the creator can add voters.'
      });
    }

    // Check if already registered
    const isVoter = await election.isVoter(walletAddress);
    if (isVoter) {
      return res.status(400).json({
        success: false,
        error: 'Already registered for this election'
      });
    }

    // Get VoterRegistry address from ElectionFactory
    const factory = await getElectionFactory();
    const voterRegistryAddress = await factory.voterRegistry();
    
    // Check if voter is eligible in VoterRegistry
    const voterRegistryABI = loadContractABI('VoterRegistry');
    const voterRegistry = getContract(voterRegistryAddress, voterRegistryABI);
    const isEligible = await voterRegistry.isVoterEligible(walletAddress);
    
    if (!isEligible) {
      // Check if voter is already registered but not approved
      let needsApproval = false;
      try {
        const voterInfo = await voterRegistry.getVoterInfo(walletAddress);
        // Voter exists but not approved - need approval
        needsApproval = true;
        console.log(`[Voter] Voter exists but not approved, will approve...`);
      } catch (error) {
        // Voter not registered - voter needs to register themselves first
        console.log(`[Voter] Voter not registered in VoterRegistry. Voter must register first.`);
        return res.status(400).json({
          success: false,
          error: 'Voter not registered in VoterRegistry. Please register in VoterRegistry first.',
          needsVoterRegistryRegistration: true,
          voterRegistryAddress: voterRegistryAddress,
          voterId: `VOTER-${req.userId}`,
          name: req.user.name || 'Voter',
          age: 25
        });
      }
      
      // If voter is registered but not approved, approve them
      if (needsApproval) {
        try {
          const signer = getAdminSigner();
          const signerAddress = await signer.getAddress();
          
          // Check if signer is chairperson
          const isChairperson = await voterRegistry.isChairperson(signerAddress);
          if (!isChairperson) {
            // Try to add signer as chairperson (if signer is owner)
            const owner = await voterRegistry.owner();
            if (owner.toLowerCase() === signerAddress.toLowerCase()) {
              // Signer is owner, can add themselves as chairperson
              const voterRegistryWithSigner = voterRegistry.connect(signer);
              try {
                const addChairpersonTx = await voterRegistryWithSigner.addChairperson(signerAddress);
                await addChairpersonTx.wait();
                console.log(`[Voter] Added signer as chairperson`);
              } catch (err) {
                // Might already be chairperson
                console.log(`[Voter] Signer might already be chairperson`);
              }
            } else {
              console.error(`[Voter] Signer is not owner or chairperson. Cannot approve voter.`);
              return res.status(500).json({
                success: false,
                error: 'System signer is not authorized to approve voters. Please contact administrator.'
              });
            }
          }
          
          const voterRegistryWithSigner = voterRegistry.connect(signer);
          console.log(`[Voter] Approving voter ${walletAddress}...`);
          const approveTx = await voterRegistryWithSigner.approveVoter(walletAddress);
          await approveTx.wait();
          console.log(`[Voter] Voter approved successfully`);
          
          // Verify eligibility after approval
          const nowEligible = await voterRegistry.isVoterEligible(walletAddress);
          if (!nowEligible) {
            console.error(`[Voter] Voter still not eligible after approval`);
            return res.status(500).json({
              success: false,
              error: 'Failed to approve voter. Please try again.'
            });
          }
        } catch (error) {
          console.error(`[Voter] Error approving voter:`, error);
          return res.status(500).json({
            success: false,
            error: error.reason || error.message || 'Failed to approve voter in VoterRegistry'
          });
        }
      }
    }

    // Note: In a real implementation, the user would sign a transaction
    // For now, we'll return instructions
    res.json({
      success: true,
      message: 'Please call registerPublic() on the election contract from your wallet',
      electionAddress,
      functionName: 'registerPublic',
      parameters: []
    });
  } catch (error) {
    console.error('Register for election error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to register for election'
    });
  }
});

/**
 * POST /api/voter/elections/:electionAddress/vote
 * Cast a vote (returns transaction data for user to sign)
 */
router.post('/elections/:electionAddress/vote', [
  body('candidateId').isInt({ min: 1 }),
  body('voteHash').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { electionAddress } = req.params;
    const { candidateId, voteHash } = req.body;
    const walletAddress = req.user.walletAddress || req.user.wallet_address;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found. Please connect your wallet.'
      });
    }

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);

    // Check eligibility
    const canVote = await election.canVote(walletAddress);
    if (!canVote) {
      return res.status(403).json({
        success: false,
        error: 'You are not eligible to vote in this election'
      });
    }

    // Check if already voted
    const hasVoted = await election.hasVoterVoted(walletAddress);
    if (hasVoted) {
      return res.status(400).json({
        success: false,
        error: 'You have already voted in this election'
      });
    }

    // Check election state
    const state = await election.state();
    if (state !== 1) { // ONGOING = 1
      return res.status(400).json({
        success: false,
        error: 'Election is not ongoing'
      });
    }

    // Return transaction data for user to sign
    const voteHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(voteHash));

    res.json({
      success: true,
      message: 'Please call vote() on the election contract from your wallet',
      electionAddress,
      functionName: 'vote',
      parameters: [candidateId, voteHashBytes32]
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to cast vote'
    });
  }
});

/**
 * GET /api/voter/elections/:electionAddress/results
 * Get election results (only after election ended)
 */
router.get('/elections/:electionAddress/results', async (req, res) => {
  try {
    const { electionAddress } = req.params;

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);

    // Check if election has ended
    const state = await election.state();
    if (state !== 3 && state !== 4) { // ENDED = 3, FINALIZED = 4
      return res.status(400).json({
        success: false,
        error: 'Election has not ended yet'
      });
    }

    // Get all candidates and their vote counts
    const candidates = await election.getAllCandidates();
    const results = await Promise.all(
      candidates.map(async (candidate) => {
        const voteCount = await election.getResult(candidate.candidateId);
        return {
          candidateId: candidate.candidateId.toString(),
          name: candidate.name,
          party: candidate.party,
          voteCount: voteCount.toString()
        };
      })
    );

    // Get winner if finalized
    let winner = null;
    if (state === 4) { // FINALIZED
      try {
        const winnerInfo = await election.getWinner();
        winner = {
          candidateId: winnerInfo.candidateId.toString(),
          name: winnerInfo.name,
          party: winnerInfo.party,
          voteCount: winnerInfo.voteCount.toString()
        };
      } catch {
        // Winner not determined yet
      }
    }

    res.json({
      success: true,
      results,
      winner,
      state: state.toString()
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to get results'
    });
  }
});

/**
 * GET /api/voter/elections/:electionAddress/status
 * Get election status and voter eligibility
 */
router.get('/elections/:electionAddress/status', async (req, res) => {
  try {
    const { electionAddress } = req.params;
    const walletAddress = req.user.walletAddress || req.user.wallet_address;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address not found. Please connect your wallet.'
      });
    }

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);

    console.log(`[GET /api/voter/elections/${electionAddress}/status] Checking status for wallet ${walletAddress}`);
    
    const [isPublic, state, canVote, hasVoted, isVoter] = await Promise.all([
      election.isPublic().catch(() => false),
      election.state().catch(() => 0),
      election.canVote(walletAddress).catch(() => false),
      election.hasVoterVoted(walletAddress).catch(() => false),
      election.isVoter(walletAddress).catch(() => false)
    ]);

    console.log(`[GET /api/voter/elections/${electionAddress}/status] Results:`, {
      isPublic,
      state: state.toString(),
      canVote,
      hasVoted,
      isVoter
    });

    res.json({
      success: true,
      isPublic,
      state: state.toString(),
      canVote,
      hasVoted,
      isVoter
    });
  } catch (error) {
    console.error('Get election status error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to get election status'
    });
  }
});

module.exports = router;

