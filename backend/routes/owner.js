const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireOwner } = require('../middleware/rbac');
const { getElectionFactory, isSystemPaused, getVoterRegistry } = require('../services/rbacService');
const { getAdminSigner } = require('../config/blockchain');
const { ethers } = require('ethers');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication and owner role
router.use(authenticate);
router.use(requireOwner);

/**
 * GET /api/owner/status
 * Get system status (paused/unpaused)
 */
router.get('/status', async (req, res) => {
  try {
    const paused = await isSystemPaused();
    res.json({
      success: true,
      isPaused: paused
    });
  } catch (error) {
    console.error('Get system status error:', error);
    // Return success with default value if contract not deployed
    if (error.message?.includes('Deployment file not found') || error.message?.includes('not found')) {
      res.json({
        success: true,
        isPaused: false,
        warning: 'Smart contract not deployed. Using default values.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get system status'
      });
    }
  }
});

/**
 * POST /api/owner/pause
 * Pause the entire system (emergency)
 */
router.post('/pause', async (req, res) => {
  try {
    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);
    
    const tx = await factoryWithSigner.pause();
    await tx.wait();
    
    res.json({
      success: true,
      message: 'System paused successfully',
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Pause system error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to pause system'
    });
  }
});

/**
 * POST /api/owner/unpause
 * Unpause the system
 */
router.post('/unpause', async (req, res) => {
  try {
    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);
    
    const tx = await factoryWithSigner.unpause();
    await tx.wait();
    
    res.json({
      success: true,
      message: 'System unpaused successfully',
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Unpause system error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to unpause system'
    });
  }
});

/**
 * GET /api/owner/creators
 * Get all election creators
 */
router.get('/creators', async (req, res) => {
  try {
    const factory = await getElectionFactory();
    console.log('[GET /api/owner/creators] Fetching creators from smart contract...');
    
    const creatorAddresses = await factory.getAllCreators();
    console.log(`[GET /api/owner/creators] getAllCreators() returned ${creatorAddresses.length} addresses:`, creatorAddresses);
    
    // Deduplicate addresses (case-insensitive)
    const uniqueAddresses = [...new Set(creatorAddresses.map(addr => addr.toLowerCase()))];
    console.log(`[GET /api/owner/creators] Unique addresses after deduplication: ${uniqueAddresses.length}`);
    
    // Get creator details
    const creators = await Promise.all(
      uniqueAddresses.map(async (address) => {
        // Use original case from smart contract if available, otherwise use lowercase
        const originalAddress = creatorAddresses.find(addr => addr.toLowerCase() === address) || address;
        const isCreator = await factory.isCreator(originalAddress);
        console.log(`[GET /api/owner/creators] Address ${originalAddress}: isCreator = ${isCreator}`);
        return {
          address: originalAddress,
          isCreator
        };
      })
    );
    
    const validCreators = creators.filter(c => c.isCreator);
    console.log(`[GET /api/owner/creators] Returning ${validCreators.length} valid creators`);
    
    res.json({
      success: true,
      creators: validCreators
    });
  } catch (error) {
    console.error('Get creators error:', error);
    // Return success with empty array if contract not deployed
    if (error.message?.includes('Deployment file not found') || error.message?.includes('not found')) {
      res.json({
        success: true,
        creators: [],
        warning: 'Smart contract not deployed. No creators available.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get creators'
      });
    }
  }
});

/**
 * POST /api/owner/creators
 * Add a new election creator
 */
router.post('/creators', [
  body('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address } = req.body;
    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);
    
    const tx = await factoryWithSigner.addCreator(address);
    await tx.wait();
    
    // Update user role in database if user exists with this wallet address
    try {
      const user = await User.findOne({ 
        where: { 
          walletAddress: address.toLowerCase() 
        } 
      });
      
      if (user && user.role !== 'CREATOR' && user.role !== 'OWNER') {
        user.role = 'CREATOR';
        await user.save();
        console.log(`Updated user role to CREATOR for wallet ${address}`);
      }
    } catch (dbError) {
      // Log error but don't fail the request - smart contract update succeeded
      console.warn('Failed to update user role in database:', dbError.message);
    }
    
    res.json({
      success: true,
      message: 'Creator added successfully',
      address,
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Add creator error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to add creator'
    });
  }
});

/**
 * DELETE /api/owner/creators/:address
 * Remove an election creator
 */
router.delete('/creators/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }

    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);
    
    const tx = await factoryWithSigner.removeCreator(address);
    await tx.wait();
    
    // Update user role in database if user exists with this wallet address
    try {
      const user = await User.findOne({ 
        where: { 
          walletAddress: address.toLowerCase() 
        } 
      });
      
      if (user && user.role === 'CREATOR') {
        // Only downgrade if user is not OWNER
        if (user.role !== 'OWNER') {
          user.role = 'VOTER';
          await user.save();
          console.log(`Updated user role to VOTER for wallet ${address}`);
        }
      }
    } catch (dbError) {
      // Log error but don't fail the request - smart contract update succeeded
      console.warn('Failed to update user role in database:', dbError.message);
    }
    
    res.json({
      success: true,
      message: 'Creator removed successfully',
      address,
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Remove creator error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to remove creator'
    });
  }
});

/**
 * GET /api/owner/config
 * Get system configuration
 */
router.get('/config', async (req, res) => {
  try {
    const factory = await getElectionFactory();
    const registry = await getVoterRegistry();
    
    const [owner, voterRegistry, votingToken, minVotingAge] = await Promise.all([
      factory.owner(),
      factory.voterRegistry(),
      factory.votingToken(),
      registry.minVotingAge()
    ]);
    
    res.json({
      success: true,
      config: {
        owner,
        voterRegistry,
        votingToken,
        minVotingAge: minVotingAge.toString()
      }
    });
  } catch (error) {
    console.error('Get system config error:', error);
    // Return success with null config if contract not deployed
    if (error.message?.includes('Deployment file not found') || error.message?.includes('not found')) {
      res.json({
        success: true,
        config: null,
        warning: 'Smart contract not deployed. Configuration not available.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get system configuration'
      });
    }
  }
});

/**
 * PUT /api/owner/config/voter-registry
 * Update VoterRegistry address
 */
router.put('/config/voter-registry', [
  body('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address } = req.body;
    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);
    
    const tx = await factoryWithSigner.updateVoterRegistry(address);
    await tx.wait();
    
    res.json({
      success: true,
      message: 'VoterRegistry updated successfully',
      address,
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Update VoterRegistry error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to update VoterRegistry'
    });
  }
});

/**
 * PUT /api/owner/config/voting-token
 * Update VotingToken address
 */
router.put('/config/voting-token', [
  body('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address } = req.body;
    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);
    
    const tx = await factoryWithSigner.updateVotingToken(address);
    await tx.wait();
    
    res.json({
      success: true,
      message: 'VotingToken updated successfully',
      address,
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Update VotingToken error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to update VotingToken'
    });
  }
});

/**
 * PUT /api/owner/config/transfer-ownership
 * Transfer ownership of ElectionFactory
 */
router.put('/config/transfer-ownership', [
  body('address').isString().matches(/^0x[a-fA-F0-9]{40}$/).withMessage('Invalid Ethereum address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address } = req.body;
    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);
    
    const tx = await factoryWithSigner.transferOwnership(address);
    await tx.wait();
    
    res.json({
      success: true,
      message: 'Ownership transferred successfully',
      newOwner: address,
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to transfer ownership'
    });
  }
});

/**
 * PUT /api/owner/config/min-voting-age
 * Update minimum voting age in VoterRegistry
 */
router.put('/config/min-voting-age', [
  body('age').isInt({ min: 1, max: 150 }).withMessage('Age must be between 1 and 150')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { age } = req.body;
    const registry = await getVoterRegistry();
    const signer = getAdminSigner();
    const registryWithSigner = registry.connect(signer);
    
    const tx = await registryWithSigner.updateMinVotingAge(age);
    await tx.wait();
    
    res.json({
      success: true,
      message: 'Minimum voting age updated successfully',
      minVotingAge: age,
      transactionHash: tx.hash
    });
  } catch (error) {
    console.error('Update min voting age error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to update minimum voting age'
    });
  }
});

module.exports = router;

