export const CONTRACT_ADDRESSES = {
  VotingToken: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  VoterRegistry: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
  ElectionFactory: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
};

export const NETWORK_CONFIG = {
  localhost: {
      chainId: 1337, // Hardhat localhost chain ID (from hardhat.config.js)
      name: 'Hardhat Local',
      rpcUrl: 'http://127.0.0.1:8545',
      blockExplorer: null,
  },
  sepolia: {
      chainId: 11155111,
      name: 'Sepolia',
      rpcUrl: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
      blockExplorer: 'https://sepolia.etherscan.io',
  },
};

export const IPFS_CONFIG = {
  local: {
      apiUrl: 'http://127.0.0.1:5001',
      gatewayUrl: 'http://127.0.0.1:8080/ipfs',
  },
  public: {
      gatewayUrl: 'https://ipfs.io/ipfs',
  },
  pinata: {
      apiKey: import.meta.env.VITE_PINATA_API_KEY || '',
      apiSecret: import.meta.env.VITE_PINATA_API_SECRET || '',
      gatewayUrl: 'https://gateway.pinata.cloud/ipfs',
  },
};

export const CURRENT_NETWORK = 'localhost';

export const getContractAddresses = () => {
  return CONTRACT_ADDRESSES;
};

export const getNetworkConfig = () => {
  return NETWORK_CONFIG[CURRENT_NETWORK] || NETWORK_CONFIG.localhost;
};