const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireOwner } = require('../middleware/rbac');
const { User, Election, KYCSubmission } = require('../models/index');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get dashboard statistics (Owner only)
router.get('/statistics', requireOwner, async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.count();
    const votersCount = await User.count({ where: { role: 'VOTER' } });
    const creatorsCount = await User.count({ where: { role: 'CREATOR' } });
    const ownersCount = await User.count({ where: { role: 'OWNER' } });
    
    // KYC statistics
    const approvedKYC = await User.count({ where: { kycStatus: 'APPROVED' } });
    const pendingKYC = await User.count({ where: { kycStatus: 'PENDING' } });
    const rejectedKYC = await User.count({ where: { kycStatus: 'REJECTED' } });
    
    // Election statistics
    const totalElections = await Election.count();
    const activeElections = await Election.count({ 
      where: { 
        status: 'LIVE' 
      } 
    });
    const completedElections = await Election.count({ 
      where: { 
        status: 'CLOSED' 
      } 
    });
    
    // Get active elections list
    const activeElectionsList = await Election.findAll({
      where: { status: 'LIVE' },
      attributes: ['id', 'title', 'description', 'startTime', 'endTime', 'status'],
      limit: 10,
      order: [['startTime', 'DESC']],
    });

    res.json({
      success: true,
      total_users: totalUsers,
      voters_count: votersCount,
      creators_count: creatorsCount,
      owners_count: ownersCount,
      approved_kyc: approvedKYC,
      pending_kyc: pendingKYC,
      rejected_kyc: rejectedKYC,
      total_elections: totalElections,
      active_elections: activeElections,
      completed_elections: completedElections,
      active_elections_list: activeElectionsList.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        start_time: e.startTime,
        end_time: e.endTime,
        status: e.status,
      })),
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      details: error.message,
    });
  }
});

module.exports = router;

