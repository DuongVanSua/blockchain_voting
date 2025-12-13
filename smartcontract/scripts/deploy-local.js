const hre = require("hardhat");

async function main() {
  // Use hardhat network (built-in) instead of localhost
  // This doesn't require a separate node to be running
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("\n[INFO] Note: Using Hardhat network (in-memory, no real ETH needed)");

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
    network: "hardhat",
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
  const deploymentsDir = path.join(__dirname, "..", "deployments", "hardhat");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to:", path.join(deploymentsDir, "deployment.json"));
  console.log("\n[SUCCESS] Deployment completed successfully!");
  console.log("\nNote: These addresses are for Hardhat network (in-memory).");
  console.log("For persistent localhost deployment, run 'npx hardhat node' first, then 'npm run deploy:localhost'");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

