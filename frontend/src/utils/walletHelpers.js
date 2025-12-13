import { ethers } from 'ethers';

// Connect wallet with private key (for owner/creator)
export async function connectWithPrivateKey(privateKey, rpcUrl) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl || import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545');
    const wallet = new ethers.Wallet(privateKey, provider);
    const address = await wallet.getAddress();
    
    return {
      success: true,
      account: address,
      wallet,
      provider,
      signer: wallet,
    };
  } catch (error) {
    console.error('Connect with private key error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect with private key',
    };
  }
}

// Get balance
export async function getBalance(address, provider) {
  try {
    if (!provider) {
      provider = new ethers.JsonRpcProvider(import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545');
    }
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Get balance error:', error);
    return '0';
  }
}

// Hash data
export function keccak256(data) {
  if (typeof data === 'string') {
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }
  return ethers.keccak256(data);
}

