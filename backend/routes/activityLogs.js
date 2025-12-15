const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getOwnerLogs, getCreatorLogs, getVoterLogs } = require('../services/activityLogService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/activity-logs/logs
router.get('/logs', async (req, res) => {
  try {
    const { role } = req.user || {};
    // Fallback for wallet address fields
    const walletAddress =
      req.user?.walletAddress ||
      req.user?.wallet_address ||
      req.user?.wallet ||
      null;

    const {
      fromBlock,
      toBlock,
      limit = 50,
      offset = 0,
    } = req.query;

    let logs = [];
    if (role === 'OWNER') {
      logs = await getOwnerLogs({
        fromBlock: fromBlock ? Number(fromBlock) : undefined,
        toBlock: toBlock ? Number(toBlock) : undefined,
      });
    } else if (role === 'CREATOR') {
      if (!walletAddress) {
        return res.json({ success: true, logs: [], total: 0, hasMore: false, message: 'Missing wallet address' });
      }
      logs = await getCreatorLogs(walletAddress, {
        fromBlock: fromBlock ? Number(fromBlock) : undefined,
        toBlock: toBlock ? Number(toBlock) : undefined,
      });
    } else if (role === 'VOTER') {
      if (!walletAddress) {
        return res.json({ success: true, logs: [], total: 0, hasMore: false, message: 'Missing wallet address' });
      }
      logs = await getVoterLogs(walletAddress, {
        fromBlock: fromBlock ? Number(fromBlock) : undefined,
        toBlock: toBlock ? Number(toBlock) : undefined,
      });
    } else {
      return res.status(403).json({ success: false, error: 'Unauthorized role' });
    }

    const total = logs.length;
    const start = Number(offset) || 0;
    const end = start + (Number(limit) || 50);
    const slice = logs.slice(start, end);

    // Disable caching for activity logs (always fresh data from blockchain)
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      logs: slice,
      total,
      hasMore: end < total,
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity logs' });
  }
});

module.exports = router;

