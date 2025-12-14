import { ethers } from 'ethers';

// Import ABIs directly (Vite requires direct imports for static assets)
import VotingTokenABI from '../abi/VotingToken.json';
import VoterRegistryABI from '../abi/VoterRegistry.json';
import ElectionFactoryABI from '../abi/ElectionFactory.json';
import ElectionABI from '../abi/Election.json';

// Helper to extract ABI from artifact (handles both direct ABI array and artifact object)
function extractABI(artifact) {
  // If it's already an array, return it
  if (Array.isArray(artifact)) {
    return artifact;
  }
  // If it has an 'abi' property, return that
  if (artifact && artifact.abi) {
    return artifact.abi;
  }
  // Otherwise return the artifact itself
  return artifact;
}

// ABI mapping
const ABI_MAP = {
  VotingToken: extractABI(VotingTokenABI),
  VoterRegistry: extractABI(VoterRegistryABI),
  ElectionFactory: extractABI(ElectionFactoryABI),
  Election: extractABI(ElectionABI),
};

// Load contract ABI
export async function loadContractABI(contractName) {
  try {
    const abi = ABI_MAP[contractName];
    if (!abi) {
      throw new Error(`Contract ABI not found: ${contractName}. Available: ${Object.keys(ABI_MAP).join(', ')}`);
    }
    // eslint-disable-next-line no-console
    console.log(`[loadContractABI] Loaded ABI for ${contractName}, length:`, abi.length);
    return abi;
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

