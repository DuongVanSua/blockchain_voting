import { ethers } from 'ethers';
import { loadContractABI, getContract, getContractWithSigner, formatError } from './blockchainService';
import { getContractAddresses } from '../config/contracts';
import useWalletStore from '../store/useWalletStore';

class ContractService {
  constructor() {
    this.contracts = {};
    this.electionContracts = {};
    this.provider = null;
    this.signer = null;
  }

  // Get signer from wallet store
  async getSigner() {
    const walletStore = useWalletStore.getState();
    if (!walletStore.isConnected) {
      throw new Error('Wallet not connected. Please connect MetaMask first.');
    }
    
    if (!this.signer) {
      this.signer = await walletStore.getSigner();
    }
    
    return this.signer;
  }

  // Get provider from wallet store
  getProvider() {
    const walletStore = useWalletStore.getState();
    if (walletStore.isConnected && walletStore.getProvider) {
      this.provider = walletStore.getProvider();
    }
    
    // Fallback to default provider
    if (!this.provider) {
      const rpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    
    return this.provider;
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

      // If no provider, try to get from wallet store or create default
      if (!this.provider) {
        this.provider = this.getProvider();
      }

      // If no signer, try to get from wallet store
      if (!this.signer && useWalletStore.getState().isConnected) {
        try {
          this.signer = await this.getSigner();
        } catch (error) {
          // Continue without signer (read-only mode)
        }
      }

      const addresses = getContractAddresses();

      // Load ABIs
      const VotingTokenABI = await loadContractABI('VotingToken');
      const VoterRegistryABI = await loadContractABI('VoterRegistry');
      const ElectionFactoryABI = await loadContractABI('ElectionFactory');

      // Create contract instances
      if (addresses.VotingToken) {
        // eslint-disable-next-line no-console
        console.log('[init] Creating VotingToken contract with address:', addresses.VotingToken);
        this.contracts.VotingToken = getContract(addresses.VotingToken, VotingTokenABI, this.signer || this.provider);
        // eslint-disable-next-line no-console
        console.log('[init] VotingToken contract created:', this.contracts.VotingToken ? 'Success' : 'Failed');
      } else {
        // eslint-disable-next-line no-console
        console.warn('[init] VotingToken address not found in config');
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
  async updateSigner() {
    try {
      this.signer = await this.getSigner();
      // Re-initialize contracts with new signer
      if (this.provider) {
        await this.init(this.provider, this.signer);
      }
    } catch (error) {
      console.error('Error updating signer:', error);
      this.signer = null;
    }
  }

  getContract(name) {
    return this.contracts[name];
  }

  async getElectionContract(address) {
    // Always reload ABI to ensure we have the latest version
    // This prevents issues when ABI is updated after contract deployment
    const ElectionABI = await loadContractABI('Election');
    
    // Check if we have a cached contract, but always recreate to ensure latest ABI
    // This is important when ABI is updated (e.g., new functions added)
    if (this.electionContracts[address]) {
      // Verify the cached contract has the new function
      try {
        const contract = this.electionContracts[address];
        if (contract.interface && contract.interface.getFunction('initializeElectionWithCandidates')) {
          return contract;
        }
      } catch (e) {
        // Function not found, need to recreate contract with new ABI
        delete this.electionContracts[address];
      }
    }

    // Ensure provider exists
    if (!this.provider) {
      const { ethers } = await import('ethers');
      const rpcUrl = import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    try {
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

  async mintVotingToken(toAddress, amount = '1') {
    try {
      // Get signer from wallet store
      const signer = await this.getSigner();
      const signerAddress = await signer.getAddress();
      
      // eslint-disable-next-line no-console
      console.log('[mintVotingToken] Signer address:', signerAddress);
      
      // Get contract addresses
      const addresses = getContractAddresses();
      // eslint-disable-next-line no-console
      console.log('[mintVotingToken] Contract addresses:', addresses);
      
      if (!addresses.VotingToken) {
        throw new Error('VotingToken address not configured. Please check contracts.js');
      }
      
      // Initialize contracts with signer - force re-init to ensure signer is set
      const initResult = await this.init(null, signer);
      // eslint-disable-next-line no-console
      console.log('[mintVotingToken] Init result:', initResult);
      
      if (!initResult.success) {
        throw new Error(`Failed to initialize contracts: ${initResult.error || 'Unknown error'}`);
      }
      
      // Double check contract is initialized
      if (!this.contracts.VotingToken) {
        // eslint-disable-next-line no-console
        console.warn('[mintVotingToken] Contract not initialized, creating manually...');
        // Try to manually create contract instance
        const VotingTokenABI = await loadContractABI('VotingToken');
        // eslint-disable-next-line no-console
        console.log('[mintVotingToken] Loaded ABI, creating contract with address:', addresses.VotingToken);
        this.contracts.VotingToken = getContract(addresses.VotingToken, VotingTokenABI, signer);
      }
      
      const contract = this.contracts.VotingToken;
      if (!contract) {
        throw new Error('VotingToken contract not initialized after init. Please check contract address and ABI.');
      }
      
      // eslint-disable-next-line no-console
      console.log('[mintVotingToken] Contract instance:', contract);
      // eslint-disable-next-line no-console
      console.log('[mintVotingToken] Contract address:', contract.target);

      // Validate address
      if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
        throw new Error('Invalid voter address');
      }

      // Check if signer is a minter (optional check - contract will revert if not)
      try {
        // Normalize address to lowercase for consistency
        const normalizedSignerAddress = signerAddress.toLowerCase();
        
        // Get user address from database for comparison
        const authStore = await import('../store/useAuthStore');
        const userFromDB = authStore.default.getState().user;
        const dbWalletAddress = userFromDB?.walletAddress || userFromDB?.wallet_address;
        const normalizedDbAddress = dbWalletAddress ? dbWalletAddress.toLowerCase() : null;
        
        // eslint-disable-next-line no-console
        console.log('[mintVotingToken] Address comparison:', {
          signerAddress: normalizedSignerAddress,
          dbAddress: normalizedDbAddress,
          match: normalizedSignerAddress === normalizedDbAddress
        });
        
        // eslint-disable-next-line no-console
        console.log('[mintVotingToken] Checking minter status for:', normalizedSignerAddress);
        
        const isMinter = await contract.minters(normalizedSignerAddress);
        // eslint-disable-next-line no-console
        console.log('[mintVotingToken] Is minter:', isMinter);
        
        if (!isMinter) {
          // eslint-disable-next-line no-console
          console.error('[mintVotingToken] ❌ User is NOT a minter.');
          // eslint-disable-next-line no-console
          console.error('[mintVotingToken] Signer address (from MetaMask):', normalizedSignerAddress);
          // eslint-disable-next-line no-console
          console.error('[mintVotingToken] DB address (from database):', normalizedDbAddress);
          
          // Check if addresses don't match
          if (normalizedDbAddress && normalizedSignerAddress !== normalizedDbAddress) {
            // eslint-disable-next-line no-console
            console.error('[mintVotingToken] ⚠️ WARNING: MetaMask address does not match database address!');
            // eslint-disable-next-line no-console
            console.error('[mintVotingToken] You are using a different account in MetaMask than the one registered in the database.');
            // eslint-disable-next-line no-console
            console.error('[mintVotingToken] Please switch to the correct account in MetaMask or update your wallet address in the database.');
            
            return { 
              success: false, 
              error: `Địa chỉ ví MetaMask (${normalizedSignerAddress.slice(0, 10)}...) không khớp với địa chỉ trong database (${normalizedDbAddress?.slice(0, 10)}...). Vui lòng chuyển sang đúng account trong MetaMask hoặc liên hệ Owner để cập nhật địa chỉ ví.` 
            };
          }
          
          return { 
            success: false, 
            error: 'Bạn không có quyền mint token. Vui lòng liên hệ Owner để được thêm vào danh sách Minter.' 
          };
        }
        // eslint-disable-next-line no-console
        console.log('[mintVotingToken] ✅ User is a minter, proceeding with mint...');
      } catch (checkError) {
        // If check fails, continue anyway - contract will revert if not minter
        // eslint-disable-next-line no-console
        console.warn('[mintVotingToken] Could not check minter status:', checkError);
        // eslint-disable-next-line no-console
        console.warn('[mintVotingToken] Will proceed anyway - contract will revert if not minter');
      }

      // Convert amount to BigNumber (assuming 18 decimals)
      const amountBN = ethers.parseUnits(amount, 18);

      // Get contract with signer for transaction
      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, signer);

      // Check balance for gas
      const provider = this.getProvider();
      const balance = await provider.getBalance(signerAddress);
      const balanceInEth = ethers.formatEther(balance);
      
      if (parseFloat(balanceInEth) < 0.001) {
        throw new Error(`Insufficient ETH for gas. Balance: ${balanceInEth} ETH`);
      }

      // Mint token - this will trigger MetaMask popup for user confirmation
      const tx = await contractWithSigner.mint(toAddress, amountBN);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();

      return { 
        success: true, 
        transactionHash: receipt.hash,
        amount: amount 
      };
    } catch (error) {
      console.error('Mint voting token error:', error);
      
      // Provide more specific error messages
      let errorMessage = formatError(error);
      if (error.message && error.message.includes('Only minters')) {
        errorMessage = 'Bạn không có quyền mint token. Vui lòng liên hệ Owner để được thêm vào danh sách Minter.';
      } else if (error.code === 4001) {
        errorMessage = 'Bạn đã từ chối transaction trong MetaMask.';
      } else if (error.code === -32603) {
        errorMessage = 'Lỗi transaction. Vui lòng kiểm tra lại quyền minter hoặc số dư ETH.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  // Election Factory Methods
  async createElection(title, description, electionType, startTime, endTime, allowRealtimeResults, ipfsCid) {
    try {
      // Get signer from wallet store
      const signer = await this.getSigner();
      
      // Initialize if needed
      if (!this.contracts.ElectionFactory) {
        await this.init();
      }
      
      const contract = this.contracts.ElectionFactory;
      if (!contract) {
        throw new Error('ElectionFactory contract not initialized');
      }

      // Verify contract code exists at address
      const provider = this.getProvider();
      const contractCode = await provider.getCode(contract.target);
      if (!contractCode || contractCode === '0x' || contractCode === '0x0') {
        throw new Error(`ElectionFactory contract not deployed at address ${contract.target}. Please deploy the contract first.`);
      }
      // eslint-disable-next-line no-console
      console.log('[createElection] ElectionFactory contract verified at:', contract.target);

      // Validation
      if (!title || !description) {
        throw new Error('Title and description are required');
      }
      if (!ipfsCid) {
        throw new Error('IPFS CID is required');
      }
      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }

      const now = Math.floor(Date.now() / 1000);
      if (startTime <= now) {
        throw new Error('Start time must be in the future');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, signer);

      // Check balance
      const balance = await provider.getBalance(await signer.getAddress());
      const balanceInEth = ethers.formatEther(balance);
      
      if (parseFloat(balanceInEth) < 0.01) {
        throw new Error(`Insufficient ETH for gas. Balance: ${balanceInEth} ETH`);
      }

      // Create election
      // eslint-disable-next-line no-console
      console.log('[createElection] Calling createElection with:', {
        title,
        description,
        electionType,
        startTime,
        endTime,
        allowRealtimeResults,
        ipfsCid
      });

      const tx = await contractWithSigner.createElection(
        title,
        description,
        electionType,
        startTime,
        endTime,
        allowRealtimeResults,
        ipfsCid,
        { gasLimit: 5000000 } // Increased gas limit for contract deployment
      );

      // eslint-disable-next-line no-console
      console.log('[createElection] Transaction sent:', tx.hash);

      const receipt = await tx.wait();

      // Check transaction status
      if (receipt.status !== 1) {
        throw new Error(`Transaction failed with status ${receipt.status}. Transaction hash: ${receipt.hash}`);
      }

      // eslint-disable-next-line no-console
      console.log('[createElection] Transaction confirmed:', {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
        logsCount: receipt.logs?.length || 0
      });

      // Get election address from event
      let electionAddress = null;
      if (receipt.logs && receipt.logs.length > 0) {
        const factoryInterface = contract.interface;
        // eslint-disable-next-line no-console
        console.log('[createElection] Parsing receipt logs, total logs:', receipt.logs.length);
        // eslint-disable-next-line no-console
        console.log('[createElection] Contract address:', contract.target);
        
        // Get event topic for ElectionCreated
        // Event signature: ElectionCreated(uint256 indexed, address indexed, string, string, address indexed, uint256)
        let electionCreatedTopic = null;
        try {
          const eventFragment = factoryInterface.getEvent('ElectionCreated');
          electionCreatedTopic = eventFragment.topicHash;
          // eslint-disable-next-line no-console
          console.log('[createElection] Looking for ElectionCreated topic:', electionCreatedTopic);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[createElection] Could not get ElectionCreated topic:', e.message);
        }
        
        // Try to find ElectionCreated event
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          try {
            // Log all topics for debugging
            if (i === 0) {
              // eslint-disable-next-line no-console
              console.log('[createElection] Sample log structure:', {
                address: log.address,
                topics: log.topics,
                data: log.data,
                topicsLength: log.topics?.length
              });
            }
            
            // Check if this log matches ElectionCreated topic
            if (electionCreatedTopic && log.topics && log.topics[0] === electionCreatedTopic) {
              // eslint-disable-next-line no-console
              console.log('[createElection] Found log with ElectionCreated topic at index', i);
              // eslint-disable-next-line no-console
              console.log('[createElection] Log address:', log.address, 'Contract address:', contract.target);
              
              // Try to parse the log
              const parsed = factoryInterface.parseLog(log);
              // eslint-disable-next-line no-console
              console.log('[createElection] Parsed ElectionCreated event:', {
                name: parsed?.name,
                args: parsed?.args,
                argsLength: parsed?.args?.length
              });
              
              if (parsed && parsed.name === 'ElectionCreated') {
                // electionAddress is the second indexed parameter (index 1 in topics, but args[1] in parsed args)
                // Topics: [0] = event signature, [1] = electionId (indexed), [2] = electionAddress (indexed), [3] = creator (indexed)
                // Args: [0] = electionId, [1] = electionAddress, [2] = title, [3] = ipfsCid, [4] = creator, [5] = timestamp
                electionAddress = parsed.args.electionAddress || parsed.args[1] || (log.topics[2] ? ethers.getAddress('0x' + log.topics[2].slice(26)) : null);
                // eslint-disable-next-line no-console
                console.log('[createElection] Found ElectionCreated event, address:', electionAddress);
                break;
              }
            }
          } catch (e) {
            // Not an ElectionCreated event or parse error, continue
            // eslint-disable-next-line no-console
            console.log('[createElection] Failed to parse log at index', i, ':', e.message);
            continue;
          }
        }
        
        // If still not found, try parsing all logs without topic check
        if (!electionAddress) {
          // eslint-disable-next-line no-console
          console.log('[createElection] ElectionCreated not found with topic check, trying all logs...');
          for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            try {
              const parsed = factoryInterface.parseLog(log);
              // eslint-disable-next-line no-console
              console.log('[createElection] Parsed log at index', i, ':', parsed?.name);
              if (parsed && parsed.name === 'ElectionCreated') {
                electionAddress = parsed.args.electionAddress || parsed.args[1];
                // eslint-disable-next-line no-console
                console.log('[createElection] Found ElectionCreated event (no topic check), address:', electionAddress);
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }

      // Fallback: Try to get from transaction receipt by checking contract creation
      // When Election contract is deployed, it creates a new contract, so we can find it in receipt
      if (!electionAddress && receipt.contractAddress) {
        // eslint-disable-next-line no-console
        console.log('[createElection] Found contract creation in receipt:', receipt.contractAddress);
        electionAddress = receipt.contractAddress;
      }

      // Fallback: get from factory (with error handling)
      if (!electionAddress) {
        // eslint-disable-next-line no-console
        console.warn('[createElection] ElectionCreated event not found, trying fallback method...');
        // eslint-disable-next-line no-console
        console.log('[createElection] All receipt logs:', receipt.logs.map((log, idx) => ({
          index: idx,
          address: log.address,
          topics: log.topics?.map(t => t.substring(0, 20) + '...') || [],
          dataLength: log.data?.length || 0
        })));
        
        // Verify contract code before calling functions
        const factoryCode = await provider.getCode(contract.target);
        if (!factoryCode || factoryCode === '0x' || factoryCode === '0x0') {
          // eslint-disable-next-line no-console
          console.error('[createElection] ElectionFactory contract has no code at address:', contract.target);
          throw new Error(`ElectionFactory contract not deployed at address ${contract.target}. Transaction hash: ${receipt.hash}`);
        }
        
        try {
          // Wait longer for state to sync (especially for Hardhat localhost)
          await new Promise(resolve => window.setTimeout(resolve, 3000));
          
          // Try to get totalElections, but handle decode errors gracefully
          let totalElections = null;
          try {
            totalElections = await contract.totalElections();
            // eslint-disable-next-line no-console
            console.log('[createElection] Total elections:', totalElections?.toString());
          } catch (decodeError) {
            // eslint-disable-next-line no-console
            console.warn('[createElection] Could not get totalElections (contract may not be ready):', decodeError.message);
            // Contract state may not be updated yet, wait a bit more and retry
            await new Promise(resolve => window.setTimeout(resolve, 3000));
            try {
              totalElections = await contract.totalElections();
              // eslint-disable-next-line no-console
              console.log('[createElection] Total elections (retry):', totalElections?.toString());
            } catch (retryError) {
              // eslint-disable-next-line no-console
              console.error('[createElection] Retry also failed:', retryError.message);
              // If still failing, the contract may not have the function or state is not updated
              // This could mean the transaction reverted or contract is not properly deployed
            }
          }
          
          if (totalElections && totalElections > 0) {
            try {
              // Use totalElections - 1 as index (0-based)
              const electionIndex = totalElections - 1n;
              const electionInfo = await contract.getElection(electionIndex);
              electionAddress = electionInfo.electionAddress;
              // eslint-disable-next-line no-console
              console.log('[createElection] Got election address from fallback:', electionAddress);
            } catch (getElectionError) {
              // eslint-disable-next-line no-console
              console.error('[createElection] Could not get election info:', getElectionError.message);
            }
          } else {
            // eslint-disable-next-line no-console
            console.warn('[createElection] totalElections is 0 or null, election may not have been created');
          }
        } catch (fallbackError) {
          // eslint-disable-next-line no-console
          console.error('[createElection] Fallback method failed:', fallbackError);
        }
      }

      if (!electionAddress) {
        throw new Error(`Election address not found. Transaction hash: ${receipt.hash}. Please check the transaction on the blockchain explorer.`);
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
      // First check if contract exists
      const provider = this.getProvider();
      const contractCode = await provider.getCode(electionAddress);
      if (contractCode === '0x' || contractCode === '0x0') {
        // eslint-disable-next-line no-console
        console.warn(`[getElectionInfo] No contract code at address ${electionAddress}`);
        return { 
          success: false, 
          error: 'Contract does not exist at this address',
          contractExists: false
        };
      }

      const contract = await this.getElectionContract(electionAddress);
      if (!contract) {
        return { 
          success: false, 
          error: 'Election contract not found',
          contractExists: false
        };
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
        contractExists: true
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Get election info error:', error);
      // If it's a decode error, contract might not exist
      if (error.code === 'BAD_DATA' || error.message?.includes('could not decode')) {
        return { 
          success: false, 
          error: 'Contract does not exist or is not a valid Election contract',
          contractExists: false
        };
      }
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

  /**
   * Initialize election with config and all candidates in one transaction
   * This reduces the number of MetaMask confirmations from N+2 to just 2
   */
  async initializeElectionWithCandidates(
    electionAddress,
    isPublic,
    requireToken,
    tokenAmount,
    candidates
  ) {
    try {
      const signer = await this.getSigner();
      const contract = await this.getElectionContract(electionAddress);
      if (!contract) {
        throw new Error('Election contract not found');
      }

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, signer);

      // Prepare candidate data arrays
      const candidateNames = candidates.map(c => c.name);
      const candidateParties = candidates.map(c => c.party);
      const candidateAges = candidates.map(c => parseInt(c.age));
      const candidateManifestos = candidates.map(c => c.manifesto || '');

      // Convert image hashes to bytes32
      const { ethers } = await import('ethers');
      const toBytes32FromCidOrBytes32 = (value, fallback) => {
        if (typeof value === 'string' && value.startsWith('0x') && value.length === 66) {
          return value; // already bytes32
        }
        if (typeof value === 'string' && value.trim().length > 0) {
          return ethers.keccak256(ethers.toUtf8Bytes(value.trim()));
        }
        return ethers.keccak256(ethers.toUtf8Bytes(String(fallback || 'candidate')));
      };

      const candidateImageHashes = candidates.map(c => {
        const cidOrBytes = c.imageHash || c.imageCid || '';
        return toBytes32FromCidOrBytes32(cidOrBytes, c.name);
      });

      // Call initializeElectionWithCandidates
      const tx = await contractWithSigner.initializeElectionWithCandidates(
        isPublic,
        requireToken,
        tokenAmount,
        candidateNames,
        candidateParties,
        candidateAges,
        candidateManifestos,
        candidateImageHashes
      );

      const receipt = await tx.wait();

      return { success: true, transactionHash: receipt.hash };
    } catch (error) {
      console.error('Initialize election with candidates error:', error);
      return { success: false, error: formatError(error) };
    }
  }

  async addVoter(electionAddress, voterAddress) {
    try {
      const signer = await this.getSigner();
      const contract = await this.getElectionContract(electionAddress);
      if (!contract) {
        throw new Error('Election contract not found');
      }

      // Normalize address to lowercase
      const normalizedAddress = voterAddress.toLowerCase();
      
      // eslint-disable-next-line no-console
      console.log('[addVoter] Adding voter to contract:', {
        electionAddress,
        voterAddress: normalizedAddress,
        signerAddress: await signer.getAddress()
      });

      const contractWithSigner = getContractWithSigner(contract.target, contract.interface, signer);
      const tx = await contractWithSigner.addVoter(normalizedAddress);
      // eslint-disable-next-line no-console
      console.log('[addVoter] Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      // eslint-disable-next-line no-console
      console.log('[addVoter] Transaction confirmed in block:', receipt.blockNumber);

      // Parse VoterRegistered event
      let voterRegisteredEvent = null;
      try {
        const iface = contract.interface;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === 'VoterRegistered') {
              voterRegisteredEvent = parsed;
              // eslint-disable-next-line no-console
              console.log('[addVoter] Found VoterRegistered event:', {
                voter: parsed.args.voter,
                registeredBy: parsed.args.registeredBy
              });
              break;
            }
          } catch (parseError) {
            continue;
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[addVoter] Error parsing events:', error.message);
      }

      return { 
        success: true, 
        transactionHash: receipt.hash,
        eventFound: voterRegisteredEvent !== null
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Add voter error:', error);
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
