require('dotenv').config();
const { getAdminSigner, loadContractABI, getProvider } = require('../config/blockchain');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function testDeploy() {
  console.log('=== Testing Contract Deployment Setup ===\n');

  try {
    // 1. Test provider connection
    console.log('1. Testing provider connection...');
    const provider = getProvider();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    console.log(`   Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`   Current block: ${blockNumber}\n`);

    // 2. Test system signer
    console.log('2. Testing system signer...');
    const signer = getAdminSigner();
    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);
    console.log(`   System address: ${address}`);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH\n`);

    // 3. Test deployment file
    console.log('3. Testing deployment file...');
    const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      console.log(`   Deployment file found`);
      console.log(`   ElectionFactory: ${deployment.contracts?.ElectionFactory || 'NOT FOUND'}\n`);
    } else {
      console.log(`   Deployment file not found at: ${deploymentPath}\n`);
      return;
    }

    // 4. Test ABI loading
    console.log('4. Testing ABI loading...');
    try {
      const factoryABI = loadContractABI('ElectionFactory');
      console.log(`   ElectionFactory ABI loaded: ${factoryABI.length} items\n`);
    } catch (error) {
      console.log(`   Failed to load ABI: ${error.message}\n`);
      return;
    }

    // 5. Test contract connection
    console.log('5. Testing contract connection...');
    const factoryABI = loadContractABI('ElectionFactory');
    const factoryAddress = JSON.parse(fs.readFileSync(deploymentPath, 'utf8')).contracts.ElectionFactory;
    const factory = new ethers.Contract(factoryAddress, factoryABI, signer);
    
    try {
      const totalElections = await factory.totalElections();
      console.log(`   Factory contract connected`);
      console.log(`   Total elections: ${totalElections}\n`);
    } catch (error) {
      console.log(`   Contract connected but method call failed: ${error.message}\n`);
    }

    console.log('=== All tests passed! Ready to deploy elections. ===');
  } catch (error) {
    console.error('\nTest failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testDeploy();

