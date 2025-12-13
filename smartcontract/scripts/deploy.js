const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const network = hre.network.name;
  
  // Validate configuration for testnet/mainnet
  if (network !== "hardhat" && network !== "localhost") {
    console.log(`\n🔍 Checking configuration for ${network} network...\n`);
    
    // Check PRIVATE_KEY
    if (!process.env.PRIVATE_KEY) {
      console.error("[ERROR] PRIVATE_KEY is not set in .env file!");
      console.error("\nPlease add your Owner account private key to .env:");
      console.error("   PRIVATE_KEY=your_private_key_here");
      console.error("\nGenerate a new account: npm run generate-account");
      process.exit(1);
    }
    
    // Check ALCHEMY_API_KEY
    if (!process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY === "your_alchemy_api_key_here") {
      console.error("[ERROR] ALCHEMY_API_KEY is not set in .env file!");
      console.error("\nPlease add your Alchemy API key to .env:");
      console.error("   ALCHEMY_API_KEY=your_alchemy_api_key_here");
      console.error("\nGet API key from: https://www.alchemy.com/");
      process.exit(1);
    }
    
    console.log("[SUCCESS] Configuration validated\n");
  }
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  // Check if account has enough balance (for testnet/mainnet)
  if (network !== "hardhat" && network !== "localhost") {
    const minBalance = hre.ethers.parseEther("0.01"); // 0.01 ETH minimum
    if (balance < minBalance) {
      console.warn("\n[WARNING] Account balance is low!");
      console.warn("   You may not have enough ETH to deploy contracts.");
      console.warn("   Minimum recommended: 0.01 ETH");
      console.warn("   Current balance:", hre.ethers.formatEther(balance), "ETH");
      console.warn("\n💰 Fund your account:");
      if (network === "sepolia") {
        console.warn("   https://sepoliafaucet.com/");
      } else if (network === "goerli") {
        console.warn("   https://goerlifaucet.com/");
      }
    }
  }

  // Deploy VotingToken
  console.log("\n1. Deploying VotingToken...");
  const VotingToken = await hre.ethers.getContractFactory("VotingToken");
  const votingToken = await VotingToken.deploy("Voting Token", "VOTE");
  await votingToken.waitForDeployment();
  const votingTokenAddress = await votingToken.getAddress();
  console.log("VotingToken deployed to:", votingTokenAddress);

  // Deploy VoterRegistry
  console.log("\n2. Deploying VoterRegistry...");
  const VoterRegistry = await hre.ethers.getContractFactory("VoterRegistry");
  const voterRegistry = await VoterRegistry.deploy(18); // min voting age = 18
  await voterRegistry.waitForDeployment();
  const voterRegistryAddress = await voterRegistry.getAddress();
  console.log("VoterRegistry deployed to:", voterRegistryAddress);

  // Deploy ElectionFactory
  console.log("\n3. Deploying ElectionFactory...");
  const ElectionFactory = await hre.ethers.getContractFactory("ElectionFactory");
  const electionFactory = await ElectionFactory.deploy(
    voterRegistryAddress,
    votingTokenAddress
  );
  await electionFactory.waitForDeployment();
  const electionFactoryAddress = await electionFactory.getAddress();
  console.log("ElectionFactory deployed to:", electionFactoryAddress);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      VotingToken: votingTokenAddress,
      VoterRegistry: voterRegistryAddress,
      ElectionFactory: electionFactoryAddress,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Write to file
  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "..", "deployments", hre.network.name);
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to:", path.join(deploymentsDir, "deployment.json"));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

