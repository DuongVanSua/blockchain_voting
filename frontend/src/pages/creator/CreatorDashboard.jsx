import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import apiService from '../../services/apiService';
import { ipfsService } from '../../services/ipfsService';
import contractService from '../../services/contractService';
import useWallet from '../../hooks/useWallet';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import WalletGuard from '../../components/wallet/WalletGuard';
import ActivityLogPanel from '../../components/logs/ActivityLogPanel';

const CreatorDashboard = () => {
  const navigate = useNavigate();
  const wallet = useWallet();
  const [elections, setElections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageVoters, setShowManageVoters] = useState(null);
  const [showEndElection, setShowEndElection] = useState(null);
  const [isAddingVoter, setIsAddingVoter] = useState(false);
  const [electionVoters, setElectionVoters] = useState([]);
  const [allVoters, setAllVoters] = useState([]);
  const [isLoadingVoters, setIsLoadingVoters] = useState(false);
  const [isLoadingAllVoters, setIsLoadingAllVoters] = useState(false);
  const [removingVoterAddress, setRemovingVoterAddress] = useState(null);
  const [voterSearchQuery, setVoterSearchQuery] = useState('');
  const fileInputRefs = useRef({});

  // Create election form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    electionType: 'LOCAL',
    startTime: '',
    endTime: '',
    allowRealtimeResults: false,
    isPublic: true,
    requireToken: false,
    tokenAmount: '0',
    candidates: [{ name: '', party: '', age: '', manifesto: '' }]
  });

  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getCreatorElections();
      // eslint-disable-next-line no-console
      console.log('[CreatorDashboard] Load elections response:', response);
      
      if (response.success) {
        const electionsList = response.elections || [];
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] Found elections:', electionsList.length);
        
        if (electionsList.length === 0) {
          setElections([]);
          setIsLoading(false);
          return;
        }
        
        // Enrich elections with database info
        const enrichedElections = await Promise.all(
          electionsList.map(async (election) => {
            try {
              // Get election from database
              const dbElection = await apiService.getElectionByContract(election.contractAddress);
              if (dbElection.success && dbElection.election) {
                // Get election state from contract (only if contract exists)
                let contractState = '0';
                try {
                  const { contractService } = await import('../../services/contractService');
                  const electionInfo = await contractService.getElectionInfo(election.contractAddress);
                  if (electionInfo?.success && electionInfo.contractExists !== false) {
                    contractState = electionInfo.info?.state?.toString() || '0';
                  }
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.warn('[CreatorDashboard] Error getting contract state:', err.message);
                  // Use default state '0' if contract doesn't exist
                }
                
                return {
                  ...election,
                  title: dbElection.election.title || election.title,
                  description: dbElection.election.description || '',
                  electionType: dbElection.election.electionType || 'LOCAL',
                  startTime: dbElection.election.startTime || election.creationTime,
                  endTime: dbElection.election.endTime || '',
                  state: contractState,
                  ipfsHash: dbElection.election.ipfsHash || election.ipfsCid
                };
              }
              // If no database record, use contract data
              return {
                ...election,
                state: election.state || '0'
              };
            } catch (err) {
              // eslint-disable-next-line no-console
              console.warn('Error enriching election:', err);
              // Return election with contract data only
              return {
                ...election,
                state: election.state || '0'
              };
            }
          })
        );
        
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] Enriched elections:', enrichedElections);
        setElections(enrichedElections);
      } else {
        // eslint-disable-next-line no-console
        console.error('[CreatorDashboard] API error:', response.error);
        toast.error(response.error || 'Không thể tải danh sách elections');
        setElections([]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[CreatorDashboard] Load elections error:', error);
      toast.error('Không thể tải danh sách elections: ' + (error.message || 'Lỗi không xác định'));
      setElections([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateElection = async () => {
    // Validate form
    if (!formData.title || !formData.description || !formData.startTime || !formData.endTime) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (formData.candidates.length < 2) {
      toast.error('Cần ít nhất 2 ứng viên');
      return;
    }

    if (formData.candidates.some(c => !c.name || !c.party || !c.age || !c.manifesto || !c.description)) {
      toast.error('Vui lòng điền đầy đủ thông tin cho tất cả ứng viên');
      return;
    }

    // Check if images are uploaded
    const candidatesWithoutImages = formData.candidates.filter(c => !c.imageHash);
    if (candidatesWithoutImages.length > 0) {
      toast.error('Vui lòng tải hình ảnh cho tất cả ứng viên');
      return;
    }

    const startTime = Math.floor(new Date(formData.startTime).getTime() / 1000);
    const endTime = Math.floor(new Date(formData.endTime).getTime() / 1000);

    if (endTime <= startTime) {
      toast.error('Thời gian kết thúc phải sau thời gian bắt đầu');
      return;
    }

    try {
      // Step 1: Upload metadata to IPFS
      const uploadToast = toast.loading('Đang upload metadata lên IPFS...');
      
      const gateway = import.meta.env.VITE_IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
      const candidatesForMetadata = formData.candidates.map((candidate) => {
        const imageCid = candidate.imageHash || candidate.imageCid || null;
        return {
          name: candidate.name,
          party: candidate.party,
          age: candidate.age,
          manifesto: candidate.manifesto,
          description: candidate.description || '',
          imageCid,
          imageUrl: imageCid ? `${gateway}${imageCid}` : null,
        };
      });

      const metadata = {
        title: formData.title,
        description: formData.description,
        electionType: formData.electionType,
        candidates: candidatesForMetadata,
        createdAt: new Date().toISOString()
      };

      const ipfsResult = await ipfsService.uploadJSON(metadata);
      toast.dismiss(uploadToast);
      
      if (!ipfsResult.success || !ipfsResult.hash) {
        throw new Error(ipfsResult.error || 'IPFS upload failed');
      }

      const ipfsCid = ipfsResult.hash;
      toast.success('Đã upload metadata lên IPFS');

      // Step 2: Deploy election contract via MetaMask
      const deployToast = toast.loading('Đang deploy contract... Vui lòng xác nhận trong MetaMask');
      
      const deployResult = await contractService.createElection(
        formData.title,
        formData.description,
        formData.electionType,
        startTime,
        endTime,
        formData.allowRealtimeResults,
        ipfsCid
      );

      toast.dismiss(deployToast);

      if (!deployResult.success || !deployResult.electionAddress) {
        throw new Error(deployResult.error || 'Failed to deploy election contract');
      }

      const electionAddress = deployResult.electionAddress;
      toast.success('Đã deploy contract thành công!');

      // Step 3: Initialize election with config and all candidates in one transaction
      const configToast = toast.loading('Đang cấu hình election và thêm ứng viên... Vui lòng xác nhận trong MetaMask');
      
      const ethersModule = await import('ethers');
      const { ethers } = ethersModule;
      const tokenAmount = formData.requireToken ? ethers.parseEther(formData.tokenAmount.toString() || '1') : 0;

      // Prepare candidates data
      const candidatesData = formData.candidates.map(c => ({
        name: c.name,
        party: c.party,
        age: parseInt(c.age),
        manifesto: c.manifesto || '',
        imageHash: c.imageHash || c.imageCid || '',
        imageCid: c.imageCid || ''
      }));

      // Initialize election with all candidates in one transaction
      const initResult = await contractService.initializeElectionWithCandidates(
        electionAddress,
        formData.isPublic,
        formData.requireToken,
        tokenAmount,
        candidatesData
      );

      if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to initialize election');
      }

      toast.dismiss(configToast);
      toast.success('Đã cấu hình election và thêm tất cả ứng viên thành công!');

      // Step 4: Save to backend database
      const saveToast = toast.loading('Đang lưu vào database...');
      
      const response = await apiService.saveElectionToDatabase({
        contractAddress: electionAddress,
        title: formData.title,
        description: formData.description,
        electionType: formData.electionType,
        startTime,
        endTime,
        ipfsCid,
        candidates: formData.candidates.map(c => ({
          name: c.name,
          party: c.party,
          age: parseInt(c.age),
          manifesto: c.manifesto,
          description: c.description || '',
          imageHash: c.imageHash || ''
        }))
      });

      toast.dismiss(saveToast);

      if (response.success) {
        toast.success('Đã tạo election thành công!');
        setShowCreateModal(false);
        resetForm();
        // Wait a bit for blockchain transaction to be mined and indexed
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] Election created, waiting before reload...');
        window.setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log('[CreatorDashboard] Reloading elections...');
          loadElections();
        }, 2000);
      } else {
        toast.error(response.error || 'Không thể lưu election vào database');
      }
    } catch (error) {
      console.error('Create election error:', error);
      if (error.code === 4001) {
        toast.error('Người dùng đã từ chối giao dịch');
      } else {
        toast.error(error.message || 'Không thể tạo election');
      }
    }
  };

  const loadElectionVoters = async (electionAddress) => {
    setIsLoadingVoters(true);
    try {
      const response = await apiService.getElectionVoters(electionAddress);
      if (response.success) {
        const voters = response.voters || [];
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] Loaded election voters:', voters);
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] Voter addresses:', voters.map(v => v.address || v.voterAddress));
        setElectionVoters(voters);
      } else {
        toast.error(response.error || 'Không thể tải danh sách voters');
        setElectionVoters([]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Load voters error:', error);
      toast.error(error.message || 'Không thể tải danh sách voters');
      setElectionVoters([]);
    } finally {
      setIsLoadingVoters(false);
    }
  };

  const loadAllVoters = async () => {
    setIsLoadingAllVoters(true);
    try {
      const response = await apiService.getAllVoters(voterSearchQuery);
      if (response.success) {
        setAllVoters(response.voters || []);
      } else {
        toast.error(response.error || 'Không thể tải danh sách voters');
        setAllVoters([]);
      }
    } catch (error) {
      console.error('Load all voters error:', error);
      toast.error(error.message || 'Không thể tải danh sách voters');
      setAllVoters([]);
    } finally {
      setIsLoadingAllVoters(false);
    }
  };

  // Load all voters when modal opens
  useEffect(() => {
    if (showManageVoters) {
      loadAllVoters();
      loadElectionVoters(showManageVoters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showManageVoters]);

  // Load all voters when search query changes (debounced)
  useEffect(() => {
    if (!showManageVoters) return;
    
    const timeoutId = window.setTimeout(() => {
      loadAllVoters();
    }, 500);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterSearchQuery, showManageVoters]);

  const handleAddVoter = async (electionAddress, voterAddress) => {
    if (!voterAddress || !/^0x[a-fA-F0-9]{40}$/.test(voterAddress)) {
      toast.error('Địa chỉ ví không hợp lệ');
      return;
    }

    setIsAddingVoter(true);
    try {
      // Step 1: Add voter to contract via MetaMask
      const addVoterToast = toast.loading('Đang thêm voter vào contract... Vui lòng xác nhận trong MetaMask');
      
      const addVoterResult = await contractService.addVoter(electionAddress, voterAddress);
      toast.dismiss(addVoterToast);
      
      if (!addVoterResult.success) {
        if (addVoterResult.error?.includes('user rejected') || addVoterResult.error?.includes('4001')) {
          toast.error('Người dùng đã từ chối giao dịch');
        } else {
          toast.error(addVoterResult.error || 'Không thể thêm voter vào contract');
        }
        return;
      }

      toast.success('Đã thêm voter vào contract!');

      // Step 2: Save to database
      // eslint-disable-next-line no-console
      console.log('[CreatorDashboard] Calling API to save voter to database:', { electionAddress, voterAddress });
      const saveToast = toast.loading('Đang lưu vào database...');
      
      try {
        const response = await apiService.addVoterToElection(electionAddress, voterAddress);
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] API response:', response);
        toast.dismiss(saveToast);
        
        if (!response.success) {
          // eslint-disable-next-line no-console
          console.error('[CreatorDashboard] Failed to save voter to database:', response.error);
          toast.error(`Đã thêm voter vào contract nhưng không thể lưu vào database: ${response.error}`, { duration: 5000 });
          // Continue anyway since contract was updated
        } else {
          toast.success('Đã lưu voter vào database');
          // eslint-disable-next-line no-console
          console.log('[CreatorDashboard] Successfully saved voter to database');
        }
      } catch (apiError) {
        // eslint-disable-next-line no-console
        console.error('[CreatorDashboard] Error calling API to save voter:', apiError);
        toast.dismiss(saveToast);
        toast.error(`Đã thêm voter vào contract nhưng lỗi khi lưu vào database: ${apiError.message}`, { duration: 5000 });
      }

      // Step 2: Mint VotingToken cho voter (yêu cầu MetaMask xác nhận)
      try {
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] Minting VotingToken for voter:', voterAddress);
        
        // Show loading toast
        const mintToast = toast.loading('Đang mint VotingToken... Vui lòng xác nhận trong MetaMask');
        
        // Mint 1 token (có thể điều chỉnh số lượng sau)
        const mintResult = await contractService.mintVotingToken(voterAddress, '1');
        
        if (mintResult.success) {
          toast.dismiss(mintToast);
          toast.success(`Đã mint 1 VotingToken cho ${voterAddress.slice(0, 10)}...${voterAddress.slice(-8)}`);
          // eslint-disable-next-line no-console
          console.log('[CreatorDashboard] Token minted successfully:', mintResult.transactionHash);
        } else {
          toast.dismiss(mintToast);
          // Log error but don't fail the whole operation
          // eslint-disable-next-line no-console
          console.error('[CreatorDashboard] Failed to mint token:', mintResult.error);
          toast.error(`Đã thêm voter nhưng không thể mint token: ${mintResult.error}`, {
            duration: 5000,
          });
        }
      } catch (mintError) {
        // eslint-disable-next-line no-console
        console.error('[CreatorDashboard] Error minting token:', mintError);
        // Don't fail the whole operation if mint fails
        toast.error(`Đã thêm voter nhưng lỗi khi mint token: ${mintError.message}`, {
          duration: 5000,
        });
      }
      
      // Reload both lists
      await loadElectionVoters(electionAddress);
      await loadAllVoters();
      
      // eslint-disable-next-line no-console
      console.log('[CreatorDashboard] Reloaded voters lists');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Add voter error:', error);
      toast.error(error.message || 'Không thể thêm voter');
    } finally {
      setIsAddingVoter(false);
    }
  };

  const handleRemoveVoter = async (electionAddress, voterAddress) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa voter ${voterAddress}?`)) {
      return;
    }

    setRemovingVoterAddress(voterAddress);
    try {
      const response = await apiService.removeVoterFromElection(electionAddress, voterAddress);
      if (response.success) {
        toast.success('Đã xóa voter thành công');
        // Reload voters list
        await loadElectionVoters(electionAddress);
      } else {
        toast.error(response.error || 'Không thể xóa voter');
      }
    } catch (error) {
      console.error('Remove voter error:', error);
      toast.error(error.message || 'Không thể xóa voter');
    } finally {
      setRemovingVoterAddress(null);
    }
  };

  const handleEndElection = async (electionAddress) => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc election này?')) {
      return;
    }

    try {
      const response = await apiService.endElection(electionAddress);
      if (response.success) {
        toast.success('Đã kết thúc election thành công');
        setShowEndElection(null);
        loadElections();
      } else {
        toast.error(response.error || 'Không thể kết thúc election');
      }
    } catch (error) {
      console.error('End election error:', error);
      toast.error(error.message || 'Không thể kết thúc election');
    }
  };

  const addCandidate = () => {
    setFormData(prev => ({
      ...prev,
      candidates: [...prev.candidates, { name: '', party: '', age: '', manifesto: '', description: '', image: null, imageHash: '' }]
    }));
  };

  const removeCandidate = (index) => {
    setFormData(prev => ({
      ...prev,
      candidates: prev.candidates.filter((_, i) => i !== index)
    }));
  };

  const updateCandidate = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      candidates: prev.candidates.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      )
    }));
  };

  const handleCandidateImageUpload = async (index, file) => {
    if (!file) return;
    
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Chỉ chấp nhận file ảnh JPG/PNG/WEBP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước file tối đa 5MB');
      return;
    }

    // Show preview
    const reader = new window.FileReader();
    reader.onload = (e) => {
      updateCandidate(index, 'imagePreview', e.target.result);
    };
    reader.readAsDataURL(file);

    updateCandidate(index, 'image', file);
    updateCandidate(index, 'imageHash', ''); // Reset hash

    // Upload to IPFS
    try {
      const toastId = `upload-${index}`;
      toast.loading('Đang tải hình ảnh lên IPFS...', { id: toastId });
      
      // eslint-disable-next-line no-console
      console.log('[Creator] Uploading image for candidate', index, file.name, file.size, 'bytes');
      const result = await ipfsService.uploadFile(file);
      
      // eslint-disable-next-line no-console
      console.log('[Creator] Upload result:', result);
      
      if (result.success && result.hash) {
        updateCandidate(index, 'imageHash', result.hash);
        toast.success('Đã tải hình ảnh lên IPFS thành công!', { id: toastId });
      } else {
        const errorMsg = result.error || 'Không thể tải hình ảnh lên IPFS';
        console.error('[Creator] Upload failed:', errorMsg);
        toast.error(errorMsg, { id: toastId });
      }
    } catch (error) {
      console.error('[Creator] Image upload error:', error);
      toast.error(error.message || 'Không thể tải hình ảnh lên IPFS', { id: `upload-${index}` });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      electionType: 'LOCAL',
      startTime: '',
      endTime: '',
      allowRealtimeResults: false,
      isPublic: true,
      requireToken: false,
      tokenAmount: '0',
      candidates: [{ name: '', party: '', age: '', manifesto: '', description: '', image: null, imageHash: '', imagePreview: null }]
    });
  };

  const getStateBadge = (state) => {
    const states = {
      '0': { label: 'Created', variant: 'primary' },
      '1': { label: 'Ongoing', variant: 'success' },
      '2': { label: 'Paused', variant: 'warning' },
      '3': { label: 'Ended', variant: 'error' },
      '4': { label: 'Finalized', variant: 'primary' }
    };
    const stateInfo = states[state] || { label: 'Unknown', variant: 'primary' };
    return <Badge variant={stateInfo.variant}>{stateInfo.label}</Badge>;
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Creator Dashboard
            </h1>
            <p className="text-gray-600 mt-2 text-base sm:text-lg">Quản lý elections của bạn</p>
          </div>
          <WalletGuard showConnectButton={false} showWarning={false}>
            <Button
              onClick={() => {
                if (!wallet.isConnected) {
                  toast.error('Vui lòng kết nối MetaMask để tạo election');
                  return;
                }
                setShowCreateModal(true);
              }}
              disabled={!wallet.isConnected}
              variant="primary"
              size="medium"
              className="w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              title={!wallet.isConnected ? 'Vui lòng kết nối MetaMask' : ''}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tạo Election Mới
            </Button>
          </WalletGuard>
        </div>

      {/* My Elections */}
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">My Elections</h2>
        
        {elections.length === 0 ? (
          <EmptyState
            title="Chưa có election nào"
            description="Tạo election đầu tiên của bạn để bắt đầu"
            action={
              <Button onClick={() => setShowCreateModal(true)} variant="primary">
                Tạo Election
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {elections.map((election) => (
              <Card
                key={election.contractAddress}
                hoverable
                className="p-5 sm:p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{election.title}</h3>
                      {getStateBadge(election.state)}
                    </div>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{election.description}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-4">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {election.electionType || 'LOCAL'}
                      </span>
                      {election.startTime && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(election.startTime).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      <span className="font-mono text-xs">Contract: {election.contractAddress.slice(0, 10)}...{election.contractAddress.slice(-8)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => navigate(`/dashboard/creator/elections/${election.contractAddress}`)}
                      variant="primary"
                      size="small"
                    >
                      Xem chi tiết
                    </Button>
                    {election.state === '0' && (
                      <Button
                        onClick={() => {
                          setShowManageVoters(election.contractAddress);
                          loadElectionVoters(election.contractAddress);
                        }}
                        variant="outline"
                        size="small"
                      >
                        Quản lý Voters
                      </Button>
                    )}
                    {(election.state === '1' || election.state === '2') && (
                      <Button
                        onClick={() => setShowEndElection(election.contractAddress)}
                        variant="primary"
                        size="small"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Công bố kết quả
                      </Button>
                    )}
                    {election.state === '3' && (
                      <Button
                        onClick={() => navigate(`/elections/${election.contractAddress}/results`)}
                        variant="outline"
                        size="small"
                      >
                        Xem Kết quả
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Create Election Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Tạo Election Mới"
        size="large"
      >
        <div className="space-y-6 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tiêu đề *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Ví dụ: Bầu cử Tổng thống 2024"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Mô tả về election..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loại Election *</label>
              <select
                value={formData.electionType}
                onChange={(e) => setFormData(prev => ({ ...prev, electionType: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="PRESIDENTIAL">Presidential</option>
                <option value="PARLIAMENTARY">Parliamentary</option>
                <option value="LOCAL">Local</option>
                <option value="REFERENDUM">Referendum</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loại Election</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Public (ai cũng có thể đăng ký)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Thời gian bắt đầu *</label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Thời gian kết thúc *</label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ứng viên * (tối thiểu 2)</label>
            <div className="space-y-3">
              {formData.candidates.map((candidate, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Ứng viên {index + 1}</span>
                    {formData.candidates.length > 1 && (
                      <Button
                        onClick={() => removeCandidate(index)}
                        variant="outline"
                        size="small"
                        className="text-red-600"
                      >
                        Xóa
                      </Button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {/* Image Upload */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Hình ảnh * {candidate.imageHash && <span className="text-green-600">✓ Đã tải lên IPFS</span>}
                      </label>
                      <div className="flex items-center gap-3">
                        {candidate.imagePreview ? (
                          <div className="relative">
                            <img 
                              src={candidate.imagePreview} 
                              alt={`Preview ${candidate.name || 'candidate'}`}
                              className="w-20 h-20 object-cover rounded-lg border border-gray-300"
                            />
                            <button
                              onClick={() => {
                                updateCandidate(index, 'image', null);
                                updateCandidate(index, 'imagePreview', null);
                                updateCandidate(index, 'imageHash', '');
                              }}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                            Chưa có ảnh
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            ref={(el) => {
                              if (el) fileInputRefs.current[`candidate-${index}`] = el;
                            }}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCandidateImageUpload(index, file);
                              // Reset input để có thể chọn lại file cùng tên
                              e.target.value = '';
                            }}
                            className="hidden"
                            id={`candidate-image-${index}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="small"
                            className="w-full cursor-pointer"
                            disabled={!!candidate.imageHash}
                            onClick={() => {
                              const input = fileInputRefs.current[`candidate-${index}`];
                              if (input) {
                                input.click();
                              }
                            }}
                          >
                            {candidate.imageHash ? '✓ Đã tải lên' : '+ Tải hình ảnh'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Tên *"
                        value={candidate.name}
                        onChange={(e) => updateCandidate(index, 'name', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Đảng *"
                        value={candidate.party}
                        onChange={(e) => updateCandidate(index, 'party', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Tuổi * (≥18)"
                        value={candidate.age}
                        onChange={(e) => updateCandidate(index, 'age', e.target.value)}
                        min="18"
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Tuyên ngôn *"
                        value={candidate.manifesto}
                        onChange={(e) => updateCandidate(index, 'manifesto', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Mô tả *</label>
                      <textarea
                        placeholder="Mô tả về ứng viên..."
                        value={candidate.description || ''}
                        onChange={(e) => updateCandidate(index, 'description', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={addCandidate} variant="outline" size="small">
                + Thêm Ứng viên
              </Button>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              variant="outline"
            >
              Hủy
            </Button>
            <Button onClick={handleCreateElection} variant="primary">
              Tạo Election
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage Voters Modal */}
      {showManageVoters && (
        <Modal
          isOpen={!!showManageVoters}
          onClose={() => {
            setShowManageVoters(null);
            setElectionVoters([]);
            setAllVoters([]);
            setVoterSearchQuery('');
          }}
          title="Quản lý Voters (Private Election)"
          className="max-w-6xl"
        >
          <div className="space-y-6">
            {/* Search Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tìm kiếm Voter
              </label>
              <input
                type="text"
                value={voterSearchQuery}
                onChange={(e) => setVoterSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tên hoặc email..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Available Voters (Not Added) */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Voters chưa được thêm ({allVoters.filter(v => {
                    if (!v.walletAddress) return false;
                    const addedAddresses = electionVoters.map(ev => {
                      const addr = ev.address || ev.voterAddress;
                      return addr?.toLowerCase();
                    }).filter(Boolean);
                    return !addedAddresses.includes(v.walletAddress.toLowerCase());
                  }).length})
                </h3>
                {isLoadingAllVoters ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {allVoters
                      .filter(v => {
                        // Only show voters with wallet address
                        if (!v.walletAddress) return false;
                        // Filter out voters already added
                        const addedAddresses = electionVoters.map(ev => {
                          const addr = ev.address || ev.voterAddress;
                          return addr?.toLowerCase();
                        }).filter(Boolean);
                        return !addedAddresses.includes(v.walletAddress.toLowerCase());
                      })
                      .map((voter) => (
                        <div key={voter.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{voter.name}</div>
                            <div className="text-sm text-gray-600">{voter.email}</div>
                            {voter.walletAddress && (
                              <code className="text-xs font-mono text-gray-500 mt-1 block">
                                {voter.walletAddress.slice(0, 10)}...{voter.walletAddress.slice(-8)}
                              </code>
                            )}
                          </div>
                          <Button
                            onClick={() => handleAddVoter(showManageVoters, voter.walletAddress)}
                            disabled={isAddingVoter || !voter.walletAddress}
                            variant="primary"
                            size="small"
                          >
                            {isAddingVoter ? 'Đang thêm...' : 'Thêm'}
                          </Button>
                        </div>
                      ))}
                    {allVoters.filter(v => {
                      if (!v.walletAddress) return false;
                      const addedAddresses = electionVoters.map(ev => {
                        const addr = ev.address || ev.voterAddress;
                        return addr?.toLowerCase();
                      }).filter(Boolean);
                      return !addedAddresses.includes(v.walletAddress.toLowerCase());
                    }).length === 0 && (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">Không có voter nào để thêm</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Added Voters */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Voters đã được thêm ({electionVoters.length})
                </h3>
                {isLoadingVoters ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : electionVoters.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Chưa có voter nào được thêm</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {electionVoters.map((voter, index) => {
                      // Get address from voter object (could be 'address' or 'voterAddress')
                      const voterAddr = (voter.address || voter.voterAddress);
                      // Try to find voter info from allVoters
                      const voterInfo = allVoters.find(v => 
                        v.walletAddress?.toLowerCase() === voterAddr?.toLowerCase()
                      );
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex-1">
                            {voterInfo ? (
                              <>
                                <div className="font-medium text-gray-900">{voterInfo.name}</div>
                                <div className="text-sm text-gray-600">{voterInfo.email}</div>
                                <code className="text-xs font-mono text-gray-500 mt-1 block">
                                  {voterAddr?.slice(0, 10)}...{voterAddr?.slice(-8)}
                                </code>
                              </>
                            ) : (
                              <code className="text-sm font-mono text-gray-900">
                                {voterAddr}
                              </code>
                            )}
                          </div>
                          <Button
                            onClick={() => handleRemoveVoter(showManageVoters, voterAddr)}
                            disabled={removingVoterAddress === voterAddr}
                            variant="outline"
                            size="small"
                            className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                          >
                            {removingVoterAddress === voterAddr ? 'Đang xóa...' : 'Xóa'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Activity Log */}
      <Card title="Activity Log" className="mt-6">
        <ActivityLogPanel />
      </Card>

      {/* End Election Modal */}
      {showEndElection && (
        <Modal
          isOpen={!!showEndElection}
          onClose={() => setShowEndElection(null)}
          title="Công bố kết quả"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Bạn có chắc chắn muốn kết thúc election này? Sau khi kết thúc, kết quả sẽ được công bố.
            </p>
            <div className="flex gap-3 justify-end">
              <Button onClick={() => setShowEndElection(null)} variant="outline">
                Hủy
              </Button>
              <Button
                onClick={() => handleEndElection(showEndElection)}
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
              >
                Công bố kết quả
              </Button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
};

export default CreatorDashboard;

