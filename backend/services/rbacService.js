const { getContract, loadContractABI } = require('../config/blockchain');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

/**
 * Get ElectionFactory contract instance
 */
async function getElectionFactory() {
  try {
    const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error('Deployment file not found. Please deploy contracts first.');
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const factoryAddress = deployment.contracts?.ElectionFactory;
    
    if (!factoryAddress) {
      throw new Error('ElectionFactory address not found in deployment file.');
    }
    
    const factoryABI = loadContractABI('ElectionFactory');
    return getContract(factoryAddress, factoryABI);
  } catch (error) {
    console.error('Error getting ElectionFactory:', error);
    throw error;
  }
}

/**
 * Check if address is owner
 * Returns: true if owner, false if not owner, null if contract not deployed
 */
async function isOwner(address) {
  try {
    if (!address) return false;
    const factory = await getElectionFactory();
    const owner = await factory.owner();
    
    // Check if owner is valid (not empty or zero address)
    if (!owner || owner === '0x' || owner === '0x0000000000000000000000000000000000000000') {
      // Contract not properly deployed
      return null;
    }
    
    return owner.toLowerCase() === address.toLowerCase();
  } catch (error) {
    // If error is "could not decode" or "Deployment file not found", contract not deployed
    if (error.code === 'BAD_DATA' || error.message?.includes('Deployment file not found') || error.message?.includes('not found')) {
      console.warn('Contract not deployed, cannot verify owner from smart contract');
      return null; // Return null to indicate contract not available
    }
    console.error('Error checking owner:', error);
    return false;
  }
}

/**
 * Check if address is creator
 * Returns: true if creator, false if not creator, null if contract not deployed
 */
async function isCreator(address) {
  try {
    if (!address) return false;
    const factory = await getElectionFactory();
    const result = await factory.isCreator(address);
    return result;
  } catch (error) {
    // If error is "could not decode" or "Deployment file not found", contract not deployed
    if (error.code === 'BAD_DATA' || error.message?.includes('Deployment file not found') || error.message?.includes('not found')) {
      console.warn('Contract not deployed, cannot verify creator from smart contract');
      return null; // Return null to indicate contract not available
    }
    console.error('Error checking creator:', error);
    return false;
  }
}

/**
 * Check if address is election creator (chairperson)
 * Also checks database createdBy field as fallback
 */
async function isElectionCreator(electionAddress, address, userId = null) {
  try {
    if (!address || !electionAddress) return false;
    
    // First check: Database createdBy (more reliable since we use admin signer)
    if (userId) {
      try {
        const Election = require('../models/Election');
        const dbElection = await Election.findOne({
          where: {
            contractAddress: electionAddress.toLowerCase()
          }
        });
        
        if (dbElection && dbElection.createdBy === userId) {
          console.log(`[isElectionCreator] User ${userId} is creator of election ${electionAddress} (database check)`);
          return true;
        }
      } catch (dbError) {
        console.warn('Error checking database for election creator:', dbError.message);
      }
    }
    
    // Second check: Smart contract chairperson
    try {
      const electionABI = loadContractABI('Election');
      const election = getContract(electionAddress, electionABI);
      const chairperson = await election.chairperson();
      const isChairperson = chairperson.toLowerCase() === address.toLowerCase();
      
      if (isChairperson) {
        console.log(`[isElectionCreator] Address ${address} is chairperson of election ${electionAddress} (contract check)`);
        return true;
      }
    } catch (contractError) {
      console.warn('Error checking contract for election creator:', contractError.message);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking election creator:', error);
    return false;
  }
}

/**
 * Get all roles for an address
 */
async function getRoles(address) {
  try {
    if (!address) {
      return {
        isOwner: false,
        isCreator: false,
        address: null
      };
    }
    
    const factory = await getElectionFactory();
    
    // Use try-catch for each call to handle individual errors
    let owner = null;
    let isCreatorRole = false;
    
    try {
      owner = await factory.owner();
      // Check if owner is valid (not empty or zero address)
      if (!owner || owner === '0x' || owner === '0x0000000000000000000000000000000000000000') {
        owner = null;
      }
    } catch (error) {
      console.warn('Error getting owner from contract:', error.message);
      owner = null;
    }
    
    try {
      isCreatorRole = await factory.isCreator(address);
    } catch (error) {
      console.warn('Error checking creator role:', error.message);
      isCreatorRole = false;
    }
    
    return {
      isOwner: owner && owner.toLowerCase() === address.toLowerCase(),
      isCreator: isCreatorRole,
      address: address
    };
  } catch (error) {
    // If contract doesn't exist or is not deployed, return default values
    console.warn('Error getting roles (contract may not be deployed):', error.message);
    return {
      isOwner: false,
      isCreator: false,
      address: address
    };
  }
}

/**
 * Check if system is paused
 */
async function isSystemPaused() {
  try {
    const factory = await getElectionFactory();
    return await factory.isPaused();
  } catch (error) {
    console.error('Error checking system pause status:', error);
    return false;
  }
}

/**
 * Get VoterRegistry contract instance
 */
async function getVoterRegistry() {
  try {
    const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
    
    if (!fs.existsSync(deploymentPath)) {
      throw new Error('Deployment file not found. Please deploy contracts first.');
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const registryAddress = deployment.contracts?.VoterRegistry;
    
    if (!registryAddress) {
      throw new Error('VoterRegistry address not found in deployment file.');
    }
    
    const registryABI = loadContractABI('VoterRegistry');
    return getContract(registryAddress, registryABI);
  } catch (error) {
    console.error('Error getting VoterRegistry:', error);
    throw error;
  }
}

module.exports = {
  isOwner,
  isCreator,
  isElectionCreator,
  getRoles,
  isSystemPaused,
  getElectionFactory,
  getVoterRegistry
};

