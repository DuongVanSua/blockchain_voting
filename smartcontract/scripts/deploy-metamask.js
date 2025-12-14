/**
 * Deploy Smart Contracts via MetaMask
 * 
 * This script uses Hardhat with MetaMask provider.
 * It will prompt for MetaMask confirmation for each deployment transaction.
 * 
 * Requirements:
 * 1. MetaMask extension installed in browser
 * 2. Run this script in a browser environment or use a bridge
 * 
 * For browser usage, see: deploy-metamask-browser.html
 * 
 * For Node.js with MetaMask, you need to:
 * 1. Use a browser extension bridge (like puppeteer)
 * 2. Or use the HTML page instead
 */

const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  console.log("\n=== Deploy Contracts via MetaMask ===\n");
  
  // Check if running in browser environment
  if (typeof window === 'undefined' || !window.ethereum) {
    console.error("❌ This script requires a browser environment with MetaMask.");
    console.error("\nPlease use one of these options:");
    console.error("1. Open deploy-metamask-browser.html in your browser");
    console.error("2. Or use the standard deploy script with PRIVATE_KEY");
    console.error("   npm run deploy:localhost");
    process.exit(1);
  }

  try {
    // Request MetaMask connection
    console.log("📱 Requesting MetaMask connection...");
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Create provider from MetaMask
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const deployerAddress = await signer.getAddress();
    
    console.log("✅ Connected to MetaMask:", deployerAddress);
    
    // Get network info
    const network = await provider.getNetwork();
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId.toString());
    
    // Check balance
    const balance = await provider.getBalance(deployerAddress);
    const balanceEth = ethers.formatEther(balance);
    console.log("💰 Balance:", balanceEth, "ETH");
    
    if (parseFloat(balanceEth) < 0.01) {
      console.warn("\n⚠️  WARNING: Low balance! You may need more ETH to deploy contracts.");
    }

    console.log("\n=== Starting Deployment ===\n");

    // Load contract artifacts
    const VotingTokenArtifact = require("../artifacts/contracts/VotingToken.sol/VotingToken.json");
    const VoterRegistryArtifact = require("../artifacts/contracts/VoterRegistry.sol/VoterRegistry.json");
    const ElectionFactoryArtifact = require("../artifacts/contracts/ElectionFactory.sol/ElectionFactory.json");

    // 1. Deploy VotingToken
    console.log("1️⃣  Deploying VotingToken...");
    console.log("   ⏳ Waiting for MetaMask confirmation...");
    
    const VotingTokenFactory = new ethers.ContractFactory(
      VotingTokenArtifact.abi,
      VotingTokenArtifact.bytecode,
      signer
    );
    
    const votingToken = await VotingTokenFactory.deploy("Voting Token", "VOTE");
    console.log("   📝 Transaction sent:", votingToken.deploymentTransaction().hash);
    console.log("   ⏳ Waiting for confirmation...");
    
    await votingToken.waitForDeployment();
    const votingTokenAddress = await votingToken.getAddress();
    console.log("   ✅ VotingToken deployed to:", votingTokenAddress);

    // 2. Deploy VoterRegistry
    console.log("\n2️⃣  Deploying VoterRegistry...");
    console.log("   ⏳ Waiting for MetaMask confirmation...");
    
    const VoterRegistryFactory = new ethers.ContractFactory(
      VoterRegistryArtifact.abi,
      VoterRegistryArtifact.bytecode,
      signer
    );
    
    const voterRegistry = await VoterRegistryFactory.deploy(18);
    console.log("   📝 Transaction sent:", voterRegistry.deploymentTransaction().hash);
    console.log("   ⏳ Waiting for confirmation...");
    
    await voterRegistry.waitForDeployment();
    const voterRegistryAddress = await voterRegistry.getAddress();
    console.log("   ✅ VoterRegistry deployed to:", voterRegistryAddress);

    // 3. Deploy ElectionFactory
    console.log("\n3️⃣  Deploying ElectionFactory...");
    console.log("   ⏳ Waiting for MetaMask confirmation...");
    
    const ElectionFactoryFactory = new ethers.ContractFactory(
      ElectionFactoryArtifact.abi,
      ElectionFactoryArtifact.bytecode,
      signer
    );
    
    const electionFactory = await ElectionFactoryFactory.deploy(
      voterRegistryAddress,
      votingTokenAddress
    );
    console.log("   📝 Transaction sent:", electionFactory.deploymentTransaction().hash);
    console.log("   ⏳ Waiting for confirmation...");
    
    await electionFactory.waitForDeployment();
    const electionFactoryAddress = await electionFactory.getAddress();
    console.log("   ✅ ElectionFactory deployed to:", electionFactoryAddress);

    // Save deployment info
    const deploymentInfo = {
      network: network.name,
      chainId: network.chainId.toString(),
      deployer: deployerAddress,
      contracts: {
        VotingToken: votingTokenAddress,
        VoterRegistry: voterRegistryAddress,
        ElectionFactory: electionFactoryAddress,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("\n=== Deployment Summary ===");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Save to file (if in Node.js environment)
    if (typeof require !== 'undefined') {
      const fs = require("fs");
      const path = require("path");
      const deploymentsDir = path.join(__dirname, "..", "deployments", network.name);
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(deploymentsDir, "deployment-metamask.json"),
        JSON.stringify(deploymentInfo, null, 2)
      );
      console.log("\n✅ Deployment info saved to:", path.join(deploymentsDir, "deployment-metamask.json"));
    }

    return deploymentInfo;
  } catch (error) {
    console.error("\n❌ Deployment error:", error.message);
    if (error.code === 4001) {
      console.error("   User rejected the transaction in MetaMask");
    } else if (error.code === -32603) {
      console.error("   Internal JSON-RPC error. Check MetaMask console for details.");
    }
    throw error;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { main };
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
