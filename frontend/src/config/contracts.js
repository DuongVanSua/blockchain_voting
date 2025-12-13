export const CONTRACT_ADDRESSES = {
  VotingToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  VoterRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  ElectionFactory: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
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