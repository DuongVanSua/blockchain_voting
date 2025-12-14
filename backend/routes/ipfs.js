const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { checkConnection, uploadJSON, uploadFile, getJSONFromIPFS, pinHash, unpinHash } = require('../services/ipfsService');

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept images and common document types
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  },
});

// Check IPFS status
router.get('/status', async (req, res) => {
  try {
    const status = await checkConnection();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('IPFS status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check IPFS status'
    });
  }
});

// Upload JSON (requires auth)
router.post('/upload', authenticate, async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data is required'
      });
    }

    const result = await uploadJSON(data);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('IPFS upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload to IPFS'
    });
  }
});

// Upload file (requires auth)
router.post('/upload-file', authenticate, upload.single('file'), async (req, res) => {
  try {
    console.log('[IPFS] File upload request received');
    console.log('[IPFS] Request file:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file');
    
    if (!req.file) {
      console.error('[IPFS] No file in request');
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    console.log('[IPFS] Uploading file to IPFS...');
    const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    
    console.log('[IPFS] Upload result:', result.success ? { success: true, hash: result.hash } : { success: false, error: result.error });
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[IPFS] File upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file to IPFS'
    });
  }
});

// Get JSON from IPFS
router.get('/:hash', async (req, res) => {
  try {
    const result = await getJSONFromIPFS(req.params.hash);
    
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('IPFS get error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get from IPFS'
    });
  }
});

// Get file from IPFS (returns file directly)
router.get('/file/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const config = require('../config/config');
    
    // Redirect to IPFS gateway
    const gatewayUrl = config.ipfs.pinata.enabled && config.ipfs.pinata.gatewayUrl 
      ? config.ipfs.pinata.gatewayUrl 
      : config.ipfs.gatewayUrl;
    
    const fileUrl = `${gatewayUrl}${hash}`;
    
    // Redirect to IPFS gateway
    res.redirect(fileUrl);
  } catch (error) {
    console.error('IPFS get file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file from IPFS'
    });
  }
});

// Pin hash
router.post('/pin/:hash', authenticate, async (req, res) => {
  try {
    const result = await pinHash(req.params.hash);
    res.json(result);
  } catch (error) {
    console.error('IPFS pin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pin hash'
    });
  }
});

// Unpin hash
router.post('/unpin/:hash', authenticate, async (req, res) => {
  try {
    const result = await unpinHash(req.params.hash);
    res.json(result);
  } catch (error) {
    console.error('IPFS unpin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unpin hash'
    });
  }
});

module.exports = router;

