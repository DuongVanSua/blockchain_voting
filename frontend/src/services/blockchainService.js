import { ethers } from 'ethers';

// Load contract ABI
export async function loadContractABI(contractName) {
  try {
    // Try to load from artifacts
    const response = await fetch(`/abi/${contractName}.json`);
    if (response.ok) {
      const artifact = await response.json();
      return artifact.abi || artifact;
    }
    throw new Error(`Contract ABI not found: ${contractName}`);
  } catch (error) {
    console.error(`Error loading contract ABI: ${error.message}`);
    throw error;
  }
}

// Get contract instance
export function getContract(address, abi, signerOrProvider) {
  if (!address || !abi) {
    throw new Error('Address and ABI are required');
  }
  
  // If it's already a Contract instance, return it
  if (signerOrProvider && typeof signerOrProvider === 'object' && 'target' in signerOrProvider) {
    return signerOrProvider;
  }
  
  if (signerOrProvider) {
    return new ethers.Contract(address, abi, signerOrProvider);
  }
  
  // If no signer/provider, create a read-only provider
  const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545');
  return new ethers.Contract(address, abi, provider);
}

// Get contract with signer
export function getContractWithSigner(address, abi, signer) {
  if (!signer) {
    throw new Error('Signer is required');
  }
  return new ethers.Contract(address, abi, signer);
}

// Wait for transaction
export async function waitForTransaction(txHash, provider) {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545');
  }
  return provider.waitForTransaction(txHash);
}

// Format error message
export function formatError(error) {
  if (error.reason) {
    return error.reason;
  }
  if (error.message) {
    // Extract user-friendly message from revert reason
    const match = error.message.match(/reason="([^"]+)"/);
    if (match) {
      return match[1];
    }
    return error.message;
  }
  return 'Transaction failed';
}

