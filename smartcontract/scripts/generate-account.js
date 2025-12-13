const { ethers } = require("hardhat");

/**
 * Generate a new Ethereum account for Owner deployment
 * WARNING: This is for development only. Never use this in production.
 */
async function main() {
  console.log("\n=== Generating New Owner Account ===\n");
  
  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();
  
  console.log("[SUCCESS] New Account Generated!");
  console.log("\nAccount Details:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Address:    ", wallet.address);
  console.log("Private Key:", wallet.privateKey);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("\n[WARNING] IMPORTANT SECURITY NOTES:");
  console.log("1. Save the Private Key securely - you cannot recover it!");
  console.log("2. Never share your Private Key with anyone!");
  console.log("3. Never commit Private Key to git!");
  console.log("4. Add this Private Key to your .env file as PRIVATE_KEY");
  console.log("5. Fund this account with ETH before deploying to testnet/mainnet");
  
  console.log("\nAdd to .env file:");
  console.log(`PRIVATE_KEY=${wallet.privateKey}`);
  console.log(`ADMIN_WALLET_PRIVATE_KEY=${wallet.privateKey}`);
  console.log(`ADMIN_WALLET_ADDRESS=${wallet.address}`);
  
  console.log("\n To fund on Sepolia testnet:");
  console.log("1. Go to: https://sepoliafaucet.com/");
  console.log("2. Enter address:", wallet.address);
  console.log("3. Request test ETH");
  
  console.log("\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

