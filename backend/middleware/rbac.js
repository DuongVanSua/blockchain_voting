const { getRoles, isOwner, isCreator, isElectionCreator } = require('../services/rbacService');
const { Op } = require('sequelize');

/**
 * Middleware: Require user to be owner
 * Checks database role first, then smart contract if available
 */
const requireOwner = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // First check: Database role must be OWNER
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Only owner can perform this action'
      });
    }

    // Second check: If wallet address exists, verify smart contract role
    // But don't block if smart contract is not configured
    const walletAddress = req.user.walletAddress || req.user.wallet_address;
    if (walletAddress) {
      try {
        const ownerStatus = await isOwner(walletAddress);
        // If contract is configured and user is not owner, deny access
        // If contract check fails (not deployed), allow based on DB role
        if (ownerStatus === false) {
          // Contract is configured but user is not owner
          return res.status(403).json({
            success: false,
            error: 'Only owner can perform this action'
          });
        }
        // If ownerStatus is true or error (contract not deployed), continue
      } catch (error) {
        // Contract not deployed or error - allow based on database role
        console.warn('Smart contract check failed, allowing based on database role:', error.message);
      }
    }

    req.userRole = 'OWNER';
    next();
  } catch (error) {
    console.error('requireOwner middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify owner role'
    });
  }
};

/**
 * Middleware: Require user to be creator
 * Checks database role first, then smart contract if available
 */
const requireCreator = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // First check: Database role must be CREATOR or OWNER
    if (req.user.role !== 'CREATOR' && req.user.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Only election creators can perform this action'
      });
    }

    // Second check: If wallet address exists, verify smart contract role
    // But don't block if smart contract is not configured
    const walletAddress = req.user.walletAddress || req.user.wallet_address;
    if (walletAddress) {
      try {
        const creatorStatus = await isCreator(walletAddress);
        // If contract is configured and user is not creator, deny access
        // If contract check fails (not deployed), allow based on DB role
        if (creatorStatus === false) {
          // Contract is configured but user is not creator
          return res.status(403).json({
            success: false,
            error: 'Only election creators can perform this action'
          });
        }
        // If creatorStatus is true or null (contract not deployed), continue
      } catch (error) {
        // Contract not deployed or error - allow based on database role
        console.warn('Smart contract check failed, allowing based on database role:', error.message);
      }
    }

    req.userRole = 'CREATOR';
    next();
  } catch (error) {
    console.error('requireCreator middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify creator role'
    });
  }
};

/**
 * Middleware: Require user to be election creator (chairperson)
 */
const requireElectionCreator = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // First check: User must have CREATOR or OWNER role in database
    if (req.user.role !== 'CREATOR' && req.user.role !== 'OWNER') {
      return res.status(403).json({
        success: false,
        error: 'Only election creators can perform this action'
      });
    }

    const electionAddress = req.params.electionAddress || req.body.electionAddress || req.query.electionAddress;

    if (!electionAddress) {
      return res.status(400).json({
        success: false,
        error: 'Election address is required'
      });
    }

    // CRITICAL: Check database first - only allow if election.createdBy === req.userId
    // This is the source of truth since we use admin signer for contract creation
    try {
      const Election = require('../models/Election');
      const dbElection = await Election.findOne({
        where: {
          [Op.or]: [
            { contractAddress: electionAddress.toLowerCase() },
            { contractAddress: electionAddress }
          ]
        }
      });

      if (!dbElection) {
        return res.status(404).json({
          success: false,
          error: 'Election not found'
        });
      }

      // Check if current user is the creator (from database)
      // Convert both to numbers for comparison (handle string vs number mismatch)
      const electionCreatorId = Number(dbElection.createdBy);
      const currentUserId = Number(req.userId);
      
      // eslint-disable-next-line no-console
      console.log(`[requireElectionCreator] Checking election ownership:`, {
        electionAddress,
        electionCreatorId,
        currentUserId,
        electionCreatorIdType: typeof dbElection.createdBy,
        currentUserIdType: typeof req.userId,
        match: electionCreatorId === currentUserId
      });
      
      if (electionCreatorId !== currentUserId) {
        // eslint-disable-next-line no-console
        console.warn(`[requireElectionCreator] User ${currentUserId} (type: ${typeof req.userId}) is not creator of election ${electionAddress}. Election createdBy: ${electionCreatorId} (type: ${typeof dbElection.createdBy})`);
        return res.status(403).json({
          success: false,
          error: 'Only election creator can perform this action'
        });
      }

      // Store election in request for later use
      req.election = dbElection;
      req.userRole = 'ELECTION_CREATOR';
      req.electionAddress = electionAddress;
      next();
      return;
    } catch (dbError) {
      console.error('[requireElectionCreator] Database check error:', dbError);
      // Fallback to contract check if database check fails
    }

    // Fallback: Check smart contract (if database check failed)
    const walletAddress = req.user.walletAddress || req.user.wallet_address;
    const creatorStatus = await isElectionCreator(electionAddress, walletAddress, req.userId);

    if (!creatorStatus) {
      console.warn(`[requireElectionCreator] User ${req.userId} (${walletAddress}) is not creator of election ${electionAddress}`);
      return res.status(403).json({
        success: false,
        error: 'Only election creator can perform this action'
      });
    }

    req.userRole = 'ELECTION_CREATOR';
    req.electionAddress = electionAddress;
    next();
  } catch (error) {
    console.error('requireElectionCreator middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify election creator role'
    });
  }
};

/**
 * Middleware: Optional - attach roles to request
 */
const attachRoles = async (req, res, next) => {
  try {
    if (req.user && req.user.walletAddress) {
      const roles = await getRoles(req.user.walletAddress);
      req.userRoles = roles;
    }
    next();
  } catch (error) {
    console.error('attachRoles middleware error:', error);
    // Don't fail request, just continue without roles
    next();
  }
};

module.exports = {
  requireOwner,
  requireCreator,
  requireElectionCreator,
  attachRoles
};

