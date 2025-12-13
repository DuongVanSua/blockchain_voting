import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import apiService from '../../services/apiService';
import { ipfsService } from '../../services/ipfsService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';

const CreatorDashboard = () => {
  const navigate = useNavigate();
  const [elections, setElections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageVoters, setShowManageVoters] = useState(null);
  const [showEndElection, setShowEndElection] = useState(null);
  const [newVoterAddress, setNewVoterAddress] = useState('');
  const [isAddingVoter, setIsAddingVoter] = useState(false);
  const [electionVoters, setElectionVoters] = useState([]);
  const [isLoadingVoters, setIsLoadingVoters] = useState(false);
  const [removingVoterAddress, setRemovingVoterAddress] = useState(null);
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
                // Get election state from contract
                const { contractService } = await import('../../services/contractService');
                const electionInfo = await contractService.getElectionInfo(election.contractAddress);
                
                return {
                  ...election,
                  title: dbElection.election.title || election.title,
                  description: dbElection.election.description || '',
                  electionType: dbElection.election.electionType || 'LOCAL',
                  startTime: dbElection.election.startTime || election.creationTime,
                  endTime: dbElection.election.endTime || '',
                  state: electionInfo?.success ? electionInfo.info?.state?.toString() : '0',
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
      const response = await apiService.createElectionAsCreator({
        title: formData.title,
        description: formData.description,
        electionType: formData.electionType,
        startTime,
        endTime,
        allowRealtimeResults: formData.allowRealtimeResults,
        isPublic: formData.isPublic,
        requireToken: formData.requireToken,
        tokenAmount: formData.tokenAmount,
        candidates: formData.candidates.map(c => ({
          name: c.name,
          party: c.party,
          age: parseInt(c.age),
          manifesto: c.manifesto,
          description: c.description || '',
          imageHash: c.imageHash || ''
        }))
      });

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
        }, 2000); // Wait 2 seconds for transaction to be mined
      } else {
        toast.error(response.error || 'Không thể tạo election');
      }
    } catch (error) {
      console.error('Create election error:', error);
      toast.error(error.message || 'Không thể tạo election');
    }
  };

  const loadElectionVoters = async (electionAddress) => {
    setIsLoadingVoters(true);
    try {
      const response = await apiService.getElectionVoters(electionAddress);
      if (response.success) {
        setElectionVoters(response.voters || []);
      } else {
        toast.error(response.error || 'Không thể tải danh sách voters');
        setElectionVoters([]);
      }
    } catch (error) {
      console.error('Load voters error:', error);
      toast.error(error.message || 'Không thể tải danh sách voters');
      setElectionVoters([]);
    } finally {
      setIsLoadingVoters(false);
    }
  };

  const handleAddVoter = async (electionAddress) => {
    if (!newVoterAddress || !/^0x[a-fA-F0-9]{40}$/.test(newVoterAddress)) {
      toast.error('Địa chỉ ví không hợp lệ');
      return;
    }

    setIsAddingVoter(true);
    try {
      const response = await apiService.addVoterToElection(electionAddress, newVoterAddress);
      if (response.success) {
        toast.success('Đã thêm voter thành công');
        setNewVoterAddress('');
        // Wait a bit for blockchain transaction to be mined and indexed
        // eslint-disable-next-line no-console
        console.log('[CreatorDashboard] Voter added, waiting before reload...');
        window.setTimeout(async () => {
          // eslint-disable-next-line no-console
          console.log('[CreatorDashboard] Reloading voters list...');
          await loadElectionVoters(electionAddress);
        }, 2000); // Wait 2 seconds for transaction to be mined
      } else {
        toast.error(response.error || 'Không thể thêm voter');
      }
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
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            size="medium"
            className="w-full sm:w-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo Election Mới
          </Button>
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
                  <div className="flex gap-2">
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
                        Kết thúc Election
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
            setNewVoterAddress('');
            setElectionVoters([]);
          }}
          title="Quản lý Voters (Private Election)"
        >
          <div className="space-y-4">
            {/* Add Voter Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Thêm Voter (Địa chỉ ví)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVoterAddress}
                  onChange={(e) => setNewVoterAddress(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button
                  onClick={() => handleAddVoter(showManageVoters)}
                  disabled={isAddingVoter || !newVoterAddress}
                  variant="primary"
                >
                  {isAddingVoter ? 'Đang thêm...' : 'Thêm'}
                </Button>
              </div>
            </div>

            {/* Voters List Section */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Danh sách Voters ({electionVoters.length})
              </h3>
              
              {isLoadingVoters ? (
                <div className="text-center py-4 text-gray-500">
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : electionVoters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Chưa có voter nào được thêm</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {electionVoters.map((voter, index) => (
                    <div
                      key={`${voter.address}-${index}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                    >
                      <div className="flex-1">
                        <code className="text-sm font-mono text-gray-900 break-all">
                          {voter.address}
                        </code>
                        {voter.timestamp && (
                          <p className="text-xs text-gray-500 mt-1">
                            Đã thêm: {new Date(parseInt(voter.timestamp) * 1000).toLocaleString('vi-VN')}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => handleRemoveVoter(showManageVoters, voter.address)}
                        disabled={removingVoterAddress === voter.address}
                        variant="outline"
                        size="small"
                        className="text-red-600 hover:text-red-700 ml-3"
                      >
                        {removingVoterAddress === voter.address ? 'Đang xóa...' : 'Xóa'}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* End Election Modal */}
      {showEndElection && (
        <Modal
          isOpen={!!showEndElection}
          onClose={() => setShowEndElection(null)}
          title="Kết thúc Election"
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
                Kết thúc Election
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

