const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireOwner } = require('../middleware/rbac');
const { getActivityLogs } = require('../services/activityService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get activity logs (Owner only)
router.get('/', requireOwner, async (req, res) => {
  try {
    const { page = 1, limit = 50, user_id } = req.query;

    const result = await getActivityLogs({
      userId: user_id ? parseInt(user_id) : undefined,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get activities'
    });
  }
});

module.exports = router;

