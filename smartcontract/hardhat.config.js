require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // Disable analytics to avoid warnings
  analytics: {
    enabled: false,
  },
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1, // Low runs to minimize contract size
      },
      evmVersion: "shanghai",
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: true, // Allow large contracts for testing
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      // Use private key if provided and valid, otherwise use default Hardhat accounts
      accounts: (process.env.PRIVATE_KEY && 
                 process.env.PRIVATE_KEY !== "your_owner_private_key_here" &&
                 process.env.PRIVATE_KEY.length >= 64 &&
                 process.env.PRIVATE_KEY.startsWith("0x")) 
                 ? [process.env.PRIVATE_KEY] : undefined,
    },
    sepolia: {
      url: process.env.ALCHEMY_API_KEY
        ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://eth-sepolia.g.alchemy.com/v2/REQUIRED",
      chainId: 11155111,
      accounts: (process.env.PRIVATE_KEY && 
                 process.env.PRIVATE_KEY !== "your_owner_private_key_here" &&
                 process.env.PRIVATE_KEY.length >= 64 &&
                 process.env.PRIVATE_KEY.startsWith("0x")) 
                 ? [process.env.PRIVATE_KEY] : [],
    },
    goerli: {
      url: process.env.ALCHEMY_API_KEY
        ? `https://eth-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://eth-goerli.g.alchemy.com/v2/REQUIRED",
      chainId: 5,
      accounts: (process.env.PRIVATE_KEY && 
                 process.env.PRIVATE_KEY !== "your_owner_private_key_here" &&
                 process.env.PRIVATE_KEY.length >= 64 &&
                 process.env.PRIVATE_KEY.startsWith("0x")) 
                 ? [process.env.PRIVATE_KEY] : [],
    },
    mainnet: {
      url: process.env.ALCHEMY_API_KEY
        ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : "https://eth-mainnet.g.alchemy.com/v2/REQUIRED",
      chainId: 1,
      accounts: (process.env.PRIVATE_KEY && 
                 process.env.PRIVATE_KEY !== "your_owner_private_key_here" &&
                 process.env.PRIVATE_KEY.length >= 64 &&
                 process.env.PRIVATE_KEY.startsWith("0x")) 
                 ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};

