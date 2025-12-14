const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { ethers } = require('ethers');
const Vote = require('../models/Vote');
const Election = require('../models/Election');
const Candidate = require('../models/Candidate');
const { createActivityLog } = require('../services/activityService');
const { getAdminSigner, getProvider } = require('../config/blockchain');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create vote record
router.post('/', [
  body('electionId').isInt(),
  body('candidateId').isInt(),
  body('transactionHash').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { electionId, candidateId, transactionHash, receiptIpfsHash } = req.body;

    // Check if user already voted
    const existingVote = await Vote.findOne({
      where: {
        userId: req.userId,
        electionId,
      }
    });

    if (existingVote) {
      return res.status(400).json({
        success: false,
        error: 'User has already voted in this election'
      });
    }

    // Get voter address from wallet or user data
    const voterAddress = req.user?.walletAddress || req.user?.wallet?.address || req.body.voterAddress || '';

    const vote = await Vote.create({
      electionId,
      userId: req.userId,
      voterAddress,
      candidateId,
      transactionHash,
      receiptIpfsHash,
    });

    // Update candidate voteCount in database
    try {
      const candidate = await Candidate.findOne({
        where: {
          electionId: electionId,
          candidateIndex: candidateId
        }
      });

      if (candidate) {
        await candidate.increment('voteCount');
        console.log(`[POST /api/votes] Updated candidate ${candidateId} voteCount for election ${electionId}`);
      } else {
        console.warn(`[POST /api/votes] Candidate not found: electionId=${electionId}, candidateIndex=${candidateId}`);
      }
    } catch (candidateError) {
      console.error(`[POST /api/votes] Failed to update candidate voteCount:`, candidateError);
      // Don't fail the vote creation if candidate update fails
    }

    // Log activity
    try {
      await createActivityLog({
        userId: req.userId,
        action: 'VOTE_CAST',
        details: { electionId, candidateId, transactionHash }
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    res.status(201).json({
      success: true,
      vote
    });
  } catch (error) {
    console.error('Create vote error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vote record'
    });
  }
});

// Get votes for election (Owner/Creator only)
const { requireOwner } = require('../middleware/rbac');
const { requireCreator } = require('../middleware/rbac');
const { isOwner, isCreator } = require('../services/rbacService');

// Helper middleware to check if user is Owner or Creator
const requireOwnerOrCreator = async (req, res, next) => {
  try {
    if (!req.user || !req.user.walletAddress) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please connect your wallet.'
      });
    }

    const walletAddress = req.user.walletAddress;
    
    const [ownerStatus, creatorStatus] = await Promise.all([
      isOwner(walletAddress),
      isCreator(walletAddress)
    ]);

    if (!ownerStatus && !creatorStatus) {
      return res.status(403).json({
        success: false,
        error: 'Only owner or creator can perform this action'
      });
    }

    next();
  } catch (error) {
    console.error('requireOwnerOrCreator middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify role'
    });
  }
};

router.get('/election/:electionId', requireOwnerOrCreator, async (req, res) => {
  try {
    const votes = await Vote.findAll({
      where: { electionId: req.params.electionId },
      include: [{ model: require('../models/User'), as: 'user', attributes: ['id', 'email', 'name'] }],
      order: [['timestamp', 'DESC']],
    });

    res.json({
      success: true,
      votes
    });
  } catch (error) {
    console.error('Get votes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get votes'
    });
  }
});

// Get user's votes
router.get('/my-votes', async (req, res) => {
  try {
    const votes = await Vote.findAll({
      where: { userId: req.userId },
      include: [{ model: Election, as: 'election', attributes: ['id', 'title', 'electionType'] }],
      order: [['timestamp', 'DESC']],
    });

    res.json({
      success: true,
      votes
    });
  } catch (error) {
    console.error('Get my votes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get votes'
    });
  }
});

// Gasless Voting: Relay vote with signature verification
router.post('/relay', [
  body('electionId').isInt(),
  body('candidateId').isInt(),
  body('voterAddress').isString().isLength({ min: 42, max: 42 }).matches(/^0x[a-fA-F0-9]{40}$/),
  body('nonce').isInt(),
  body('deadline').isInt(),
  body('chainId').isInt(),
  body('contractAddress').isString().isLength({ min: 42, max: 42 }).matches(/^0x[a-fA-F0-9]{40}$/),
  body('signature').isString().notEmpty(),
  body('voteHash').isString().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { electionId, candidateId, voterAddress, nonce, deadline, chainId, contractAddress, signature, voteHash } = req.body;

    // Verify user owns the wallet address
    const user = req.user;
    if (user.walletAddress && user.walletAddress.toLowerCase() !== voterAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Wallet address does not match authenticated user'
      });
    }

    // Check if user already voted
    const existingVote = await Vote.findOne({
      where: {
        userId: req.userId,
        electionId,
      }
    });

    if (existingVote) {
      return res.status(400).json({
        success: false,
        error: 'User has already voted in this election'
      });
    }

    // Get election
    const election = await Election.findByPk(electionId);
    if (!election) {
      return res.status(404).json({
        success: false,
        error: 'Election not found'
      });
    }

    if (!election.contractAddress || election.contractAddress.toLowerCase() !== contractAddress.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Contract address mismatch'
      });
    }

    // Verify EIP-712 signature
    const provider = getProvider();
    const network = await provider.getNetwork();
    const actualChainId = Number(network.chainId);

    if (actualChainId !== chainId) {
      return res.status(400).json({
        success: false,
        error: 'Chain ID mismatch'
      });
    }

    // Build EIP-712 domain separator
    const domain = {
      name: 'Election',
      version: '1',
      chainId: chainId,
      verifyingContract: contractAddress,
    };

    const types = {
      VoteIntent: [
        { name: 'electionId', type: 'uint256' },
        { name: 'candidateId', type: 'uint256' },
        { name: 'voterAddress', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'chainId', type: 'uint256' },
        { name: 'contractAddress', type: 'address' },
      ],
    };

    const value = {
      electionId,
      candidateId,
      voterAddress,
      nonce,
      deadline,
      chainId,
      contractAddress,
    };

    try {
      // Verify signature
      const recoveredAddress = ethers.verifyTypedData(domain, types, value, signature);
      
      if (recoveredAddress.toLowerCase() !== voterAddress.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      // Check deadline
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime > deadline) {
        return res.status(400).json({
          success: false,
          error: 'Signature expired'
        });
      }

      // Load contract ABI
      const fs = require('fs');
      const path = require('path');
      const abiPath = path.join(__dirname, '../abi/Election.json');
      let contractABI;
      
      if (fs.existsSync(abiPath)) {
        const abiContent = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        contractABI = abiContent.abi || abiContent;
      } else {
        // Fallback: try to load from artifacts
        const artifactsPath = path.join(__dirname, '../../smartcontract/artifacts/contracts/Election.sol/Election.json');
        if (fs.existsSync(artifactsPath)) {
          const artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
          contractABI = artifacts.abi;
        } else {
          throw new Error('Contract ABI not found');
        }
      }

      // Get relayer signer (system account)
      const relayerSigner = getAdminSigner();
      const contract = new ethers.Contract(contractAddress, contractABI, relayerSigner);

      // Convert voteHash to bytes32
      const voteHashBytes32 = ethers.hexlify(ethers.zeroPadValue(ethers.toUtf8Bytes(voteHash), 32));

      // Call relayVote on smart contract
      const tx = await contract.relayVote(
        candidateId,
        voterAddress,
        nonce,
        deadline,
        voteHashBytes32,
        signature
      );

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      // Create vote record in database
      const vote = await Vote.create({
        electionId,
        userId: req.userId,
        voterAddress,
        candidateId,
        transactionHash: receipt.hash,
        receiptIpfsHash: null, // Can be uploaded to IPFS later
      });

      // Update candidate voteCount in database
      try {
        const candidate = await Candidate.findOne({
          where: {
            electionId: electionId,
            candidateIndex: candidateId
          }
        });

        if (candidate) {
          await candidate.increment('voteCount');
          console.log(`[POST /api/votes/relay] Updated candidate ${candidateId} voteCount for election ${electionId}`);
        } else {
          console.warn(`[POST /api/votes/relay] Candidate not found: electionId=${electionId}, candidateIndex=${candidateId}`);
        }
      } catch (candidateError) {
        console.error(`[POST /api/votes/relay] Failed to update candidate voteCount:`, candidateError);
        // Don't fail the vote creation if candidate update fails
      }

      // Log activity
      try {
        await createActivityLog({
          userId: req.userId,
          action: 'VOTE_RELAYED',
          details: { electionId, candidateId, transactionHash: receipt.hash, method: 'gasless' }
        });
      } catch (err) {
        console.warn('Failed to log activity:', err);
      }

      res.status(201).json({
        success: true,
        message: 'Vote relayed successfully',
        vote,
        transaction: {
          hash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        }
      });
    } catch (error) {
      console.error('Signature verification or transaction error:', error);
      
      // Check if it's a contract revert
      if (error.reason || error.data) {
        return res.status(400).json({
          success: false,
          error: error.reason || 'Transaction failed: ' + error.message
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to relay vote: ' + error.message
      });
    }
  } catch (error) {
    console.error('Relay vote error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to relay vote'
    });
  }
});

module.exports = router;

