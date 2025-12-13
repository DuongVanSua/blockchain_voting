const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireOwner } = require('../middleware/rbac');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get users (Owner only)
router.get('/', requireOwner, async (req, res) => {
  try {
    const User = require('../models/User');
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await User.findAndCountAll({
      attributes: { exclude: ['passwordHash'] },
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
      error: 'Failed to get users'
    });
  }
});

// Get user by ID (Owner only)
router.get('/:id', requireOwner, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user'
    });
  }
});

module.exports = router;

