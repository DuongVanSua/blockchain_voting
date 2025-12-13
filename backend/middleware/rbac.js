const { getRoles, isOwner, isCreator, isElectionCreator } = require('../services/rbacService');

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

    const walletAddress = req.user.walletAddress || req.user.wallet_address;
    const electionAddress = req.params.electionAddress || req.body.electionAddress || req.query.electionAddress;

    if (!electionAddress) {
      return res.status(400).json({
        success: false,
        error: 'Election address is required'
      });
    }

    // Check if user is the creator of this election
    // Pass userId to check database createdBy field
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

