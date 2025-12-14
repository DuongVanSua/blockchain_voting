const express = require('express');
const { query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { getElections, getElection } = require('../services/electionService');
const Election = require('../models/Election');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get elections
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['ONGOING', 'PAUSED']),
], async (req, res) => {
  try {
    const { page = 1, limit = 100, status, createdBy } = req.query;

    const result = await getElections({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      createdBy: createdBy || (req.user.role === 'CREATOR' || req.user.role === 'OWNER' ? undefined : req.userId),
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get elections'
    });
  }
});

// Get election by contract address (must be before /:id route)
router.get('/by-contract/:contractAddress', async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    const election = await Election.findOne({
      where: { contractAddress }
    });
    
    if (!election) {
      return res.status(404).json({
        success: false,
        error: 'Election not found'
      });
    }

    res.json({
      success: true,
      election
    });
  } catch (error) {
    console.error('Get election by contract error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get election'
    });
  }
});

// Get election by ID
router.get('/:id', async (req, res) => {
  try {
    const election = await getElection(req.params.id);
    
    if (!election) {
      return res.status(404).json({
        success: false,
        error: 'Election not found'
      });
    }

    res.json({
      success: true,
      election
    });
  } catch (error) {
    console.error('Get election error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get election'
    });
  }
});

module.exports = router;

