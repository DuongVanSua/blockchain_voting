const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireOwner } = require('../middleware/rbac');
const { submitKYC, getKYCStatus, approveKYC, rejectKYC, getPendingKYC } = require('../services/kycService');
const { createActivityLog } = require('../services/activityService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Submit KYC
router.post('/submit', [
  body('nationalId').notEmpty().withMessage('National ID is required'),
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('dateOfBirth').isISO8601().withMessage('Date of birth must be a valid ISO8601 date'),
  body('address').notEmpty().withMessage('Address is required'),
  body('email').isEmail().withMessage('Email must be valid'),
  body('idFrontHash').notEmpty().withMessage('ID front hash is required'),
  body('idBackHash').notEmpty().withMessage('ID back hash is required'),
  body('photoHash').notEmpty().withMessage('Photo hash is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const submission = await submitKYC(req.userId, req.body);

    // Log activity
    try {
      await createActivityLog({
        userId: req.userId,
        action: 'KYC_SUBMITTED',
        details: { submissionId: submission.id }
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    res.status(201).json({
      success: true,
      submission: {
        id: submission.id,
        status: submission.status,
        ipfsHash: submission.ipfsHash,
      }
    });
  } catch (error) {
    console.error('Submit KYC error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit KYC'
    });
  }
});

// Get KYC status
router.get('/status', async (req, res) => {
  try {
    const status = await getKYCStatus(req.userId);
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Get KYC status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get KYC status'
    });
  }
});

// Get pending KYC (Owner only - using RBAC)
router.get('/pending', requireOwner, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const submissions = await getPendingKYC(limit);
    
    res.json({
      success: true,
      submissions
    });
  } catch (error) {
    console.error('Get pending KYC error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pending KYC'
    });
  }
});

// Approve KYC (Owner only - using RBAC)
router.post('/:id/approve', requireOwner, [
  body('adminNotes').optional(),
], async (req, res) => {
  try {
    const submission = await approveKYC(req.params.id, req.userId, req.body.adminNotes);

    // Log activity
    try {
      await createActivityLog({
        userId: req.userId,
        action: 'KYC_APPROVED',
        details: { submissionId: submission.id, userId: submission.userId }
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    res.json({
      success: true,
      submission
    });
  } catch (error) {
    console.error('Approve KYC error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve KYC'
    });
  }
});

// Reject KYC (Owner only - using RBAC)
router.post('/:id/reject', requireOwner, [
  body('reason').notEmpty(),
  body('adminNotes').optional(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const submission = await rejectKYC(req.params.id, req.userId, req.body.reason, req.body.adminNotes);

    // Log activity
    try {
      await createActivityLog({
        userId: req.userId,
        action: 'KYC_REJECTED',
        details: { submissionId: submission.id, userId: submission.userId, reason: req.body.reason }
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }

    res.json({
      success: true,
      submission
    });
  } catch (error) {
    console.error('Reject KYC error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reject KYC'
    });
  }
});

module.exports = router;

