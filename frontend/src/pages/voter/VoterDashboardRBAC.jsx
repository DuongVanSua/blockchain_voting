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
      const result = await contractService.getCandidates(electionAddress);
      if (result.success) {
        setCandidates(result.candidates || []);
      } else {
        toast.error('Không thể tải danh sách ứng viên');
      }
    } catch (error) {
      console.error('Load candidates error:', error);
      toast.error('Không thể tải danh sách ứng viên');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleOpenVoteModal = async (electionAddress) => {
    setShowVoteModal(electionAddress);
    setSelectedCandidate(null);
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
    if (!window.ethereum) {
      toast.error('Vui lòng cài đặt MetaMask');
      return;
    }

    if (!candidateId) {
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

      if (statusRes.state !== '1') {
        toast.error('Election chưa bắt đầu hoặc đã kết thúc');
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
      
      const contractABI = [
        "function vote(uint256 candidateId, bytes32 voteHash) external",
        "function hasVoterVoted(address) external view returns (bool)",
        "function canVote(address) external view returns (bool)",
        "function state() external view returns (uint8)"
      ];
      
      const contract = new ethers.Contract(electionAddress, contractABI, signer);
      const tx = await contract.vote(candidateId, voteHash);
      await tx.wait();

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

      {/* Elections List */}
      {elections.length === 0 ? (
        <EmptyState
          title="Chưa có election nào"
          description="Hiện tại không có election nào đang diễn ra"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {elections.map((election) => (
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
                {!election.isVoter && election.isPublic && election.state === '0' && (
                  <Button
                    onClick={() => handleRegister(election.contractAddress)}
                    disabled={registering === election.contractAddress}
                    variant="primary"
                  >
                    {registering === election.contractAddress ? 'Đang đăng ký...' : 'Đăng ký tham gia'}
                  </Button>
                )}

                {election.isVoter && !election.hasVoted && election.state === '1' && (
                  <Button
                    onClick={() => handleOpenVoteModal(election.contractAddress)}
                    disabled={voting === election.contractAddress}
                    variant="primary"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Bầu cử
                  </Button>
                )}

                {election.hasVoted && (
                  <Badge variant="success">Đã bầu cử</Badge>
                )}

                {(election.state === '3' || election.state === '4') && (
                  <Button
                    onClick={() => navigate(`/elections/${election.contractAddress}/results`)}
                    variant="outline"
                  >
                    Xem Kết quả
                  </Button>
                )}

                {!election.canVote && !election.isVoter && !election.isPublic && (
                  <span className="text-sm text-gray-500">
                    Private election - Chờ creator thêm bạn vào danh sách
                  </span>
                )}
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
          }}
          title="Bầu cử"
          size="large"
        >
          <div className="space-y-6">
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
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Chọn ứng viên:</h3>
                  {candidates.map((candidate) => (
                    <div
                      key={candidate.candidateId}
                      onClick={() => setSelectedCandidate(candidate.candidateId)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedCandidate === candidate.candidateId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{candidate.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{candidate.party}</p>
                          {candidate.manifesto && (
                            <p className="text-sm text-gray-500 mt-2">{candidate.manifesto}</p>
                          )}
                        </div>
                        {selectedCandidate === candidate.candidateId && (
                          <Badge variant="success">Đã chọn</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    onClick={() => {
                      setShowVoteModal(null);
                      setSelectedCandidate(null);
                      setCandidates([]);
                    }}
                    variant="outline"
                  >
                    Hủy
                  </Button>
                  <Button
                    onClick={() => handleVote(showVoteModal, selectedCandidate)}
                    disabled={!selectedCandidate || voting === showVoteModal}
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
      </div>
    </div>
  );
};

export default VoterDashboardRBAC;
