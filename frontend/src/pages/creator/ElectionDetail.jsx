import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import apiService from '../../services/apiService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Skeleton from '../../components/common/Skeleton';
import { deriveElectionStatus, getStatusBadge } from '../../utils/electionStatus';

const ElectionDetail = () => {
  const { electionAddress } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (electionAddress) {
      loadElectionDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electionAddress]);

  const loadElectionDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.getCreatorElectionDetail(electionAddress);
      if (response.success) {
        setElection(response.election);
      } else {
        setError(response.error || 'Không thể tải chi tiết election');
        toast.error(response.error || 'Không thể tải chi tiết election');
      }
    } catch (err) {
      setError(err.message || 'Không thể tải chi tiết election');
      toast.error(err.message || 'Không thể tải chi tiết election');
    } finally {
      setIsLoading(false);
    }
  };

  const getStateBadge = (state) => {
    const states = {
      '0': { label: 'Created', variant: 'primary', color: 'bg-blue-100 text-blue-800' },
      '1': { label: 'Ongoing', variant: 'success', color: 'bg-green-100 text-green-800' },
      '2': { label: 'Paused', variant: 'warning', color: 'bg-yellow-100 text-yellow-800' },
      '3': { label: 'Ended', variant: 'error', color: 'bg-red-100 text-red-800' },
      '4': { label: 'Finalized', variant: 'primary', color: 'bg-purple-100 text-purple-800' }
    };
    const stateInfo = states[state] || { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${stateInfo.color}`}>
        {stateInfo.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/30 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !election) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/30 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Không tìm thấy Election</h2>
            <p className="text-gray-600 mb-6">{error || 'Election không tồn tại'}</p>
            <Button onClick={() => navigate('/dashboard/creator')} variant="primary">
              Quay lại Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const contractInfo = election.contractInfo || {};
  const candidates = contractInfo.candidates || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-emerald-50/30 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/dashboard/creator')}
              variant="outline"
              size="small"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Quay lại
            </Button>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Chi tiết Election
            </h1>
          </div>
          {contractInfo.state && getStateBadge(contractInfo.state)}
        </div>

        {/* Election Info */}
        <Card className="p-6 sm:p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{election.title}</h2>
              <p className="text-gray-600 text-lg">{election.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Loại Election</h3>
                <p className="text-lg font-semibold text-gray-900">{election.electionType}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Trạng thái</h3>
                {(() => {
                  const derivedStatus = deriveElectionStatus(election.status, election.startTime, election.endTime);
                  const badge = getStatusBadge(derivedStatus);
                  return (
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Thời gian bắt đầu</h3>
                <p className="text-lg font-semibold text-gray-900">{formatDate(election.startTime)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Thời gian kết thúc</h3>
                <p className="text-lg font-semibold text-gray-900">{formatDate(election.endTime)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Số lượng Voters</h3>
                <p className="text-lg font-semibold text-gray-900">{election.votersCount || 0}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Tổng số phiếu bầu</h3>
                <p className="text-lg font-semibold text-gray-900">{contractInfo.totalVotes || 0}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Contract Address</h3>
              <code className="text-sm font-mono text-gray-700 bg-gray-100 px-3 py-2 rounded block break-all">
                {election.contractAddress}
              </code>
            </div>

            {election.ipfsHash && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">IPFS Hash</h3>
                <code className="text-sm font-mono text-gray-700 bg-gray-100 px-3 py-2 rounded block break-all">
                  {election.ipfsHash}
                </code>
              </div>
            )}
          </div>
        </Card>

        {/* Candidates */}
        {candidates.length > 0 && (
          <Card className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Danh sách Ứng cử viên ({candidates.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map((candidate, index) => (
                <Card key={index} className="p-5 border-2 hover:border-green-500 transition-all hover:shadow-lg">
                  <div className="space-y-4">
                    {/* Candidate Image */}
                    {candidate.imageUrl && (
                      <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={candidate.imageUrl}
                          alt={candidate.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-100 items-center justify-center hidden">
                          <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    )}
                    
                    {/* Candidate Info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-900">{candidate.name}</h3>
                        <Badge variant="primary">#{index + 1}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Đảng/Đoàn thể</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{candidate.party}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase">Tuổi</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{candidate.age}</p>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <p className="text-xs font-medium text-gray-500 uppercase mb-1">Số phiếu bầu</p>
                        <p className="text-2xl font-bold text-green-600">{candidate.voteCount || 0}</p>
                      </div>
                      
                      {candidate.description && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Mô tả</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{candidate.description}</p>
                        </div>
                      )}
                      
                      {candidate.manifesto && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Tuyên ngôn</p>
                          <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{candidate.manifesto}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <Card className="p-6">
          <div className="flex flex-wrap gap-4">
            {contractInfo.state === '0' && (
              <Button
                onClick={() => {
                  navigate('/dashboard/creator');
                  // Trigger manage voters modal from parent
                  window.dispatchEvent(new window.CustomEvent('manageVoters', { detail: election.contractAddress }));
                }}
                variant="outline"
              >
                Quản lý Voters
              </Button>
            )}
            {(contractInfo.state === '1' || contractInfo.state === '2') && (
              <Button
                onClick={async () => {
                  if (window.confirm('Bạn có chắc chắn muốn kết thúc election này?')) {
                    try {
                      const response = await apiService.endElection(election.contractAddress);
                      if (response.success) {
                        toast.success('Đã kết thúc election thành công');
                        window.setTimeout(() => {
                          loadElectionDetail();
                        }, 2000);
                      } else {
                        toast.error(response.error || 'Không thể kết thúc election');
                      }
                    } catch (err) {
                      toast.error(err.message || 'Không thể kết thúc election');
                    }
                  }
                }}
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
              >
                Công bố kết quả
              </Button>
            )}
            {contractInfo.state === '3' && (
              <Button
                onClick={() => navigate(`/elections/${election.contractAddress}/results`)}
                variant="primary"
              >
                Xem Kết quả
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ElectionDetail;

