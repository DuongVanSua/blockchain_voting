import { ethers } from 'ethers';
import { loadContractABI, getContract, getContractWithSigner, formatError } from './blockchainService';
import { getContractAddresses } from '../config/contracts';

class ContractService {
  constructor() {
    this.contracts = {};
    this.electionContracts = {};
    this.provider = null;
    this.signer = null;
  }

  // Initialize with provider and signer
  async init(provider, signer) {
    try {
      // If provider/signer provided, use them
      if (provider) {
        this.provider = provider;
      }
      if (signer) {
        this.signer = signer;
      }

      // If no provider, create default
      if (!this.provider) {
        const { ethers } = await import('ethers');
        const rpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
      }

      const addresses = getContractAddresses();

      // Load ABIs
      const VotingTokenABI = await loadContractABI('VotingToken');
      const VoterRegistryABI = await loadContractABI('VoterRegistry');
      const ElectionFactoryABI = await loadContractABI('ElectionFactory');

      // Create contract instances
      if (addresses.VotingToken) {
        this.contracts.VotingToken = getContract(addresses.VotingToken, VotingTokenABI, this.signer || this.provider);
      }
      if (addresses.VoterRegistry) {
        this.contracts.VoterRegistry = getContract(addresses.VoterRegistry, VoterRegistryABI, this.signer || this.provider);
      }
      if (addresses.ElectionFactory) {
        this.contracts.ElectionFactory = getContract(addresses.ElectionFactory, ElectionFactoryABI, this.signer || this.provider);
      }

      return { success: true };
    } catch (error) {
      console.error('Contract initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  // Update signer (when wallet connects)
  updateSigner(signer) {
    this.signer = signer;
    // Re-initialize contracts with new signer
    if (this.provider) {
      this.init(this.provider, signer);
    }
  }

  getContract(name) {
    return this.contracts[name];
  }

  async getElectionContract(address) {
    if (this.electionContracts[address]) {
      return this.electionContracts[address];
    }

    // Ensure provider exists
    if (!this.provider) {
      const { ethers } = await import('ethers');
      const rpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    try {
      const ElectionABI = await loadContractABI('Election');
      const contract = getContract(address, ElectionABI, this.signer || this.provider);
      this.electionContracts[address] = contract;
      return contract;
    } catch (error) {
      console.error('Error getting election contract:', error);
      return null;
    }
  }

  // Voter Registry Methods
  async registerVoter(voterId, name, age, kycHash) {
    try {
      const contract = this.contracts.VoterRegistry;
      if (!contract || !this.signer) {
        throw new Error('Wallet not connected');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, this.signer);
      const tx = await contractWithSigner.registerVoter(voterId, name, age, kycHash);
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.hash };
    } catch (error) {
      console.error('Register voter error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async isVoterEligible(voterAddress) {
    try {
      const contract = this.contracts.VoterRegistry;
      if (!contract) {
        throw new Error('VoterRegistry contract not initialized');
      }

      const result = await contract.isVoterEligible(voterAddress);
      return { success: true, eligible: result };
    } catch (error) {
      console.error('Check voter eligibility error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async getVoterInfo(voterAddress) {
    try {
      const contract = this.contracts.VoterRegistry;
      if (!contract) {
        throw new Error('VoterRegistry contract not initialized');
      }

      const voter = await contract.getVoterInfo(voterAddress);
      return {
        success: true,
        voter: {
          voterAddress: voter.voterAddress,
          voterId: voter.voterId,
          name: voter.name,
          age: voter.age.toString(),
          status: voter.status.toString(),
          registrationTime: voter.registrationTime.toString(),
          approvalTime: voter.approvalTime.toString(),
          kycHash: voter.kycHash,
        },
      };
    } catch (error) {
      console.error('Get voter info error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async approveVoter(voterAddress) {
    try {
      const contract = this.contracts.VoterRegistry;
      if (!contract || !this.signer) {
        throw new Error('Wallet not connected');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, this.signer);
      const tx = await contractWithSigner.approveVoter(voterAddress);
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.hash };
    } catch (error) {
      console.error('Approve voter error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async getTotalVoters() {
    try {
      const contract = this.contracts.VoterRegistry;
      if (!contract) {
        throw new Error('VoterRegistry contract not initialized');
      }

      const total = await contract.totalVoters();
      return { success: true, total: Number(total) };
    } catch (error) {
      console.error('Get total voters error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  // Voting Token Methods
  async getTokenBalance(address) {
    try {
      const contract = this.contracts.VotingToken;
      if (!contract) {
        throw new Error('VotingToken contract not initialized');
      }

      const balance = await contract.balanceOf(address);
      return { success: true, balance: balance.toString() };
    } catch (error) {
      console.error('Get token balance error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  // Election Factory Methods
  async createElection(title, description, electionType, startTime, endTime, allowRealtimeResults = true) {
    try {
      const contract = this.contracts.ElectionFactory;
      if (!contract || !this.signer) {
        throw new Error('Wallet not connected');
      }

      // Validation
      if (!title || !description) {
        throw new Error('Title and description are required');
      }
      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }

      const now = Math.floor(Date.now() / 1000);
      if (startTime <= now) {
        throw new Error('Start time must be in the future');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, this.signer);

      // Check balance
      const balance = await this.provider.getBalance(await this.signer.getAddress());
      const balanceInEth = ethers.formatEther(balance);
      
      if (parseFloat(balanceInEth) < 0.01) {
        throw new Error(`Insufficient ETH for gas. Balance: ${balanceInEth} ETH`);
      }

      // Create election
      const tx = await contractWithSigner.createElection(
        title,
        description,
        electionType,
        startTime,
        endTime,
        allowRealtimeResults,
        { gasLimit: 3000000 }
      );

      const receipt = await tx.wait();

      // Get election address from event
      let electionAddress = null;
      if (receipt.logs) {
        const factoryInterface = contract.interface;
        for (const log of receipt.logs) {
          try {
            const parsed = factoryInterface.parseLog(log);
            if (parsed && parsed.name === 'ElectionCreated') {
              electionAddress = parsed.args.electionAddress;
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      // Fallback: get from factory
      if (!electionAddress) {
        const totalElections = await contract.totalElections();
        if (totalElections > 0) {
          const electionInfo = await contract.getElection(totalElections);
          electionAddress = electionInfo.electionAddress;
        }
      }

      if (!electionAddress) {
        throw new Error('Election address not found in transaction receipt');
      }

      return {
        success: true,
        transactionHash: receipt.hash,
        electionAddress,
      };
    } catch (error) {
      console.error('Create election error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async getAllElections() {
    try {
      const contract = this.contracts.ElectionFactory;
      if (!contract) {
        return { success: true, elections: [] };
      }

      const allElectionsData = await contract.getAllElections();
      const elections = [];

      for (let i = 0; i < allElectionsData.length; i++) {
        const electionInfo = allElectionsData[i];
        if (!electionInfo.electionAddress || electionInfo.electionAddress === ethers.ZeroAddress) {
          continue;
        }

        try {
          const detailedInfo = await this.getElectionInfo(electionInfo.electionAddress);
          if (detailedInfo.success) {
            elections.push({
              electionId: Number(electionInfo.electionId),
              id: Number(electionInfo.electionId),
              address: electionInfo.electionAddress,
              electionAddress: electionInfo.electionAddress,
              contractAddress: electionInfo.electionAddress,
              title: detailedInfo.info.title || electionInfo.title || '',
              description: detailedInfo.info.description || '',
              electionType: detailedInfo.info.electionType || electionInfo.electionType || 'LOCAL',
              startTime: Number(detailedInfo.info.startTime) || 0,
              endTime: Number(detailedInfo.info.endTime) || 0,
              totalVotes: Number(detailedInfo.info.totalVotes) || 0,
              totalCandidates: Number(detailedInfo.info.totalCandidates) || 0,
              state: Number(detailedInfo.info.state) || 0,
              creator: electionInfo.creator || '',
              creationTime: Number(electionInfo.creationTime) || 0,
              isActive: electionInfo.isActive !== false,
            });
          }
        } catch (err) {
          console.warn(`Failed to get detailed info for election ${i + 1}:`, err);
        }
      }

      return { success: true, elections };
    } catch (error) {
      console.error('Get all elections error:', error);
      return { success: false, error: formatError(error), elections: [] };
    }
  }

  async getElectionInfo(electionAddress) {
    try {
      const contract = await this.getElectionContract(electionAddress);
      if (!contract) {
        throw new Error('Election contract not found');
      }

      const info = await contract.getElectionInfo();
      return {
        success: true,
        info: {
          electionId: Number(info[0]),
          title: info[1],
          description: info[2],
          electionType: info[3],
          startTime: Number(info[4]),
          endTime: Number(info[5]),
          state: Number(info[6]),
          totalCandidates: Number(info[7]),
          totalVotes: Number(info[8]),
        },
      };
    } catch (error) {
      console.error('Get election info error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async getCandidates(electionAddress) {
    try {
      const contract = await this.getElectionContract(electionAddress);
      if (!contract) {
        throw new Error('Election contract not found');
      }

      const candidates = await contract.getAllCandidates();
      
      return {
        success: true,
        candidates: candidates.map((c) => ({
          candidateId: Number(c.candidateId),
          name: c.name,
          party: c.party,
          age: Number(c.age),
          manifesto: c.manifesto,
          imageHash: c.imageHash,
          voteCount: Number(c.voteCount),
          isActive: c.isActive,
        })),
      };
    } catch (error) {
      console.error('Get candidates error:', error);
      return { success: false, error: formatError(error), candidates: [] };
    }
  }

  async addCandidate(electionAddress, name, party, age, manifesto, imageHash) {
    try {
      const contract = await this.getElectionContract(electionAddress);
      if (!contract || !this.signer) {
        throw new Error('Wallet not connected');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, this.signer);
      const tx = await contractWithSigner.addCandidate(name, party, age, manifesto, imageHash);
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.hash };
    } catch (error) {
      console.error('Add candidate error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async castVote(electionAddress, candidateId, voteHash) {
    try {
      const contract = await this.getElectionContract(electionAddress);
      if (!contract || !this.signer) {
        throw new Error('Wallet not connected');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, this.signer);
      const tx = await contractWithSigner.vote(candidateId, voteHash);
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.hash };
    } catch (error) {
      console.error('Cast vote error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async hasVoted(electionAddress, voterAddress) {
    try {
      const contract = await this.getElectionContract(electionAddress);
      if (!contract) {
        throw new Error('Election contract not found');
      }

      const hasVoted = await contract.hasVoterVoted(voterAddress);
      return { success: true, hasVoted };
    } catch (error) {
      console.error('Check has voted error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async pauseElection(electionAddress) {
    try {
      const contract = await this.getElectionContract(electionAddress);
      if (!contract || !this.signer) {
        throw new Error('Wallet not connected');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, this.signer);
      const tx = await contractWithSigner.pauseElection();
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (error) {
      console.error('Pause election error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async resumeElection(electionAddress) {
    try {
      const contract = await this.getElectionContract(electionAddress);
      if (!contract || !this.signer) {
        throw new Error('Wallet not connected');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, this.signer);
      const tx = await contractWithSigner.resumeElection();
      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
    } catch (error) {
      console.error('Resume election error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async getElectionResults(electionAddress) {
    try {
      const candidatesResult = await this.getCandidates(electionAddress);
      if (!candidatesResult.success) {
        throw new Error('Failed to get candidates');
      }

      const electionInfo = await this.getElectionInfo(electionAddress);
      if (!electionInfo.success) {
        throw new Error('Failed to get election info');
      }

      return {
        success: true,
        results: {
          totalVotes: electionInfo.info.totalVotes,
          candidates: candidatesResult.candidates.map((c) => ({
            candidateId: c.candidateId,
            name: c.name,
            party: c.party,
            voteCount: c.voteCount,
            percentage: electionInfo.info.totalVotes > 0
              ? (c.voteCount / electionInfo.info.totalVotes) * 100
              : 0,
          })),
        },
      };
    } catch (error) {
      console.error('Get election results error:', error);
      return { success: false, error: formatError(error) };
    }
  }
}

export const contractService = new ContractService();
export default contractService;
