const { create } = require('ipfs-http-client');
const fetch = require('node-fetch');
const FormData = require('form-data');
const config = require('../config/config');

let ipfsClient = null;

// Initialize IPFS client
function getIPFSClient() {
  if (!ipfsClient) {
    try {
      ipfsClient = create({
        url: config.ipfs.apiUrl,
      });
    } catch (error) {
      console.error('Error initializing IPFS client:', error);
      throw error;
    }
  }
  return ipfsClient;
}

// Check IPFS connection
async function checkConnection() {
  try {
    const client = getIPFSClient();
    const version = await client.version();
    return {
      connected: true,
      version: version.version,
      apiUrl: config.ipfs.apiUrl,
      gatewayUrl: config.ipfs.gatewayUrl,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      apiUrl: config.ipfs.apiUrl,
      gatewayUrl: config.ipfs.gatewayUrl,
    };
  }
}

// Upload data to IPFS
async function uploadToIPFS(data, filename = 'data.json') {
  try {
    const client = getIPFSClient();
    
    // Convert string to buffer if needed
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    const result = await client.add({
      path: filename,
      content: buffer,
    }, {
      pin: true,
    });

    const hash = result.cid.toString();
    const url = `${config.ipfs.gatewayUrl}${hash}`;

    return {
      success: true,
      hash,
      url,
      path: result.path,
    };
  } catch (error) {
    console.error('IPFS upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Upload JSON to IPFS (via Pinata if enabled, otherwise local IPFS)
async function uploadJSON(data) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    
    // Check if Pinata is enabled (auto-enable if JWT or API credentials are present)
    const hasPinataCredentials = config.ipfs.pinata.jwt || (config.ipfs.pinata.apiKey && config.ipfs.pinata.apiSecret);
    const pinataEnabled = config.ipfs.pinata.enabled || hasPinataCredentials;
    
    if (pinataEnabled && hasPinataCredentials) {
      console.log('[IPFS] Using Pinata for JSON upload');
      const buffer = Buffer.from(jsonString, 'utf8');
      return await uploadFileToPinata(buffer, 'data.json', 'application/json');
    }
    
    console.log('[IPFS] Using local IPFS for JSON upload');
    
    // Fallback to local IPFS
    return await uploadToIPFS(jsonString, 'data.json');
  } catch (error) {
    console.error('IPFS JSON upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Upload file to IPFS (via Pinata if enabled, otherwise local IPFS)
async function uploadFile(buffer, filename, mimetype) {
  try {
    // Check if Pinata is enabled (auto-enable if JWT or API credentials are present)
    const hasPinataCredentials = config.ipfs.pinata.jwt || (config.ipfs.pinata.apiKey && config.ipfs.pinata.apiSecret);
    const pinataEnabled = config.ipfs.pinata.enabled || hasPinataCredentials;
    
    if (pinataEnabled && hasPinataCredentials) {
      console.log('[IPFS] Using Pinata for file upload');
      return await uploadFileToPinata(buffer, filename, mimetype);
    }
    
    console.log('[IPFS] Using local IPFS for file upload');
    // Fallback to local IPFS
    const client = getIPFSClient();
    
    // Determine file extension from mimetype or filename
    let extension = '';
    if (filename && filename.includes('.')) {
      extension = filename.split('.').pop();
    } else if (mimetype) {
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'application/pdf': 'pdf',
      };
      extension = mimeToExt[mimetype] || 'bin';
    }
    
    const finalFilename = filename || `file.${extension}`;
    
    const result = await client.add({
      path: finalFilename,
      content: buffer,
    }, {
      pin: true,
    });

    const hash = result.cid.toString();
    const url = `${config.ipfs.gatewayUrl}${hash}`;

    return {
      success: true,
      hash,
      url,
      path: result.path,
      filename: finalFilename,
    };
  } catch (error) {
    console.error('IPFS file upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Upload file to Pinata
async function uploadFileToPinata(buffer, filename, mimetype) {
  try {
    const formData = new FormData();
    
    // Determine file extension
    let extension = '';
    if (filename && filename.includes('.')) {
      extension = filename.split('.').pop();
    } else if (mimetype) {
      const mimeToExt = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'application/pdf': 'pdf',
        'application/json': 'json',
      };
      extension = mimeToExt[mimetype] || 'bin';
    }
    
    const finalFilename = filename || `file.${extension}`;
    
    // Append file to FormData
    formData.append('file', buffer, {
      filename: finalFilename,
      contentType: mimetype || 'application/octet-stream',
    });
    
    // Pinata metadata (optional)
    const metadata = JSON.stringify({
      name: finalFilename,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        type: mimetype || 'unknown',
      },
    });
    formData.append('pinataMetadata', metadata);
    
    // Pinata options (optional)
    const options = JSON.stringify({
      cidVersion: 0,
    });
    formData.append('pinataOptions', options);
    
    // Prepare headers
    const headers = {
      ...formData.getHeaders(),
    };
    
    // Use JWT if available, otherwise use API Key/Secret
    if (config.ipfs.pinata.jwt) {
      headers['Authorization'] = `Bearer ${config.ipfs.pinata.jwt}`;
    } else if (config.ipfs.pinata.apiKey && config.ipfs.pinata.apiSecret) {
      headers['pinata_api_key'] = config.ipfs.pinata.apiKey;
      headers['pinata_secret_api_key'] = config.ipfs.pinata.apiSecret;
    } else {
      throw new Error('Pinata credentials not configured. Please set PINATA_JWT or PINATA_API_KEY and PINATA_API_SECRET');
    }
    
    // Upload to Pinata
    console.log('[Pinata] Uploading file to Pinata:', finalFilename);
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText || 'Upload failed' };
      }
      console.error('[Pinata] Upload failed:', response.status, errorData);
      throw new Error(errorData.error?.details || errorData.error?.message || errorData.error || `Pinata upload failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[Pinata] Upload response:', result);
    
    // Pinata returns IpfsHash in the response
    const hash = result.IpfsHash || result.hash;
    if (!hash) {
      console.error('[Pinata] No hash in response:', result);
      throw new Error('Pinata response missing hash');
    }
    
    const url = `${config.ipfs.pinata.gatewayUrl}${hash}`;
    console.log('[Pinata] Upload successful - Hash:', hash, 'URL:', url);
    
    return {
      success: true,
      hash,
      url,
      path: hash,
      filename: finalFilename,
      pinata: true,
    };
  } catch (error) {
    console.error('Pinata upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get file from IPFS
async function getFromIPFS(hash) {
  try {
    const client = getIPFSClient();
    const chunks = [];
    
    for await (const chunk of client.cat(hash)) {
      chunks.push(chunk);
    }
    
    const data = Buffer.concat(chunks);
    
    return {
      success: true,
      data: data.toString('utf8'),
      url: `${config.ipfs.gatewayUrl}${hash}`,
    };
  } catch (error) {
    console.error('IPFS get error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Get JSON from IPFS
async function getJSONFromIPFS(hash) {
  try {
    const result = await getFromIPFS(hash);
    if (!result.success) {
      return result;
    }

    const jsonData = JSON.parse(result.data);
    return {
      success: true,
      data: jsonData,
      url: result.url,
    };
  } catch (error) {
    console.error('IPFS get JSON error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Pin hash
async function pinHash(hash) {
  try {
    const client = getIPFSClient();
    await client.pin.add(hash);
    return { success: true };
  } catch (error) {
    console.error('IPFS pin error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Unpin hash
async function unpinHash(hash) {
  try {
    const client = getIPFSClient();
    await client.pin.rm(hash);
    return { success: true };
  } catch (error) {
    console.error('IPFS unpin error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  checkConnection,
  uploadToIPFS,
  uploadJSON,
  uploadFile,
  getFromIPFS,
  getJSONFromIPFS,
  pinHash,
  unpinHash,
};

