const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const config = require('../config/config');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const { createActivityLog } = require('../services/activityService');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password, name, phone, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      name,
      phone,
      role: role || 'VOTER',
    });

    // Create tokens
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: `${config.jwt.accessTokenExpireMinutes}m` }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: `${config.jwt.refreshTokenExpireDays}d` }
    );

    // Log activity
    try {
      await createActivityLog({
        userId: user.id,
        action: 'USER_REGISTERED',
        details: { email: user.email, role: user.role }
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: config.jwt.accessTokenExpireMinutes * 60,
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isValidPassword = await user.checkPassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive || user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: 'Account is inactive or blocked'
      });
    }

    // Create tokens
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: `${config.jwt.accessTokenExpireMinutes}m` }
    );

    const refreshToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: `${config.jwt.refreshTokenExpireDays}d` }
    );

    // Log activity
    try {
      await createActivityLog({
        userId: user.id,
        action: 'USER_LOGIN',
        details: { email: user.email }
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    // Get roles from smart contract
    let roles = {
      isOwner: false,
      isCreator: false,
      address: user.walletAddress
    };

    if (user.walletAddress) {
      try {
        const { getRoles } = require('../services/rbacService');
        roles = await getRoles(user.walletAddress);
      } catch (roleError) {
        console.warn('Failed to get roles from smart contract:', roleError);
        // Continue without roles
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        ...roles
      },
      token: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: config.jwt.accessTokenExpireMinutes * 60,
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Get current user with roles from smart contract
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get roles from smart contract (optional, don't fail if contract not deployed)
    // Initialize with undefined to allow contract roles to override
    let roles = {
      isOwner: undefined,
      isCreator: undefined,
      address: user.walletAddress || null
    };

    if (user.walletAddress) {
      try {
        const { getRoles } = require('../services/rbacService');
        const contractRoles = await getRoles(user.walletAddress);
        // Merge contract roles, preserving undefined values to indicate contract not available
        roles = {
          ...roles,
          ...contractRoles
        };
      } catch (roleError) {
        // Log but don't fail - contract may not be deployed
        if (roleError.code !== 'BAD_DATA' && !roleError.message?.includes('could not decode')) {
          console.warn('Failed to get roles from smart contract:', roleError.message);
        }
        // Continue without contract roles - database role is the source of truth
        // Keep roles as undefined to indicate contract not available
      }
    }

    // Disable caching for dynamic user data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Always return user with database role as primary
    // Contract roles (isOwner, isCreator) are supplementary
    res.json({
      success: true,
      user: {
        ...user.toJSON(),
        ...roles
        // Note: user.role from database is the primary role
        // isOwner and isCreator from contract are supplementary checks
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
});

// Update wallet address
router.put('/wallet', authenticate, [
  body('walletAddress').isString().isLength({ min: 42, max: 42 }).matches(/^0x[a-fA-F0-9]{40}$/),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { walletAddress } = req.body;
    const userId = req.userId;

    // Normalize wallet address to lowercase for consistency
    const normalizedAddress = walletAddress.toLowerCase();

    // Update user's wallet address
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Check if address is already the same (case-insensitive)
    if (user.walletAddress && user.walletAddress.toLowerCase() === normalizedAddress) {
      console.log(`[PUT /api/auth/wallet] Wallet address unchanged for user ${userId}: ${normalizedAddress}`);
      return res.json({
        success: true,
        message: 'Wallet address unchanged',
        user: {
          ...user.toJSON(),
          walletAddress: normalizedAddress
        }
      });
    }

    // Check if wallet address is already used by another user (case-insensitive)
    const existingUser = await User.findOne({ 
      where: { 
        [Op.and]: [
          {
            [Op.or]: [
              { walletAddress: normalizedAddress },
              { walletAddress: walletAddress } // Also check original case
            ]
          },
          { id: { [Op.ne]: userId } }
        ]
      } 
    });

    if (existingUser) {
      console.log(`[PUT /api/auth/wallet] Wallet address ${normalizedAddress} already used by user ${existingUser.id}`);
      return res.status(400).json({
        success: false,
        error: 'Wallet address is already associated with another account'
      });
    }

    console.log(`[PUT /api/auth/wallet] Updating wallet address for user ${userId}: ${user.walletAddress || 'null'} -> ${normalizedAddress}`);
    
    user.walletAddress = normalizedAddress;
    await user.save();
    
    console.log(`[PUT /api/auth/wallet] Successfully updated wallet address for user ${userId}: ${normalizedAddress}`);

    // Reload user from database to get latest data
    await user.reload();

    // Log activity
    try {
      await createActivityLog({
        userId: user.id,
        action: 'WALLET_CONNECTED',
        details: { walletAddress: normalizedAddress }
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    res.json({
      success: true,
      message: 'Wallet address updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
      }
    });
  } catch (error) {
    console.error('Update wallet error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update wallet address'
    });
  }
});

// Refresh token
router.post('/refresh', [
  body('refresh_token').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { refresh_token } = req.body;

    try {
      const decoded = jwt.verify(refresh_token, config.jwt.secret);
      
      const user = await User.findByPk(decoded.sub);
      if (!user || !user.isActive || user.isBlocked) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }

      const accessToken = jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        config.jwt.secret,
        { expiresIn: `${config.jwt.accessTokenExpireMinutes}m` }
      );

      res.json({
        success: true,
        token: {
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: config.jwt.accessTokenExpireMinutes * 60,
        }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
});

// Logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Log activity
    try {
      await createActivityLog({
        userId: req.userId,
        action: 'USER_LOGOUT',
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Get nonce for SIWE (Sign-In With Ethereum)
router.get('/nonce', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate random nonce
    const crypto = require('crypto');
    const nonce = crypto.randomBytes(32).toString('hex');

    // Save nonce to user
    user.nonce = nonce;
    await user.save();

    // SIWE message format
    const domain = process.env.SIWE_DOMAIN || 'localhost:5173';
    const origin = process.env.SIWE_ORIGIN || 'http://localhost:5173';
    const statement = 'Sign in with Ethereum to the app.';
    const chainId = process.env.CHAIN_ID || '31337';

    const message = `${domain} wants you to sign in with your Ethereum account:\n${user.walletAddress || '0x0000000000000000000000000000000000000000'}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

    res.json({
      success: true,
      nonce,
      message,
      domain,
      origin,
      statement,
      chainId,
    });
  } catch (error) {
    console.error('Get nonce error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate nonce'
    });
  }
});

// Verify signature and bind wallet address (SIWE)
router.post('/verify-signature', authenticate, [
  body('walletAddress').isString().isLength({ min: 42, max: 42 }).matches(/^0x[a-fA-F0-9]{40}$/),
  body('signature').isString().notEmpty(),
  body('nonce').isString().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { walletAddress, signature, nonce } = req.body;
    const user = await User.findByPk(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify nonce
    if (user.nonce !== nonce) {
      return res.status(400).json({
        success: false,
        error: 'Invalid nonce'
      });
    }

    // Verify signature using ethers
    const { ethers } = require('ethers');
    const domain = process.env.SIWE_DOMAIN || 'localhost:5173';
    const origin = process.env.SIWE_ORIGIN || 'http://localhost:5173';
    const statement = 'Sign in with Ethereum to the app.';
    const chainId = process.env.CHAIN_ID || '31337';

    const message = `${domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

    try {
      // Recover address from signature
      const messageHash = ethers.hashMessage(message);
      const recoveredAddress = ethers.recoverAddress(messageHash, signature);

      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      // Check if wallet address is already used by another user
      const existingUser = await User.findOne({
        where: {
          walletAddress,
          id: { [Op.ne]: user.id }
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Wallet address is already associated with another account'
        });
      }

      // Bind wallet address to user
      user.walletAddress = walletAddress;
      user.nonce = null; // Clear nonce after successful verification
      await user.save();

      // Log activity
      try {
        await createActivityLog({
          userId: user.id,
          action: 'WALLET_VERIFIED',
          details: { walletAddress, method: 'SIWE' }
        });
      } catch (err) {
        console.warn('Failed to log activity:', err);
      }

      res.json({
        success: true,
        message: 'Wallet address verified and bound successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          walletAddress: user.walletAddress,
        }
      });
    } catch (error) {
      console.error('Signature verification error:', error);
      return res.status(400).json({
        success: false,
        error: 'Failed to verify signature: ' + error.message
      });
    }
  } catch (error) {
    console.error('Verify signature error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify signature'
    });
  }
});

module.exports = router;

