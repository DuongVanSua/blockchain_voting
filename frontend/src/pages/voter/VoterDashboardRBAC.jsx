import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import apiService from '../../services/apiService';
import { contractService } from '../../services/contractService';
import useAuthStore from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import useWallet from '../../hooks/useWallet';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { ethers } from 'ethers';
import ActivityLogPanel from '../../components/logs/ActivityLogPanel';

const VoterDashboardRBAC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { user: appUser } = useAppStore();
  const wallet = useWallet();
  const [elections, setElections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [registering, setRegistering] = useState(null);
  const [voting, setVoting] = useState(null);
  const [showVoteModal, setShowVoteModal] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [currentElection, setCurrentElection] = useState(null);
  const [showCandidateDetail, setShowCandidateDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'ongoing', 'ended'

  // Get wallet address from database first, then fallback to MetaMask
  const getWalletAddress = () => {
    // Priority 1: Wallet address directly from database (user object) - always check this first
    const walletAddress = user?.walletAddress || user?.wallet_address;
    if (walletAddress) {
      return walletAddress;
    }
    
    // Priority 2: Wallet from app store (synced from database)
    if (appUser?.wallet?.address && appUser?.wallet?.status === 'connected') {
      return appUser.wallet.address;
    }
    
    // Priority 3: Connected MetaMask wallet (fallback)
    if (wallet?.account && wallet?.isConnected) {
      return wallet.account;
    }
    
    return null;
  };

  const walletAddress = getWalletAddress();

  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getVoterElections();
      // eslint-disable-next-line no-console
      console.log('[VoterDashboard] Load elections response:', response);
      
      if (response.success) {
        const electionsList = response.elections || [];
        // eslint-disable-next-line no-console
        console.log('[VoterDashboard] Loaded elections:', electionsList.length);
        // eslint-disable-next-line no-console
        console.log('[VoterDashboard] Elections details:', electionsList.map(e => ({
          title: e.title,
          contractAddress: e.contractAddress,
          isVoter: e.isVoter,
          canVote: e.canVote,
          hasVoted: e.hasVoted,
          isPublic: e.isPublic,
          state: e.state
        })));
        setElections(electionsList);
      } else {
        // eslint-disable-next-line no-console
        console.error('[VoterDashboard] Failed to load elections:', response.error);
        toast.error(response.error || 'Không thể tải danh sách elections');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[VoterDashboard] Load elections error:', error);
      toast.error('Không thể tải danh sách elections: ' + (error.message || 'Lỗi không xác định'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadCandidates = async (electionAddress) => {
    setLoadingCandidates(true);
    try {
      // Try API first (faster and includes metadata)
      const apiResult = await apiService.getVoterElectionDetail(electionAddress);
      if (apiResult.success && apiResult.election?.candidates) {
        setCandidates(apiResult.election.candidates || []);
        setCurrentElection(apiResult.election);
        return;
      }

      // Fallback to contract service
      const result = await contractService.getCandidates(electionAddress);
      if (result.success) {
        setCandidates(result.candidates || []);
        // Try to get election info from API
        try {
          const electionInfo = await apiService.getVoterElectionDetail(electionAddress);
          if (electionInfo.success) {
            setCurrentElection(electionInfo.election);
          }
        } catch (e) {
          // Continue without election info
        }
      } else {
        toast.error('Không thể tải danh sách ứng viên');
      }
    } catch (error) {
      console.error('Load candidates error:', error);
      toast.error('Không thể tải danh sách ứng viên: ' + (error.message || 'Lỗi không xác định'));
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleOpenVoteModal = async (electionAddress) => {
    setShowVoteModal(electionAddress);
    setSelectedCandidate(null);
    setCurrentElection(null);
    await loadCandidates(electionAddress);
  };

  const handleRegister = async (electionAddress) => {
    if (!window.ethereum) {
      toast.error('Vui lòng cài đặt MetaMask');
      return;
    }

    setRegistering(electionAddress);
    try {
      // Get election status first
      const statusRes = await apiService.getElectionStatus(electionAddress);
      if (!statusRes.success) {
        throw new Error(statusRes.error || 'Không thể lấy trạng thái election');
      }

      if (statusRes.isVoter) {
        toast.error('Bạn đã đăng ký election này rồi');
        setRegistering(null);
        return;
      }

      if (!statusRes.isPublic) {
        toast.error('Đây là private election. Chỉ creator mới có thể thêm voters.');
        setRegistering(null);
        return;
      }

      // Call backend API to ensure voter is registered and approved in VoterRegistry
      // eslint-disable-next-line no-console
      console.log('[Voter] Ensuring voter is eligible in VoterRegistry...');
      let voterEligible = false;
      
      try {
        const registerRes = await apiService.registerForElection(electionAddress);
        // eslint-disable-next-line no-console
        console.log('[Voter] Backend response:', registerRes);
        
        // If voter needs to register in VoterRegistry first
        if (!registerRes.success && registerRes.needsVoterRegistryRegistration) {
          // eslint-disable-next-line no-console
          console.log('[Voter] Need to register in VoterRegistry first...');
          
          // Register voter in VoterRegistry from frontend (voter must call this themselves)
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const voterAddress = await signer.getAddress();
          
          const voterRegistryABI = [
            "function registerVoter(string memory _voterId, string memory _name, uint256 _age, bytes32 _kycHash) external",
            "function isVoterEligible(address) external view returns (bool)"
          ];
          
          if (!registerRes.voterRegistryAddress) {
            throw new Error('VoterRegistry address not found in response');
          }
          
          const voterRegistry = new ethers.Contract(registerRes.voterRegistryAddress, voterRegistryABI, signer);
          
          const voterId = registerRes.voterId || `VOTER-${Date.now()}`;
          const name = registerRes.name || 'Voter';
          const age = registerRes.age || 25;
          const kycHash = ethers.keccak256(ethers.toUtf8Bytes(voterAddress));
          
          // eslint-disable-next-line no-console
          console.log('[Voter] Registering in VoterRegistry...', { voterId, name, age, voterRegistryAddress: registerRes.voterRegistryAddress });
          toast.info('Đang đăng ký vào VoterRegistry...');
          
          try {
            const registerTx = await voterRegistry.registerVoter(voterId, name, age, kycHash);
            await registerTx.wait();
            // eslint-disable-next-line no-console
            console.log('[Voter] Registered in VoterRegistry successfully');
            toast.success('Đã đăng ký vào VoterRegistry!');
            
            // Wait a bit and call backend again to approve
            await new Promise(resolve => window.setTimeout(resolve, 2000));
            toast.info('Đang chờ hệ thống phê duyệt...');
            
            const approveRes = await apiService.registerForElection(electionAddress);
            // eslint-disable-next-line no-console
            console.log('[Voter] Approval response:', approveRes);
            
            if (approveRes.success || approveRes.error?.includes('Already registered')) {
              voterEligible = true;
              toast.success('Đã được phê duyệt trong VoterRegistry!');
            } else {
              // eslint-disable-next-line no-console
              console.warn('[Voter] Backend approval failed:', approveRes.error);
              toast.warning('Đã đăng ký nhưng chưa được phê duyệt. Vui lòng thử lại.');
              // Don't throw - let it continue to try registerPublic
            }
          } catch (registerError) {
            // eslint-disable-next-line no-console
            console.error('[Voter] Error registering in VoterRegistry:', registerError);
            if (registerError.reason?.includes('already registered') || registerError.message?.includes('already registered')) {
              // Already registered, try to get approval
              // eslint-disable-next-line no-console
              console.log('[Voter] Already registered, requesting approval...');
              await new Promise(resolve => window.setTimeout(resolve, 1000));
              const approveRes = await apiService.registerForElection(electionAddress);
              if (approveRes.success || approveRes.error?.includes('Already registered')) {
                voterEligible = true;
              }
            } else {
              throw registerError;
            }
          }
        } else if (registerRes.success) {
          // Already eligible
          voterEligible = true;
          // eslint-disable-next-line no-console
          console.log('[Voter] Voter is already eligible');
        } else if (registerRes.error && !registerRes.error.includes('Already registered')) {
          // eslint-disable-next-line no-console
          console.warn('[Voter] Backend registration check failed:', registerRes.error);
          // Continue anyway - might be eligible already
        }
      } catch (apiError) {
        // eslint-disable-next-line no-console
        console.error('[Voter] Backend API error:', apiError);
        // Check if error contains needsVoterRegistryRegistration
        if (apiError.needsVoterRegistryRegistration || apiError.message?.includes('VoterRegistry')) {
          toast.error('Cần đăng ký vào VoterRegistry trước. Vui lòng thử lại.');
          setRegistering(null);
          return;
        }
        // Continue anyway - try to register directly
      }

      // Wait a bit for backend to complete approval if needed
      if (!voterEligible) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
      }

      // Call registerPublic on contract
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Load contract ABI (simplified - in production, load from file)
      const contractABI = [
        "function registerPublic() external",
        "function isVoter(address) external view returns (bool)",
        "function isPublic() external view returns (bool)"
      ];
      
      const contract = new ethers.Contract(electionAddress, contractABI, signer);
      const tx = await contract.registerPublic();
      await tx.wait();

      toast.success('Đã đăng ký thành công!');
      loadElections();
    } catch (error) {
      console.error('Register error:', error);
      if (error.code === 4001) {
        toast.error('Người dùng đã từ chối giao dịch');
      } else if (error.reason?.includes('Voter not eligible') || error.message?.includes('Voter not eligible')) {
        toast.error('Voter chưa được đăng ký trong VoterRegistry. Vui lòng thử lại sau vài giây.');
        // Retry after a delay
        window.setTimeout(() => {
          handleRegister(electionAddress);
        }, 3000);
      } else {
        toast.error(error.message || 'Không thể đăng ký');
      }
    } finally {
      setRegistering(null);
    }
  };

  const handleVote = async (electionAddress, candidateId) => {
    // Check MetaMask connection
    if (!wallet.isConnected) {
      toast.error('Vui lòng kết nối MetaMask để bầu cử');
      return;
    }

    // Use nullish check to handle candidateId = 0
    if (candidateId === null || candidateId === undefined) {
      toast.error('Vui lòng chọn ứng viên');
      return;
    }

    setVoting(electionAddress);
    try {
      // Get election status
      const statusRes = await apiService.getElectionStatus(electionAddress);
      if (!statusRes.success) {
        throw new Error(statusRes.error || 'Không thể lấy trạng thái election');
      }

      // Check if voter is registered in contract
      if (!statusRes.isVoter) {
        toast.error('Bạn chưa được đăng ký trong contract. Vui lòng liên hệ Creator để được thêm vào danh sách voter.', { duration: 5000 });
        setVoting(null);
        return;
      }

      if (!statusRes.canVote) {
        toast.error('Bạn không đủ điều kiện để bầu cử');
        setVoting(null);
        return;
      }

      if (statusRes.hasVoted) {
        toast.error('Bạn đã bầu cử rồi');
        setVoting(null);
        return;
      }

      // Check election time (startTime and endTime) - more reliable than contract state
      let isElectionOngoing = false;
      let electionInfo = currentElection;
      
      // If currentElection is not set, try to get it from elections list
      if (!electionInfo) {
        electionInfo = elections.find(e => e.contractAddress?.toLowerCase() === electionAddress?.toLowerCase());
      }
      
      if (electionInfo) {
        try {
          const now = new Date();
          // Handle both timestamp (seconds) and Date string formats
          let startTime = null;
          let endTime = null;
          
          // Parse startTime
          if (electionInfo.startTime) {
            try {
              let startTimeValue = electionInfo.startTime;
              
              // If string, try to parse as number
              if (typeof startTimeValue === 'string') {
                const parsed = Number(startTimeValue);
                if (!isNaN(parsed)) {
                  startTimeValue = parsed;
                }
              }
              
              // If number, check if it's seconds (timestamp < year 2100 in seconds)
              if (typeof startTimeValue === 'number') {
                // Timestamp in seconds if < 4102444800 (year 2100 in seconds)
                if (startTimeValue < 4102444800) {
                  startTime = new Date(startTimeValue * 1000); // Convert seconds to milliseconds
                } else {
                  startTime = new Date(startTimeValue); // Already in milliseconds
                }
              } else {
                // Try to parse as Date string
                startTime = new Date(startTimeValue);
              }
              
              // Validate date
              if (isNaN(startTime.getTime())) {
                startTime = null;
              }
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('[handleVote] Error parsing startTime:', electionInfo.startTime, e);
              startTime = null;
            }
          }
          
          // Parse endTime
          if (electionInfo.endTime) {
            try {
              let endTimeValue = electionInfo.endTime;
              
              // If string, try to parse as number
              if (typeof endTimeValue === 'string') {
                const parsed = Number(endTimeValue);
                if (!isNaN(parsed)) {
                  endTimeValue = parsed;
                }
              }
              
              // If number, check if it's seconds (timestamp < year 2100 in seconds)
              if (typeof endTimeValue === 'number') {
                // Timestamp in seconds if < 4102444800 (year 2100 in seconds)
                if (endTimeValue < 4102444800) {
                  endTime = new Date(endTimeValue * 1000); // Convert seconds to milliseconds
                } else {
                  endTime = new Date(endTimeValue); // Already in milliseconds
                }
              } else {
                // Try to parse as Date string
                endTime = new Date(endTimeValue);
              }
              
              // Validate date
              if (isNaN(endTime.getTime())) {
                endTime = null;
              }
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn('[handleVote] Error parsing endTime:', electionInfo.endTime, e);
              endTime = null;
            }
          }
          
          if (startTime && endTime) {
            isElectionOngoing = startTime <= now && endTime >= now;
            // Get timezone for display
            // eslint-disable-next-line no-undef
            const timezone = typeof Intl !== 'undefined' && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
            // eslint-disable-next-line no-console
            console.log('[handleVote] Time check:', {
              now: {
                utc: now.toISOString(),
                // eslint-disable-next-line no-undef
                local: typeof Intl !== 'undefined' ? now.toLocaleString('vi-VN', { timeZone: timezone }) : now.toISOString()
              },
              startTime: {
                utc: startTime.toISOString(),
                // eslint-disable-next-line no-undef
                local: typeof Intl !== 'undefined' ? startTime.toLocaleString('vi-VN', { timeZone: timezone }) : startTime.toISOString()
              },
              endTime: {
                utc: endTime.toISOString(),
                // eslint-disable-next-line no-undef
                local: typeof Intl !== 'undefined' ? endTime.toLocaleString('vi-VN', { timeZone: timezone }) : endTime.toISOString()
              },
              isOngoing: isElectionOngoing,
              contractState: statusRes.state,
              rawStartTime: electionInfo.startTime,
              rawEndTime: electionInfo.endTime,
              timezone: timezone
            });
          } else {
            // eslint-disable-next-line no-console
            console.warn('[handleVote] Invalid or missing dates:', {
              rawStartTime: electionInfo.startTime,
              rawEndTime: electionInfo.endTime,
              parsedStartTime: startTime ? startTime.toISOString() : 'Invalid',
              parsedEndTime: endTime ? endTime.toISOString() : 'Invalid'
            });
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[handleVote] Error checking election time:', error);
          // Continue with contract state check if time check fails
        }
      }

      // Check contract state
      const contractState = statusRes.state?.toString() || statusRes.state;
      
      // NEW LOGIC: Election auto-starts when startTime is reached
      // If contract state is CREATED (0) but time check says ongoing, allow voting
      // The contract will auto-start when vote() is called
      if (contractState === '0' && isElectionOngoing) {
        // Contract state is CREATED (0) but startTime has been reached
        // Contract will auto-start when vote() is called - allow voting
        // eslint-disable-next-line no-console
        console.log('[handleVote] Contract state is CREATED (0) but startTime reached - election will auto-start on vote');
      } else if (contractState === '0' && !isElectionOngoing) {
        // Contract state is CREATED (0) and startTime hasn't been reached yet
        toast.error('Election chưa bắt đầu. Vui lòng chờ đến thời gian bắt đầu để có thể bầu cử.');
        setVoting(null);
        return;
      } else if (contractState !== '1' && contractState !== '0') {
        // Contract state is not ONGOING (1) or CREATED (0)
        if (contractState === '2') {
          // PAUSED state - check if can resume
          if (isElectionOngoing) {
            toast.error('Election đang bị tạm dừng. Vui lòng liên hệ Creator để tiếp tục bầu cử.');
          } else {
            toast.error('Election đã kết thúc hoặc đang bị tạm dừng.');
          }
        } else if (contractState === '3' || contractState === '4') {
          toast.error('Election đã kết thúc');
        } else {
          // eslint-disable-next-line no-console
          console.warn('[handleVote] Unknown contract state:', contractState);
          toast.error('Election chưa bắt đầu hoặc đã kết thúc. Vui lòng kiểm tra lại.');
        }
        setVoting(null);
        return;
      } else if (contractState === '1') {
        // Contract state is ONGOING (1) - allow voting
        // eslint-disable-next-line no-console
        console.log('[handleVote] Contract state is ONGOING (1) - allowing vote');
      }
      
      // Final check: If time check says not ongoing, block voting
      if (!isElectionOngoing && contractState === '0') {
        toast.error('Election chưa bắt đầu. Vui lòng chờ đến thời gian bắt đầu.');
        setVoting(null);
        return;
      }

      // Generate vote hash
      const voteHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${electionAddress}-${candidateId}-${Date.now()}`)
      );

      // Call vote on contract
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      
      const contractABI = [
        "function vote(uint256 candidateId, bytes32 voteHash) external",
        "function hasVoterVoted(address) external view returns (bool)",
        "function canVote(address) external view returns (bool)",
        "function isVoter(address) external view returns (bool)",
        "function state() external view returns (uint8)"
      ];
      
      const contract = new ethers.Contract(electionAddress, contractABI, signer);
      
      // Double-check voter is registered in contract before voting
      const isVoterInContract = await contract.isVoter(signerAddress);
      if (!isVoterInContract) {
        // eslint-disable-next-line no-console
        console.error('[handleVote] Voter not registered in contract:', {
          signerAddress,
          electionAddress,
          statusRes
        });
        toast.error('Bạn chưa được đăng ký trong contract. Vui lòng liên hệ Creator để được thêm vào danh sách voter.', { duration: 5000 });
        setVoting(null);
        return;
      }
      
      // Ensure candidateId is a valid number >= 1
      // Contract requires candidateId > 0, and candidates start from ID 1
      const candidateIdNumber = typeof candidateId === 'string' ? parseInt(candidateId, 10) : Number(candidateId);
      
      if (isNaN(candidateIdNumber) || candidateIdNumber < 1) {
        toast.error(`Invalid candidate ID: ${candidateId}. Candidate ID must be >= 1.`);
        setVoting(null);
        return;
      }
      
      // eslint-disable-next-line no-console
      console.log('[handleVote] Calling vote on contract:', {
        electionAddress,
        candidateId: candidateIdNumber,
        originalCandidateId: candidateId,
        signerAddress,
        isVoterInContract
      });
      
      const tx = await contract.vote(candidateIdNumber, voteHash);
      // eslint-disable-next-line no-console
      console.log('[handleVote] Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      // eslint-disable-next-line no-console
      console.log('[handleVote] Transaction confirmed:', receipt.hash);

      // Save vote to database and update candidate voteCount
      try {
        // Get electionId from currentElection or elections list
        let electionId = null;
        if (currentElection?.id) {
          electionId = currentElection.id;
        } else {
          const election = elections.find(e => e.contractAddress?.toLowerCase() === electionAddress?.toLowerCase());
          electionId = election?.id;
        }

        if (electionId) {
          // eslint-disable-next-line no-console
          console.log('[handleVote] Saving vote to database:', { electionId, candidateId, transactionHash: receipt.hash });
          const saveVoteResult = await apiService.saveVote({
            electionId,
            candidateId,
            transactionHash: receipt.hash
          });
          
          if (saveVoteResult.success) {
            // eslint-disable-next-line no-console
            console.log('[handleVote] Vote saved to database successfully');
          } else {
            // eslint-disable-next-line no-console
            console.warn('[handleVote] Failed to save vote to database:', saveVoteResult.error);
            // Don't show error to user as vote was successful on contract
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn('[handleVote] Could not find electionId for electionAddress:', electionAddress);
        }
      } catch (saveError) {
        // eslint-disable-next-line no-console
        console.error('[handleVote] Error saving vote to database:', saveError);
        // Don't show error to user as vote was successful on contract
      }

      toast.success('Bầu cử thành công!');
      setShowVoteModal(null);
      setSelectedCandidate(null);
      loadElections();
    } catch (error) {
      console.error('Vote error:', error);
      if (error.code === 4001) {
        toast.error('Người dùng đã từ chối giao dịch');
      } else {
        toast.error(error.message || 'Không thể bầu cử');
      }
    } finally {
      setVoting(null);
    }
  };

  const getStateLabel = (state) => {
    const states = {
      '0': 'Created',
      '1': 'Ongoing',
      '2': 'Paused',
      '3': 'Ended',
      '4': 'Finalized'
    };
    return states[state] || 'Unknown';
  };

  const getStateBadge = (state) => {
    const variants = {
      '0': 'primary',
      '1': 'success',
      '2': 'warning',
      '3': 'error',
      '4': 'primary'
    };
    return <Badge variant={variants[state] || 'primary'}>{getStateLabel(state)}</Badge>;
  };

  // Filter elections by time (startTime and endTime)
  const filterElectionsByTab = (electionsList) => {
    const now = new Date();
    
    switch (activeTab) {
      case 'upcoming':
        // Elections that haven't started yet (startTime > now)
        return electionsList.filter(e => {
          const startTime = new Date(e.startTime);
          return startTime > now;
        });
      case 'ongoing':
        // Elections that are currently running (startTime <= now && endTime >= now)
        return electionsList.filter(e => {
          const startTime = new Date(e.startTime);
          const endTime = new Date(e.endTime);
          return startTime <= now && endTime >= now;
        });
      case 'ended':
        // Elections that have ended (endTime < now)
        return electionsList.filter(e => {
          const endTime = new Date(e.endTime);
          return endTime < now;
        });
      default:
        return electionsList;
    }
  };

  const filteredElections = filterElectionsByTab(elections);
  
  // Count elections by tab based on time
  const now = new Date();
  const upcomingCount = elections.filter(e => {
    const startTime = new Date(e.startTime);
    return startTime > now;
  }).length;
  
  const ongoingCount = elections.filter(e => {
    const startTime = new Date(e.startTime);
    const endTime = new Date(e.endTime);
    return startTime <= now && endTime >= now;
  }).length;
  
  const endedCount = elections.filter(e => {
    const endTime = new Date(e.endTime);
    return endTime < now;
  }).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Voter Dashboard
          </h1>
          <p className="text-gray-600 mt-2 text-base sm:text-lg">Xem và tham gia các elections</p>
        </div>

      {/* Wallet Address Display */}
      {walletAddress && (
        <Card className="p-5 sm:p-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200/80 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Địa chỉ ví của bạn:</p>
                <p className="font-mono text-sm text-gray-900 bg-white/60 px-3 py-1.5 rounded-lg border border-blue-200">
                  {walletAddress}
                </p>
              </div>
            </div>
            <Badge variant="success" className="w-full sm:w-auto text-center">Đã kết nối</Badge>
          </div>
        </Card>
      )}

      {!walletAddress && (
        <Card className="p-5 sm:p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300/80 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-yellow-900 mb-1">Chưa có địa chỉ ví</p>
                <p className="text-sm text-yellow-700">
                  Vui lòng hoàn tất quá trình đăng ký để tham gia bầu cử.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="medium"
              onClick={() => navigate('/auth/wallet-onboarding')}
              className="w-full sm:w-auto"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Thiết lập ví
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Card className="p-0 overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
              activeTab === 'upcoming'
                ? 'bg-white text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Sắp diễn ra
            {upcomingCount > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'upcoming' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {upcomingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ongoing')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
              activeTab === 'ongoing'
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Đang diễn ra
            {ongoingCount > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'ongoing' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {ongoingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
              activeTab === 'ended'
                ? 'bg-white text-red-600 border-b-2 border-red-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Đã kết thúc
            {endedCount > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'ended' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
              }`}>
                {endedCount}
              </span>
            )}
          </button>
        </div>
      </Card>

      {/* Elections List */}
      {filteredElections.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'upcoming' 
              ? 'Chưa có election sắp diễn ra'
              : activeTab === 'ongoing'
              ? 'Chưa có election đang diễn ra'
              : 'Chưa có election đã kết thúc'
          }
          description={
            activeTab === 'upcoming'
              ? 'Hiện tại không có election nào sắp diễn ra'
              : activeTab === 'ongoing'
              ? 'Hiện tại không có election nào đang diễn ra'
              : 'Hiện tại không có election nào đã kết thúc'
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {filteredElections.map((election) => (
            <Card key={election.contractAddress} hoverable className="p-5 sm:p-6">
              <div className="mb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{election.title}</h3>
                      {getStateBadge(election.state)}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {election.isPublic ? (
                        <Badge variant="primary" className="text-xs">Public</Badge>
                      ) : (
                        <Badge variant="warning" className="text-xs">Private</Badge>
                      )}
                    </div>
                  <p className="text-gray-600 mb-3">{election.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Type: {election.electionType}</span>
                    <span>Start: {new Date(election.startTime).toLocaleString('vi-VN')}</span>
                    <span>End: {new Date(election.endTime).toLocaleString('vi-VN')}</span>
                  </div>
                </div>
              </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t">
                {(() => {
                  const now = new Date();
                  const startTime = new Date(election.startTime);
                  const endTime = new Date(election.endTime);
                  const isOngoing = startTime <= now && endTime >= now;
                  const isEnded = endTime < now;
                  const isUpcoming = startTime > now;

                  // Public election - register button (only if not registered and election hasn't started)
                  if (!election.isVoter && election.isPublic && isUpcoming) {
                    return (
                      <Button
                        onClick={() => handleRegister(election.contractAddress)}
                        disabled={registering === election.contractAddress}
                        variant="primary"
                      >
                        {registering === election.contractAddress ? 'Đang đăng ký...' : 'Đăng ký tham gia'}
                      </Button>
                    );
                  }

                  // Show vote button when election is ongoing and voter can vote
                  if (election.isVoter && !election.hasVoted && isOngoing) {
                    return (
                      <Button
                        onClick={() => handleOpenVoteModal(election.contractAddress)}
                        disabled={voting === election.contractAddress}
                        variant="primary"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {voting === election.contractAddress ? 'Đang bầu cử...' : 'Bầu cử'}
                      </Button>
                    );
                  }

                  // Show results button when election ended (for all voters)
                  if (isEnded) {
                    return (
                      <Button
                        onClick={() => navigate(`/elections/${election.contractAddress}/results`)}
                        variant="primary"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Xem Kết quả
                      </Button>
                    );
                  }

                  // Show status messages
                  if (election.isVoter && !election.hasVoted) {
                    if (isUpcoming) {
                      // Election hasn't started yet
                      return (
                        <div className="flex items-center gap-2">
                          <Badge variant="primary" className="bg-blue-100 text-blue-700">
                            Đã được thêm vào danh sách
                          </Badge>
                          <span className="text-sm text-blue-600 font-medium">
                            Chờ election bắt đầu để có thể bầu cử
                          </span>
                        </div>
                      );
                    }
                  }

                  // Private election - waiting for creator to add
                  if (!election.isVoter && !election.isPublic && isUpcoming) {
                    return (
                      <span className="text-sm text-gray-500">
                        Private election - Chờ creator thêm bạn vào danh sách
                      </span>
                    );
                  }

                  // Show voted badge (only if election is still ongoing)
                  if (election.hasVoted && !isEnded) {
                    return (
                      <Badge variant="success">Đã bầu cử</Badge>
                    );
                  }

                  return null;
                })()}

              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Vote Modal */}
      {showVoteModal && (
        <Modal
          isOpen={!!showVoteModal}
          onClose={() => {
            setShowVoteModal(null);
            setSelectedCandidate(null);
            setCandidates([]);
            setCurrentElection(null);
          }}
          title="Bầu cử"
          size="large"
        >
          <div className="space-y-6">
            {/* Election Information */}
            {currentElection && (
              <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{currentElection.title}</h3>
                {currentElection.description && (
                  <p className="text-sm text-gray-700 mb-3">{currentElection.description}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  <span><strong>Loại:</strong> {currentElection.electionType}</span>
                  <span><strong>Bắt đầu:</strong> {new Date(parseInt(currentElection.startTime) * 1000).toLocaleString('vi-VN')}</span>
                  <span><strong>Kết thúc:</strong> {new Date(parseInt(currentElection.endTime) * 1000).toLocaleString('vi-VN')}</span>
                  <span><strong>Số ứng viên:</strong> {candidates.length}</span>
                </div>
              </Card>
            )}

            {loadingCandidates ? (
              <div className="text-center py-8">
                <Skeleton className="h-32 w-full" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Không có ứng viên nào</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Chọn ứng viên:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {candidates.map((candidate) => {
                      // Use nullish coalescing (??) instead of OR (||) to handle candidateId = 0
                      const candidateId = candidate.candidateId ?? candidate.id;
                      return (
                        <Card
                          key={candidateId}
                          onClick={() => setSelectedCandidate(candidateId)}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedCandidate === candidateId
                              ? 'border-blue-500 bg-blue-50 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Candidate Image */}
                            {candidate.imageUrl && (
                              <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100">
                                <img
                                  src={candidate.imageUrl}
                                  alt={candidate.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-bold text-lg text-gray-900">{candidate.name}</h4>
                                <p className="text-sm text-gray-600 mt-1">{candidate.party}</p>
                                {candidate.age && (
                                  <p className="text-xs text-gray-500 mt-1">Tuổi: {candidate.age}</p>
                                )}
                                {candidate.manifesto && (
                                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{candidate.manifesto}</p>
                                )}
                              </div>
                              {selectedCandidate === candidateId && (
                                <Badge variant="success">Đã chọn</Badge>
                              )}
                            </div>
                          
                            {/* View Details Button */}
                            <Button
                              variant="outline"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowCandidateDetail(candidate);
                              }}
                              className="w-full mt-2"
                            >
                              Xem chi tiết
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    onClick={() => {
                      setShowVoteModal(null);
                      setSelectedCandidate(null);
                      setCandidates([]);
                      setCurrentElection(null);
                    }}
                    variant="outline"
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => handleVote(showVoteModal, selectedCandidate)}
                    disabled={(selectedCandidate === null || selectedCandidate === undefined) || voting === showVoteModal}
                    variant="primary"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {voting === showVoteModal ? 'Đang bầu cử...' : 'Xác nhận bầu cử'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Activity Log */}
      <Card title="Activity Log" className="mt-6">
        <ActivityLogPanel />
      </Card>

      {/* Candidate Detail Modal */}
      {showCandidateDetail && (
        <Modal
          isOpen={!!showCandidateDetail}
          onClose={() => setShowCandidateDetail(null)}
          title={`Chi tiết ứng viên: ${showCandidateDetail.name}`}
          size="large"
        >
          <div className="space-y-4">
            {/* Candidate Image */}
            {showCandidateDetail.imageUrl && (
              <div className="w-full h-64 rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={showCandidateDetail.imageUrl}
                  alt={showCandidateDetail.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 items-center justify-center hidden">
                  <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Candidate Info */}
            <div className="space-y-3">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{showCandidateDetail.name}</h3>
                <p className="text-lg text-gray-600 mt-1">{showCandidateDetail.party}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {showCandidateDetail.age && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tuổi</p>
                    <p className="text-base font-semibold text-gray-900">{showCandidateDetail.age}</p>
                  </div>
                )}
                {showCandidateDetail.voteCount !== undefined && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Số phiếu</p>
                    <p className="text-base font-semibold text-green-600">{showCandidateDetail.voteCount || 0}</p>
                  </div>
                )}
              </div>

              {showCandidateDetail.description && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Mô tả</p>
                  <p className="text-base text-gray-700 leading-relaxed">{showCandidateDetail.description}</p>
                </div>
              )}

              {showCandidateDetail.manifesto && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Tuyên ngôn</p>
                  <p className="text-base text-gray-700 leading-relaxed">{showCandidateDetail.manifesto}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                onClick={() => setShowCandidateDetail(null)}
                variant="outline"
              >
                Đóng
              </Button>
              <Button
                onClick={() => {
                  setSelectedCandidate(showCandidateDetail.candidateId ?? showCandidateDetail.id);
                  setShowCandidateDetail(null);
                }}
                variant="primary"
                className="bg-green-600 hover:bg-green-700"
              >
                Chọn ứng viên này
              </Button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
};

export default VoterDashboardRBAC;
