require('dotenv').config();
const { ethers } = require('ethers');

// Get provider
function getProvider() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
  return new ethers.JsonRpcProvider(rpcUrl);
}

// Get signer from private key
function getSigner(privateKey) {
  const provider = getProvider();
  if (!privateKey) {
    throw new Error('Private key is required');
  }
  return new ethers.Wallet(privateKey, provider);
}

// Get system wallet signer (used by owner/creator for contract operations)
// Note: ADMIN_WALLET_PRIVATE_KEY env var name is kept for backward compatibility
function getAdminSigner() {
  const privateKey = process.env.ADMIN_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('ADMIN_WALLET_PRIVATE_KEY not configured in .env file');
  }
  
  try {
    const provider = getProvider();
    // Create new wallet instance each time to ensure fresh nonce tracking
    // This prevents "nonce has already been used" errors when sending multiple transactions
    const wallet = new ethers.Wallet(privateKey, provider);
    return wallet;
  } catch (error) {
    throw new Error(`Failed to create system signer: ${error.message}. Check ADMIN_WALLET_PRIVATE_KEY in .env`);
  }
}

// Load contract
function getContract(address, abi) {
  const provider = getProvider();
  return new ethers.Contract(address, abi, provider);
}

// Get contract with signer
function getContractWithSigner(address, abi, privateKey) {
  const signer = getSigner(privateKey);
  return new ethers.Contract(address, abi, signer);
}

// Get contract ABI from artifacts
function loadContractABI(contractName) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Try abi directory first (more reliable)
    const abiDir = path.join(__dirname, '..', 'abi', `${contractName}.json`);
    if (fs.existsSync(abiDir)) {
      const content = fs.readFileSync(abiDir, 'utf8');
      
      // Check if content is valid JSON
      if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
        throw new Error(`File ${abiDir} contains HTML instead of JSON.`);
      }
      
      const abiData = JSON.parse(content);
      // Handle both direct ABI array and object with abi property
      if (Array.isArray(abiData)) {
        return abiData;
      } else if (abiData.abi && Array.isArray(abiData.abi)) {
        return abiData.abi;
      } else {
        return abiData;
      }
    }
    
    // Fallback to artifacts directory
    const abiPath = path.join(__dirname, '..', '..', 'smartcontract', 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
    
    if (fs.existsSync(abiPath)) {
      const content = fs.readFileSync(abiPath, 'utf8');
      
      // Check if content is valid JSON (not HTML)
      if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
        throw new Error(`File ${abiPath} contains HTML instead of JSON. Contract may not be compiled.`);
      }
      
      const artifact = JSON.parse(content);
      if (!artifact.abi) {
        throw new Error(`ABI not found in artifact file for ${contractName}`);
      }
      return artifact.abi;
    }
    
    throw new Error(`Contract ABI not found for ${contractName}. Checked: ${abiDir} and ${abiPath}`);
  } catch (error) {
    console.error(`Error loading contract ABI for ${contractName}:`, error.message);
    throw new Error(`Failed to load ABI for ${contractName}: ${error.message}`);
  }
}

module.exports = {
  getProvider,
  getSigner,
  getAdminSigner,
  getContract,
  getContractWithSigner,
  loadContractABI
};

