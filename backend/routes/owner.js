const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireOwner } = require('../middleware/rbac');
const { getElectionFactory, isSystemPaused, getVoterRegistry } = require('../services/rbacService');
const { getAdminSigner, loadContractABI } = require('../config/blockchain');
const { ethers } = require('ethers');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

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
    
    // Normalize address to lowercase for consistency
    const normalizedAddress = address.toLowerCase();
    
    // Step 1: Add to ElectionFactory as creator
    console.log(`[POST /api/owner/creators] Step 1: Adding ${normalizedAddress} as creator in ElectionFactory...`);
    const creatorTx = await factoryWithSigner.addCreator(normalizedAddress);
    console.log(`[POST /api/owner/creators] Creator transaction sent: ${creatorTx.hash}`);
    const creatorReceipt = await creatorTx.wait();
    console.log(`[POST /api/owner/creators] ✅ Creator transaction confirmed in block ${creatorReceipt.blockNumber}`);
    
    // Step 2: Wait a bit to ensure nonce is updated (for Hardhat/localhost)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 3: Get fresh signer to ensure correct nonce tracking
    const freshSigner = getAdminSigner();
    
    // Update user role in database if user exists with this wallet address
    try {
      const user = await User.findOne({ 
        where: { 
          walletAddress: address.toLowerCase() 
        } 
      });
      
      if (user && user.role !== 'CREATOR' && user.role !== 'OWNER') {
        const oldRole = user.role;
        user.role = 'CREATOR';
        await user.save();
        console.log(`Updated user role to CREATOR for wallet ${address}`);
        
        // Also add as minter in VotingToken contract
        try {
          const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
          if (fs.existsSync(deploymentPath)) {
            const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            const votingTokenAddress = deployment.contracts?.VotingToken;
            
            if (votingTokenAddress) {
              const votingTokenABI = loadContractABI('VotingToken');
              const votingTokenContract = new ethers.Contract(votingTokenAddress, votingTokenABI, signer);
              
              // Normalize address to lowercase for consistency
              const normalizedAddress = address.toLowerCase();
              console.log(`[POST /api/owner/creators] Checking minter status for: ${normalizedAddress}`);
              
              // Check if already a minter
              const isMinter = await votingTokenContract.minters(normalizedAddress);
              console.log(`[POST /api/owner/creators] Is minter: ${isMinter}`);
              
              if (!isMinter) {
                console.log(`[POST /api/owner/creators] Adding ${normalizedAddress} as minter...`);
                const mintTx = await votingTokenContract.addMinter(normalizedAddress);
                console.log(`[POST /api/owner/creators] Transaction sent: ${mintTx.hash}`);
                await mintTx.wait();
                console.log(`[POST /api/owner/creators] ✅ Successfully added ${normalizedAddress} as minter in VotingToken contract`);
                
                // Verify it was added
                const verifyMinter = await votingTokenContract.minters(normalizedAddress);
                if (verifyMinter) {
                  console.log(`[POST /api/owner/creators] ✅ Verified: ${normalizedAddress} is now a minter`);
                } else {
                  console.error(`[POST /api/owner/creators] ❌ ERROR: Verification failed - ${normalizedAddress} is NOT a minter after addMinter`);
                }
              } else {
                console.log(`[POST /api/owner/creators] ${normalizedAddress} is already a minter in VotingToken contract`);
              }
            } else {
              console.error(`[POST /api/owner/creators] ❌ VotingToken address not found in deployment file.`);
            }
          } else {
            console.error(`[POST /api/owner/creators] ❌ Deployment file not found.`);
          }
        } catch (minterError) {
          // Log full error details
          console.error(`[POST /api/owner/creators] ❌ Failed to add minter in VotingToken:`, {
            message: minterError.message,
            code: minterError.code,
            reason: minterError.reason,
            stack: minterError.stack
          });
        }
      }
    } catch (dbError) {
      // Log error but don't fail the request - smart contract update succeeded
      console.warn('Failed to update user role in database:', dbError.message);
    }
    
    res.json({
      success: true,
      message: 'Creator added successfully',
      address: normalizedAddress,
      transactionHash: creatorTx.hash
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

/**
 * GET /api/owner/users
 * Get all users with optional search and role filter
 */
router.get('/users', async (req, res) => {
  try {
    const { search, role, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    
    // Filter by role if provided
    if (role && ['VOTER', 'CREATOR', 'OWNER'].includes(role.toUpperCase())) {
      where.role = role.toUpperCase();
    }
    
    // Search by name or email
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      attributes: { exclude: ['passwordHash'] },
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      users: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit),
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get users'
    });
  }
});

/**
 * PUT /api/owner/users/:userId/role
 * Update user role (VOTER <-> CREATOR)
 */
router.put('/users/:userId/role', [
  body('role').isIn(['VOTER', 'CREATOR']).withMessage('Role must be VOTER or CREATOR')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Cannot change OWNER role
    if (user.role === 'OWNER') {
      return res.status(400).json({
        success: false,
        error: 'Cannot change OWNER role'
      });
    }

    // Cannot change to OWNER role
    if (role === 'OWNER') {
      return res.status(400).json({
        success: false,
        error: 'Cannot set role to OWNER via this endpoint'
      });
    }

    const oldRole = user.role;
    const factory = await getElectionFactory();
    const signer = getAdminSigner();
    const factoryWithSigner = factory.connect(signer);

    // If user has wallet address, update smart contract
    if (user.walletAddress) {
      try {
        if (role === 'CREATOR' && oldRole !== 'CREATOR') {
          // Normalize wallet address to lowercase for consistency
          const normalizedWalletAddress = user.walletAddress.toLowerCase();
          
          // Step 1: Add to ElectionFactory as creator
          console.log(`[PUT /api/owner/users/${userId}/role] Step 1: Adding ${normalizedWalletAddress} as creator in ElectionFactory...`);
          const creatorTx = await factoryWithSigner.addCreator(normalizedWalletAddress);
          console.log(`[PUT /api/owner/users/${userId}/role] Creator transaction sent: ${creatorTx.hash}`);
          const creatorReceipt = await creatorTx.wait();
          console.log(`[PUT /api/owner/users/${userId}/role] ✅ Creator transaction confirmed in block ${creatorReceipt.blockNumber}`);
          
          // Step 2: Wait a bit to ensure nonce is updated (for Hardhat/localhost)
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Step 3: Get fresh signer to ensure correct nonce tracking
          const freshSigner = getAdminSigner();
          
          // Step 4: Add as minter in VotingToken contract
          try {
            const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
            console.log(`[PUT /api/owner/users/${userId}/role] Step 2: Checking deployment file at: ${deploymentPath}`);
            
            if (fs.existsSync(deploymentPath)) {
              const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
              const votingTokenAddress = deployment.contracts?.VotingToken;
              
              console.log(`[PUT /api/owner/users/${userId}/role] VotingToken address from deployment: ${votingTokenAddress}`);
              
              if (votingTokenAddress) {
                const votingTokenABI = loadContractABI('VotingToken');
                const votingTokenContract = new ethers.Contract(votingTokenAddress, votingTokenABI, freshSigner);
                
                console.log(`[PUT /api/owner/users/${userId}/role] Checking minter status for: ${normalizedWalletAddress}`);
                
                // Check if already a minter
                const isMinter = await votingTokenContract.minters(normalizedWalletAddress);
                console.log(`[PUT /api/owner/users/${userId}/role] Is minter: ${isMinter}`);
                
                if (!isMinter) {
                  console.log(`[PUT /api/owner/users/${userId}/role] Adding ${normalizedWalletAddress} as minter...`);
                  
                  // Get current nonce to ensure we use the correct one
                  const provider = freshSigner.provider;
                  const currentNonce = await provider.getTransactionCount(await freshSigner.getAddress(), 'pending');
                  console.log(`[PUT /api/owner/users/${userId}/role] Current nonce: ${currentNonce}`);
                  
                  const mintTx = await votingTokenContract.addMinter(normalizedWalletAddress);
                  console.log(`[PUT /api/owner/users/${userId}/role] Minter transaction sent: ${mintTx.hash}`);
                  const mintReceipt = await mintTx.wait();
                  console.log(`[PUT /api/owner/users/${userId}/role] ✅ Minter transaction confirmed in block ${mintReceipt.blockNumber}`);
                  
                  // Verify it was added
                  const verifyMinter = await votingTokenContract.minters(normalizedWalletAddress);
                  if (verifyMinter) {
                    console.log(`[PUT /api/owner/users/${userId}/role] ✅ Verified: ${normalizedWalletAddress} is now a minter`);
                  } else {
                    console.error(`[PUT /api/owner/users/${userId}/role] ❌ ERROR: Verification failed - ${normalizedWalletAddress} is NOT a minter after addMinter`);
                  }
                } else {
                  console.log(`[PUT /api/owner/users/${userId}/role] ${normalizedWalletAddress} is already a minter in VotingToken contract`);
                }
              } else {
                console.error(`[PUT /api/owner/users/${userId}/role] ❌ VotingToken address not found in deployment file. Deployment:`, JSON.stringify(deployment, null, 2));
              }
            } else {
              console.error(`[PUT /api/owner/users/${userId}/role] ❌ Deployment file not found at: ${deploymentPath}`);
            }
          } catch (minterError) {
            // Log full error details
            console.error(`[PUT /api/owner/users/${userId}/role] ❌ Failed to add minter in VotingToken:`, {
              message: minterError.message,
              code: minterError.code,
              reason: minterError.reason,
              stack: minterError.stack
            });
            // Still continue with database update
          }
        } else if (role === 'VOTER' && oldRole === 'CREATOR') {
          // Remove from ElectionFactory as creator
          const tx = await factoryWithSigner.removeCreator(user.walletAddress);
          await tx.wait();
          console.log(`Removed ${user.walletAddress} as creator from ElectionFactory`);
          
          // Also remove as minter in VotingToken contract (optional - you may want to keep them as minter)
          // Uncomment below if you want to remove minter role when downgrading to VOTER
          /*
          try {
            const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
            if (fs.existsSync(deploymentPath)) {
              const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
              const votingTokenAddress = deployment.contracts?.VotingToken;
              
              if (votingTokenAddress) {
                const votingTokenABI = loadContractABI('VotingToken');
                const votingTokenContract = new ethers.Contract(votingTokenAddress, votingTokenABI, signer);
                
                // Check if is a minter
                const isMinter = await votingTokenContract.minters(user.walletAddress);
                if (isMinter) {
                  const removeTx = await votingTokenContract.removeMinter(user.walletAddress);
                  await removeTx.wait();
                  console.log(`Removed ${user.walletAddress} as minter from VotingToken contract`);
                }
              }
            }
          } catch (minterError) {
            console.warn('Failed to remove minter from VotingToken:', minterError.message);
          }
          */
        }
      } catch (contractError) {
        // If contract not deployed, log warning but continue with database update
        console.warn('Smart contract update failed:', contractError.message);
        // Still update database role
      }
    }

    // Update database role
    user.role = role;
    await user.save();
    
    // Reload user from database to ensure we have the latest data
    await user.reload();

    console.log(`[PUT /api/owner/users/${userId}/role] User role updated from ${oldRole} to ${role}`);
    console.log(`[PUT /api/owner/users/${userId}/role] User data after update:`, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      walletAddress: user.walletAddress
    });

    res.json({
      success: true,
      message: `User role updated from ${oldRole} to ${role}`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress
      }
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      error: error.reason || error.message || 'Failed to update user role'
    });
  }
});

module.exports = router;

