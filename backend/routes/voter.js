const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { loadContractABI, getContract, getAdminSigner, getProvider } = require('../config/blockchain');
const { ethers } = require('ethers');
const Election = require('../models/Election');
const Vote = require('../models/Vote');
const ElectionVoter = require('../models/ElectionVoter');
const Candidate = require('../models/Candidate');
const { getElectionFactory } = require('../services/rbacService');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const ipfsService = require('../services/ipfsService');

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
    // Status will be derived from startTime and endTime in frontend
    const dbElections = await Election.findAll({
      where: {
        status: 'ONGOING' // Only get ONGOING elections (PAUSED elections are excluded)
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
            // First, check database (election_voters table) - faster and more reliable
            try {
              // Case-insensitive match for MySQL - use LOWER() function
              const dbVoterRecord = await ElectionVoter.findOne({
                where: {
                  electionId: election.id,
                  [Op.and]: [
                    sequelize.where(
                      sequelize.fn('LOWER', sequelize.col('voter_address')),
                      walletAddress.toLowerCase()
                    ),
                    { isActive: true }
                  ]
                }
              });

              if (dbVoterRecord) {
                // Voter is in database, so they are registered
                isVoter = true;
                console.log(`[GET /api/voter/elections] Voter ${walletAddress} found in database for election ${election.contractAddress}`);
                
                // Check contract for canVote and hasVoted (more accurate)
                try {
                  [canVote, hasVoted] = await Promise.all([
                    electionContract.canVote(walletAddress).catch(() => false),
                    electionContract.hasVoterVoted(walletAddress).catch(() => false)
                  ]);
                  
                  // If voter is in DB, they should be able to vote when election starts
                  // Set canVote = true if:
                  // 1. Election is ongoing (state = 1) and voter hasn't voted, OR
                  // 2. Election is created (state = 0) but voter is in DB (will be able to vote when election starts)
                  if (!hasVoted) {
                    if (state === 1) {
                      // Election is ongoing - voter can vote
                      canVote = true;
                      console.log(`[GET /api/voter/elections] Voter in DB, election ongoing - canVote = true`);
                    } else if (state === 0) {
                      // Election not started yet, but voter is registered - set canVote = true for UI
                      // (actual voting will be blocked by contract if state !== 1)
                      canVote = true;
                      console.log(`[GET /api/voter/elections] Voter in DB, election created - canVote = true (will be able to vote when election starts)`);
                    }
                  }
                } catch (contractError) {
                  console.warn(`[GET /api/voter/elections] Error checking contract for voter ${walletAddress}:`, contractError.message);
                  // If contract check fails but voter is in DB, allow voting if election is ongoing or created
                  if (!hasVoted && (state === 1 || state === 0)) {
                    canVote = true;
                    console.log(`[GET /api/voter/elections] Contract check failed, but voter in DB - canVote = true`);
                  }
                }
              } else {
                // Voter not in database, check contract
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
            } catch (dbError) {
              console.warn(`[GET /api/voter/elections] Error checking database for voter:`, dbError.message);
              // Fallback to contract check
              try {
                [canVote, hasVoted, isVoter] = await Promise.all([
                  electionContract.canVote(walletAddress).catch(() => false),
                  electionContract.hasVoterVoted(walletAddress).catch(() => false),
                  electionContract.isVoter(walletAddress).catch(() => false)
                ]);
              } catch (error) {
                console.warn(`Error getting voter info for election ${election.contractAddress}:`, error.message);
              }
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

    // Disable caching for dynamic election data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
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

    // First check database for election endTime
    const electionRecord = await Election.findOne({
      where: {
        [Op.or]: [
          { contractAddress: electionAddress.toLowerCase() },
          { contractAddress: electionAddress }
        ]
      }
    });

    if (!electionRecord) {
      return res.status(404).json({
        success: false,
        error: 'Election not found in database'
      });
    }

    // Check if election has ended based on endTime from database
    const now = new Date();
    const endTime = new Date(electionRecord.endTime);
    const hasEndedByTime = now >= endTime;

    const electionABI = loadContractABI('Election');
    const election = getContract(electionAddress, electionABI);

    // Check contract state
    let state;
    let contractExists = true;
    try {
      // Check if contract code exists
      const provider = getProvider();
      const code = await provider.getCode(electionAddress);
      if (code === '0x' || code === '0x0') {
        contractExists = false;
        console.warn(`[GET /api/voter/elections/${electionAddress}/results] No contract code at address ${electionAddress}`);
      } else {
        state = await election.state();
      }
    } catch (contractError) {
      console.warn(`[GET /api/voter/elections/${electionAddress}/results] Error checking contract state:`, contractError.message);
      contractExists = false;
    }

    // Allow viewing results if:
    // 1. endTime has passed (from database), OR
    // 2. Contract state is ENDED (3) or FINALIZED (4)
    if (!hasEndedByTime && contractExists && state !== 3 && state !== 4) {
      return res.status(400).json({
        success: false,
        error: 'Election has not ended yet'
      });
    }

    // Get results from contract if available, otherwise from database
    let results = [];
    let winner = null;
    let resultState = state?.toString() || (hasEndedByTime ? '3' : '0');

    if (contractExists) {
      try {
        // Get all candidates and their vote counts from contract
        const contractCandidates = await election.getAllCandidates();
        results = await Promise.all(
          contractCandidates.map(async (candidate) => {
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
            // Winner not determined yet, find from results
            if (results.length > 0) {
              const sortedResults = [...results].sort((a, b) => parseInt(b.voteCount) - parseInt(a.voteCount));
              if (sortedResults[0].voteCount !== '0') {
                winner = sortedResults[0];
              }
            }
          }
        } else if (hasEndedByTime && results.length > 0) {
          // If time has ended but not finalized, find winner from results
          const sortedResults = [...results].sort((a, b) => parseInt(b.voteCount) - parseInt(a.voteCount));
          if (sortedResults[0].voteCount !== '0') {
            winner = sortedResults[0];
          }
        }

        resultState = state?.toString() || (hasEndedByTime ? '3' : '0');
      } catch (contractError) {
        console.warn(`[GET /api/voter/elections/${electionAddress}/results] Error getting results from contract:`, contractError.message);
        contractExists = false; // Fallback to database
      }
    }

    // Fallback to database if contract doesn't exist or contract call failed
    if (!contractExists || results.length === 0) {
      console.log(`[GET /api/voter/elections/${electionAddress}/results] Using database results`);
      const candidates = await Candidate.findAll({
        where: { electionId: electionRecord.id },
        order: [['voteCount', 'DESC'], ['candidateIndex', 'ASC']]
      });

      results = candidates.map(c => ({
        candidateId: c.candidateIndex.toString(),
        name: c.name,
        party: c.party,
        voteCount: c.voteCount.toString()
      }));

      // Find winner (candidate with highest voteCount)
      if (results.length > 0 && results[0].voteCount !== '0') {
        winner = results[0];
      }
    }

    res.json({
      success: true,
      results,
      winner,
      state: resultState,
      source: contractExists ? 'contract' : 'database'
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
 * GET /api/voter/elections/:electionAddress
 * Get election details with candidates for voter
 */
router.get('/elections/:electionAddress', async (req, res) => {
  try {
    const { electionAddress } = req.params;
    const walletAddress = req.user.walletAddress || req.user.wallet_address;

    // Get election from database
    const electionRecord = await Election.findOne({
      where: {
        [Op.or]: [
          { contractAddress: electionAddress.toLowerCase() },
          { contractAddress: electionAddress }
        ]
      }
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
        election.title().catch(() => electionRecord.title),
        election.description().catch(() => electionRecord.description),
        election.electionType().catch(() => electionRecord.electionType),
        election.startTime().catch(() => Math.floor(new Date(electionRecord.startTime).getTime() / 1000)),
        election.endTime().catch(() => Math.floor(new Date(electionRecord.endTime).getTime() / 1000)),
        election.isPublic().catch(() => false),
        election.state().catch(() => 0),
        election.totalCandidates().catch(() => 0),
        election.totalVotes().catch(() => 0)
      ]);

      // Get candidates from database first
      let candidates = [];
      try {
        const dbCandidates = await Candidate.findAll({
          where: {
            electionId: electionRecord.id
          },
          order: [['candidate_index', 'ASC']]
        });

        if (dbCandidates.length > 0) {
          // Get vote counts from contract
          try {
            for (let i = 0; i < dbCandidates.length; i++) {
              try {
                const contractCandidate = await election.candidates(i);
                dbCandidates[i].voteCount = contractCandidate.voteCount.toString();
              } catch (voteError) {
                // Keep database value
              }
            }
          } catch (contractError) {
            // Continue with database values
          }

          candidates = dbCandidates.map(c => ({
            id: c.candidateIndex,
            candidateId: c.candidateIndex,
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
          // Fallback: Get from contract
          try {
            for (let i = 0; i < totalCandidates; i++) {
              const candidate = await election.candidates(i);
              candidates.push({
                id: i,
                candidateId: i,
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
                // Continue without IPFS metadata
              }
            }
          } catch (candidateError) {
            console.warn(`Error fetching candidates:`, candidateError.message);
          }
        }
      } catch (dbError) {
        console.error(`Error querying candidates:`, dbError);
      }

      // Get voter status
      let canVote = false;
      let hasVoted = false;
      let isVoter = false;

      if (walletAddress) {
        try {
          // Check database first
          const dbVoterRecord = await ElectionVoter.findOne({
            where: {
              electionId: electionRecord.id,
              [Op.and]: [
                sequelize.where(
                  sequelize.fn('LOWER', sequelize.col('voter_address')),
                  walletAddress.toLowerCase()
                ),
                { isActive: true }
              ]
            }
          });

          if (dbVoterRecord) {
            isVoter = true;
            try {
              [canVote, hasVoted] = await Promise.all([
                election.canVote(walletAddress).catch(() => false),
                election.hasVoterVoted(walletAddress).catch(() => false)
              ]);
              
              const now = new Date();
              const startTimeDate = new Date(startTime * 1000);
              const endTimeDate = new Date(endTime * 1000);
              if (startTimeDate <= now && endTimeDate >= now && !hasVoted) {
                canVote = true;
              }
            } catch (contractError) {
              // Use database status
            }
          } else {
            try {
              [canVote, hasVoted, isVoter] = await Promise.all([
                election.canVote(walletAddress).catch(() => false),
                election.hasVoterVoted(walletAddress).catch(() => false),
                election.isVoter(walletAddress).catch(() => false)
              ]);
            } catch (error) {
              // Continue with defaults
            }
          }
        } catch (error) {
          console.warn('Error checking voter status:', error);
        }
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
        candidates,
        canVote,
        hasVoted,
        isVoter
      };
    } catch (contractError) {
      console.warn(`Error fetching contract info:`, contractError.message);
      // Return database info only
      contractInfo = {
        title: electionRecord.title,
        description: electionRecord.description,
        electionType: electionRecord.electionType,
        startTime: Math.floor(new Date(electionRecord.startTime).getTime() / 1000).toString(),
        endTime: Math.floor(new Date(electionRecord.endTime).getTime() / 1000).toString(),
        isPublic: false,
        state: '0',
        totalCandidates: '0',
        totalVotes: '0',
        candidates: [],
        canVote: false,
        hasVoted: false,
        isVoter: false
      };
    }

    // Disable caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      election: {
        id: electionRecord.id,
        contractAddress: electionRecord.contractAddress,
        ipfsHash: electionRecord.ipfsHash,
        ...contractInfo
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

    const normalizedWalletAddress = walletAddress.toLowerCase();
    console.log(`[GET /api/voter/elections/${electionAddress}/status] Checking status for wallet ${normalizedWalletAddress}`);

    // First, check database (more reliable)
    let isVoterFromDB = false;
    let canVoteFromDB = false;
    try {
      const electionRecord = await Election.findOne({
        where: {
          [Op.or]: [
            { contractAddress: electionAddress.toLowerCase() },
            { contractAddress: electionAddress }
          ]
        }
      });

      if (electionRecord) {
        const dbVoterRecord = await ElectionVoter.findOne({
          where: {
            electionId: electionRecord.id,
            [Op.and]: [
              sequelize.where(
                sequelize.fn('LOWER', sequelize.col('voter_address')),
                normalizedWalletAddress
              ),
              { isActive: true }
            ]
          }
        });

        if (dbVoterRecord) {
          isVoterFromDB = true;
          console.log(`[GET /api/voter/elections/${electionAddress}/status] Voter found in database`);
        }
      }
    } catch (dbError) {
      console.warn(`[GET /api/voter/elections/${electionAddress}/status] Error checking database:`, dbError.message);
    }

    // Then check contract
    const electionABI = loadContractABI('Election');
    const provider = getProvider();
    const election = getContract(electionAddress, electionABI);
    
    let isPublic = false;
    let state = 0;
    let canVote = false;
    let hasVoted = false;
    let isVoter = false;
    let contractErrorOccurred = false;

    // First, verify contract exists by checking if it has code
    try {
      const code = await provider.getCode(electionAddress);
      if (code === '0x' || code === '0x0') {
        console.warn(`[GET /api/voter/elections/${electionAddress}/status] No contract code at address ${electionAddress}. Contract may not be deployed.`);
        contractErrorOccurred = true;
        // If contract doesn't exist but voter is in DB, use DB values
        if (isVoterFromDB) {
          isVoter = true;
          canVote = !hasVoted;
        }
      } else {
        console.log(`[GET /api/voter/elections/${electionAddress}/status] Contract code found at address ${electionAddress}`);
      }
    } catch (codeError) {
      console.warn(`[GET /api/voter/elections/${electionAddress}/status] Error checking contract code:`, codeError.message);
      contractErrorOccurred = true;
    }

    // Check contract functions individually to handle errors better
    if (!contractErrorOccurred) {
      // First, verify contract exists by checking a simple view function
      try {
        state = await election.state();
        console.log(`[GET /api/voter/elections/${electionAddress}/status] Contract state: ${state}`);
      } catch (err) {
        console.warn(`[GET /api/voter/elections/${electionAddress}/status] Error getting state:`, err.message);
        contractErrorOccurred = true;
      }

      // Check other functions individually
      try {
        isPublic = await election.isPublic();
      } catch (err) {
        console.warn(`[GET /api/voter/elections/${electionAddress}/status] Error getting isPublic:`, err.message);
      }

      try {
        canVote = await election.canVote(normalizedWalletAddress);
      } catch (err) {
        console.warn(`[GET /api/voter/elections/${electionAddress}/status] Error getting canVote:`, err.message);
        // If canVote fails, try to determine from other checks
        canVote = false;
      }

      try {
        hasVoted = await election.hasVoterVoted(normalizedWalletAddress);
      } catch (err) {
        console.warn(`[GET /api/voter/elections/${electionAddress}/status] Error getting hasVoted:`, err.message);
      }

      // Check isVoter with better error handling
      try {
        isVoter = await election.isVoter(normalizedWalletAddress);
        console.log(`[GET /api/voter/elections/${electionAddress}/status] Contract isVoter(${normalizedWalletAddress}): ${isVoter}`);
      } catch (err) {
        console.warn(`[GET /api/voter/elections/${electionAddress}/status] Error getting isVoter:`, {
          message: err.message,
          code: err.code,
          data: err.data,
          address: normalizedWalletAddress,
          contractAddress: electionAddress
        });
        // If isVoter check fails, assume false (will be overridden by DB check if voter is in DB)
        isVoter = false;
      }
    }
    
    // If contract check failed but voter is in DB, use DB values
    if (contractErrorOccurred && isVoterFromDB) {
      isVoter = true;
      canVote = !hasVoted; // Can vote if hasn't voted yet
    }

    // If contract doesn't exist, we can't allow voting even if voter is in DB
    if (contractErrorOccurred) {
      console.warn(`[GET /api/voter/elections/${electionAddress}/status] Contract not deployed - cannot vote`);
      // Set canVote to false if contract doesn't exist
      canVote = false;
      // But still set isVoter = true if in DB (for UI display)
      if (isVoterFromDB) {
        isVoter = true;
      }
    } else {
      // If voter is in database but not in contract, still allow them to vote
      // (contract will auto-add them or they were added but contract state not synced)
      if (isVoterFromDB && !isVoter) {
        console.log(`[GET /api/voter/elections/${electionAddress}/status] Voter in DB but not in contract - using DB status`);
        isVoter = true;
        // Can vote if election is ongoing or created (will auto-start)
        if (state === 0 || state === 1) {
          canVote = !hasVoted;
        }
      }

      // If voter is in DB and election is created (state 0), they can vote when it starts
      if (isVoterFromDB && state === 0 && !hasVoted) {
        canVote = true;
        console.log(`[GET /api/voter/elections/${electionAddress}/status] Voter in DB, election created - canVote = true (will be able to vote when election starts)`);
      }
    }

    console.log(`[GET /api/voter/elections/${electionAddress}/status] Results:`, {
      isPublic,
      state: state.toString(),
      canVote,
      hasVoted,
      isVoter,
      isVoterFromDB,
      isVoterFromContract: isVoter && !isVoterFromDB
    });

    // Disable caching for dynamic election status
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
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

