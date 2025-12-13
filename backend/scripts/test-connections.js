#!/usr/bin/env node

/**
 * Script kiểm tra kết nối Backend, Frontend, IPFS
 * Chạy: node scripts/test-connections.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const { checkConnection: checkIPFSConnection } = require('../services/ipfsService');
const { getProvider } = require('../config/blockchain');
const { ethers } = require('ethers');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`[SUCCESS] ${message}`, 'green');
}

function logError(message) {
  log(`[ERROR] ${message}`, 'red');
}

function logInfo(message) {
  log(`[INFO] ${message}`, 'cyan');
}

function logWarning(message) {
  log(`[WARNING] ${message}`, 'yellow');
}

async function testDatabaseConnection() {
  logInfo('Testing MySQL Database Connection...');
  try {
    await sequelize.authenticate();
    logSuccess('Database connection established successfully');
    
    // Test query
    const [results] = await sequelize.query('SELECT 1 as test');
    if (results && results.length > 0) {
      logSuccess('Database query test passed');
    }
    return true;
  } catch (error) {
    logError(`Database connection failed: ${error.message}`);
    return false;
  }
}

async function testIPFSConnection() {
  logInfo('Testing IPFS Connection...');
  try {
    const status = await checkIPFSConnection();
    if (status.connected) {
      logSuccess(`IPFS connected - Version: ${status.version}`);
      logInfo(`IPFS API URL: ${status.apiUrl}`);
      logInfo(`IPFS Gateway URL: ${status.gatewayUrl}`);
      return true;
    } else {
      logWarning(`IPFS not connected: ${status.error || 'Unknown error'}`);
      logInfo(`IPFS API URL: ${status.apiUrl}`);
      logInfo('Note: IPFS node may not be running. Using public gateway as fallback.');
      return false;
    }
  } catch (error) {
    logError(`IPFS connection test failed: ${error.message}`);
    logWarning('IPFS node may not be running. This is OK if using public gateway.');
    return false;
  }
}

async function testBlockchainConnection() {
  logInfo('Testing Blockchain Connection...');
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    logSuccess(`Blockchain connected - Chain ID: ${network.chainId}`);
    logSuccess(`Current block number: ${blockNumber}`);
    logInfo(`RPC URL: ${process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545'}`);
    return true;
  } catch (error) {
    logError(`Blockchain connection failed: ${error.message}`);
    logWarning('Make sure Hardhat node is running: npx hardhat node');
    return false;
  }
}

async function testIPFSUpload() {
  logInfo('Testing IPFS Upload...');
  try {
    const { uploadJSON } = require('../services/ipfsService');
    const testData = {
      test: true,
      timestamp: Date.now(),
      message: 'Connection test',
    };
    
    const result = await uploadJSON(testData);
    if (result.success) {
      logSuccess(`IPFS upload successful - Hash: ${result.hash}`);
      logInfo(`IPFS URL: ${result.url}`);
      return { success: true, hash: result.hash };
    } else {
      logError(`IPFS upload failed: ${result.error}`);
      return { success: false };
    }
  } catch (error) {
    logError(`IPFS upload test failed: ${error.message}`);
    return { success: false };
  }
}

async function testIPFSGet(hash) {
  if (!hash) {
    logWarning('Skipping IPFS get test (no hash from upload test)');
    return false;
  }
  
  logInfo('Testing IPFS Get...');
  try {
    const { getJSONFromIPFS } = require('../services/ipfsService');
    const result = await getJSONFromIPFS(hash);
    if (result.success) {
      logSuccess(`IPFS get successful - Retrieved data`);
      logInfo(`Data: ${JSON.stringify(result.data, null, 2)}`);
      return true;
    } else {
      logError(`IPFS get failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    logError(`IPFS get test failed: ${error.message}`);
    return false;
  }
}

async function checkEnvironmentVariables() {
  logInfo('Checking Environment Variables...');
  const required = {
    'DATABASE_URL or DB_*': process.env.DATABASE_URL || (process.env.DB_USER && process.env.DB_NAME),
    'JWT_SECRET_KEY': process.env.JWT_SECRET_KEY,
    'BLOCKCHAIN_RPC_URL': process.env.BLOCKCHAIN_RPC_URL,
    'IPFS_API_URL': process.env.IPFS_API_URL,
  };
  
  const optional = {
    'ADMIN_WALLET_PRIVATE_KEY': process.env.ADMIN_WALLET_PRIVATE_KEY,
    'IPFS_GATEWAY_URL': process.env.IPFS_GATEWAY_URL,
  };
  
  let allRequired = true;
  for (const [key, value] of Object.entries(required)) {
    if (value) {
      logSuccess(`${key}: Set`);
    } else {
      logError(`${key}: Missing`);
      allRequired = false;
    }
  }
  
  for (const [key, value] of Object.entries(optional)) {
    if (value) {
      logInfo(`${key}: Set`);
    } else {
      logWarning(`${key}: Not set (using default)`);
    }
  }
  
  return allRequired;
}

async function main() {
  log('\n' + '='.repeat(60), 'cyan');
  log('  CONNECTION TEST - Backend, Frontend, IPFS', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
  
  const results = {
    database: false,
    ipfs: false,
    blockchain: false,
    ipfsUpload: false,
    ipfsGet: false,
    env: false,
  };
  
  // Check environment
  results.env = await checkEnvironmentVariables();
  log('');
  
  // Test database
  results.database = await testDatabaseConnection();
  log('');
  
  // Test blockchain
  results.blockchain = await testBlockchainConnection();
  log('');
  
  // Test IPFS connection
  results.ipfs = await testIPFSConnection();
  log('');
  
  // Test IPFS upload
  if (results.ipfs) {
    const uploadResult = await testIPFSUpload();
    results.ipfsUpload = uploadResult.success;
    log('');
    
    // Test IPFS get
    if (uploadResult.success && uploadResult.hash) {
      results.ipfsGet = await testIPFSGet(uploadResult.hash);
      log('');
    }
  } else {
    logWarning('Skipping IPFS upload/get tests (IPFS not connected)');
    log('');
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('  TEST SUMMARY', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
  
  const tests = [
    { name: 'Environment Variables', result: results.env },
    { name: 'MySQL Database', result: results.database },
    { name: 'Blockchain (Hardhat)', result: results.blockchain },
    { name: 'IPFS Connection', result: results.ipfs },
    { name: 'IPFS Upload', result: results.ipfsUpload },
    { name: 'IPFS Get', result: results.ipfsGet },
  ];
  
  let passed = 0;
  let total = tests.length;
  
  tests.forEach(test => {
    if (test.result) {
      logSuccess(`${test.name}: PASSED`);
      passed++;
    } else {
      logError(`${test.name}: FAILED`);
    }
  });
  
  log('');
  log(`Results: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n[SUCCESS] All connections are working!', 'green');
    process.exit(0);
  } else {
    log('\n[WARNING] Some connections failed. Check the errors above.', 'yellow');
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  logError(`Test script error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

