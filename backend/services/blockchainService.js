const { getAdminSigner, loadContractABI, getContract } = require('../config/blockchain');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Deploy Election contract via Factory
async function deployElectionContract(data) {
  try {
    console.log('Getting system signer...');
    const signer = getAdminSigner();
    console.log('System signer address:', await signer.getAddress());
    
    // Load factory address from deployment
    const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
    let factoryAddress;
    
    if (fs.existsSync(deploymentPath)) {
      const deploymentContent = fs.readFileSync(deploymentPath, 'utf8');
      
      // Check if content is valid JSON
      if (deploymentContent.trim().startsWith('<!DOCTYPE') || deploymentContent.trim().startsWith('<html')) {
        throw new Error('Deployment file contains HTML. Please deploy contracts first using: npm run deploy:localhost');
      }
      
      const deployment = JSON.parse(deploymentContent);
      factoryAddress = deployment.contracts?.ElectionFactory;
      
      if (!factoryAddress) {
        throw new Error('ElectionFactory address not found in deployment file. Please deploy contracts first.');
      }
    } else {
      throw new Error(`Deployment file not found at ${deploymentPath}. Please deploy contracts first using: npm run deploy:localhost`);
    }

    // Load factory ABI
    let factoryABI;
    try {
      factoryABI = loadContractABI('ElectionFactory');
    } catch (abiError) {
      throw new Error(`Failed to load ElectionFactory ABI: ${abiError.message}. Please compile contracts first: npm run compile`);
    }
    
    const factory = new ethers.Contract(factoryAddress, factoryABI, signer);

    // Create election
    console.log('Calling createElection on factory...');
    const tx = await factory.createElection(
      data.title,
      data.description,
      data.electionType,
      data.startTime,
      data.endTime,
      data.allowRealtimeResults || false
    );

    console.log('Transaction sent, waiting for confirmation...', tx.hash);
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    
    // Get election address from event
    const event = receipt.logs.find(log => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed && parsed.name === 'ElectionCreated';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = factory.interface.parseLog(event);
      return parsed.args.electionAddress;
    }

    // Fallback: get latest election from factory
    const totalElections = await factory.totalElections();
    if (totalElections > 0) {
      const electionInfo = await factory.getElection(totalElections);
      return electionInfo.electionAddress;
    }
    
    throw new Error('Election address not found in transaction receipt');
  } catch (error) {
    console.error('Error deploying election contract:', error);
    
    // Provide more detailed error message
    let errorMessage = error.message || 'Unknown error';
    
    if (error.message && error.message.includes('ABI')) {
      errorMessage = `Failed to load contract ABI: ${error.message}. Please compile contracts first: cd smartcontract && npm run compile`;
    } else if (error.message && error.message.includes('deployment')) {
      errorMessage = `Deployment file not found. Please deploy contracts first: cd smartcontract && npm run deploy:localhost`;
    } else if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
      errorMessage = 'Cannot connect to Hardhat node. Make sure Hardhat node is running: npx hardhat node';
    } else if (error.reason) {
      errorMessage = `Contract deployment failed: ${error.reason}`;
    }
    
    throw new Error(errorMessage);
  }
}

// Get election contract instance
function getElectionContract(contractAddress) {
  try {
    const abi = loadContractABI('Election');
    return getContract(contractAddress, abi);
  } catch (error) {
    console.error('Error getting election contract:', error);
    throw error;
  }
}

// Pause election
async function pauseElection(contractAddress) {
  try {
    const signer = getAdminSigner();
    const abi = loadContractABI('Election');
    const contract = new ethers.Contract(contractAddress, abi, signer);
    
    const tx = await contract.pauseElection();
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('Error pausing election:', error);
    throw error;
  }
}

// Resume election
async function resumeElection(contractAddress) {
  try {
    const signer = getAdminSigner();
    const abi = loadContractABI('Election');
    const contract = new ethers.Contract(contractAddress, abi, signer);
    
    const tx = await contract.resumeElection();
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('Error resuming election:', error);
    throw error;
  }
}

module.exports = {
  deployElectionContract,
  getElectionContract,
  pauseElection,
  resumeElection,
};

