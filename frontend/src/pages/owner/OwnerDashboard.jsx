import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import apiService from '../../services/apiService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Skeleton from '../../components/common/Skeleton';

const OwnerDashboard = () => {
  const [systemStatus, setSystemStatus] = useState(null);
  const [creators, setCreators] = useState([]);
  const [systemConfig, setSystemConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPausing, setIsPausing] = useState(false);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [newCreatorAddress, setNewCreatorAddress] = useState('');
  const [isAddingCreator, setIsAddingCreator] = useState(false);
  const [removingAddress, setRemovingAddress] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(null);
  const [configFormData, setConfigFormData] = useState({});
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, creatorsRes, configRes] = await Promise.allSettled([
        apiService.getSystemStatus(),
        apiService.getCreators(),
        apiService.getSystemConfig()
      ]);

      // Handle system status
      if (statusRes.status === 'fulfilled' && statusRes.value.success) {
        setSystemStatus(statusRes.value.isPaused);
      } else {
        const error = statusRes.status === 'rejected' ? statusRes.reason : statusRes.value.error;
        console.warn('Failed to load system status:', error);
        // Set default value if contract not deployed
        setSystemStatus(false);
      }

      // Handle creators
      if (creatorsRes.status === 'fulfilled' && creatorsRes.value.success) {
        setCreators(creatorsRes.value.creators || []);
      } else {
        const error = creatorsRes.status === 'rejected' ? creatorsRes.reason : creatorsRes.value.error;
        console.warn('Failed to load creators:', error);
        // Set empty array if contract not deployed
        setCreators([]);
      }

      // Handle system config
      if (configRes.status === 'fulfilled' && configRes.value.success) {
        setSystemConfig(configRes.value.config);
      } else {
        const error = configRes.status === 'rejected' ? configRes.reason : configRes.value.error;
        console.warn('Failed to load system config:', error);
        // Set default config if contract not deployed
        setSystemConfig(null);
      }

      // Only show error if ALL requests failed
      const allFailed = 
        (statusRes.status === 'rejected' || !statusRes.value?.success) &&
        (creatorsRes.status === 'rejected' || !creatorsRes.value?.success) &&
        (configRes.status === 'rejected' || !configRes.value?.success);

      if (allFailed) {
        toast.error('Không thể tải dữ liệu. Vui lòng kiểm tra smart contract đã được deploy chưa.');
      }
    } catch (error) {
      console.error('Load data error:', error);
      toast.error(`Không thể tải dữ liệu: ${error.message || 'Lỗi không xác định'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn tạm dừng toàn bộ hệ thống?')) {
      return;
    }

    setIsPausing(true);
    try {
      const response = await apiService.pauseSystem();
      if (response.success) {
        toast.success('Hệ thống đã được tạm dừng');
        setSystemStatus(true);
      } else {
        toast.error(response.error || 'Không thể tạm dừng hệ thống');
      }
    } catch (error) {
      console.error('Pause error:', error);
      toast.error(error.message || 'Không thể tạm dừng hệ thống');
    } finally {
      setIsPausing(false);
    }
  };

  const handleUnpause = async () => {
    setIsPausing(true);
    try {
      const response = await apiService.unpauseSystem();
      if (response.success) {
        toast.success('Hệ thống đã được kích hoạt lại');
        setSystemStatus(false);
      } else {
        toast.error(response.error || 'Không thể kích hoạt hệ thống');
      }
    } catch (error) {
      console.error('Unpause error:', error);
      toast.error(error.message || 'Không thể kích hoạt hệ thống');
    } finally {
      setIsPausing(false);
    }
  };

  const handleAddCreator = async () => {
    if (!newCreatorAddress || !/^0x[a-fA-F0-9]{40}$/.test(newCreatorAddress)) {
      toast.error('Địa chỉ ví không hợp lệ');
      return;
    }

    setIsAddingCreator(true);
    try {
      const response = await apiService.addCreator(newCreatorAddress);
      if (response.success) {
        toast.success('Đã thêm creator thành công');
        setShowAddCreator(false);
        setNewCreatorAddress('');
        // Wait a bit for blockchain transaction to be mined and indexed
        // eslint-disable-next-line no-console
        console.log('[OwnerDashboard] Creator added, waiting before reload...');
        window.setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log('[OwnerDashboard] Reloading creators...');
          loadData();
        }, 2000); // Wait 2 seconds for transaction to be mined
      } else {
        toast.error(response.error || 'Không thể thêm creator');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Add creator error:', error);
      toast.error(error.message || 'Không thể thêm creator');
    } finally {
      setIsAddingCreator(false);
    }
  };

  const handleRemoveCreator = async (address) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa creator ${address}?`)) {
      return;
    }

    setRemovingAddress(address);
    try {
      const response = await apiService.removeCreator(address);
      if (response.success) {
        toast.success('Đã xóa creator thành công');
        loadData();
      } else {
        toast.error(response.error || 'Không thể xóa creator');
      }
    } catch (error) {
      console.error('Remove creator error:', error);
      toast.error(error.message || 'Không thể xóa creator');
    } finally {
      setRemovingAddress(null);
    }
  };

  const handleUpdateConfig = async (type) => {
    const address = configFormData[type];
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast.error('Địa chỉ ví không hợp lệ');
      return;
    }

    setIsUpdatingConfig(true);
    try {
      let response;
      if (type === 'voterRegistry') {
        response = await apiService.updateVoterRegistry(address);
      } else if (type === 'votingToken') {
        response = await apiService.updateVotingToken(address);
      } else if (type === 'transferOwnership') {
        if (!window.confirm('Bạn có chắc chắn muốn chuyển quyền sở hữu? Hành động này không thể hoàn tác!')) {
          setIsUpdatingConfig(false);
          return;
        }
        response = await apiService.transferOwnership(address);
      }

      if (response?.success) {
        toast.success('Cập nhật thành công');
        setShowConfigModal(null);
        setConfigFormData({});
        loadData();
      } else {
        toast.error(response?.error || 'Không thể cập nhật');
      }
    } catch (error) {
      console.error('Update config error:', error);
      toast.error(error.message || 'Không thể cập nhật');
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleUpdateMinVotingAge = async () => {
    const age = parseInt(configFormData.minVotingAge);
    if (!age || age < 1 || age > 150) {
      toast.error('Tuổi không hợp lệ (1-150)');
      return;
    }

    setIsUpdatingConfig(true);
    try {
      const response = await apiService.updateMinVotingAge(age);
      if (response.success) {
        toast.success('Cập nhật tuổi tối thiểu thành công');
        setShowConfigModal(null);
        setConfigFormData({});
        loadData();
      } else {
        toast.error(response.error || 'Không thể cập nhật');
      }
    } catch (error) {
      console.error('Update min voting age error:', error);
      toast.error(error.message || 'Không thể cập nhật');
    } finally {
      setIsUpdatingConfig(false);
    }
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              Owner Dashboard
            </h1>
            <p className="text-gray-600 mt-2 text-base sm:text-lg">Quản lý hệ thống và election creators</p>
          </div>
        </div>

      {/* System Status Card */}
      <Card className="p-6 sm:p-8 hoverable">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Trạng thái hệ thống</h2>
          <Badge variant={systemStatus ? 'error' : 'success'}>
            {systemStatus ? 'Đã tạm dừng' : 'Đang hoạt động'}
          </Badge>
        </div>
        <p className="text-gray-600 mb-4">
          {systemStatus 
            ? 'Hệ thống đang bị tạm dừng. Tất cả các hoạt động bầu cử sẽ bị chặn.'
            : 'Hệ thống đang hoạt động bình thường.'
          }
        </p>
        <div className="flex gap-3">
          {systemStatus ? (
            <Button
              onClick={handleUnpause}
              disabled={isPausing}
              variant="primary"
              className="bg-green-600 hover:bg-green-700"
            >
              {isPausing ? 'Đang kích hoạt...' : 'Kích hoạt hệ thống'}
            </Button>
          ) : (
            <Button
              onClick={handlePause}
              disabled={isPausing}
              variant="primary"
              className="bg-red-600 hover:bg-red-700"
            >
              {isPausing ? 'Đang tạm dừng...' : 'Tạm dừng hệ thống (Emergency)'}
            </Button>
          )}
        </div>
      </Card>

      {/* System Configuration */}
      {systemConfig && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Cấu hình hệ thống</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded block break-all">
                  {systemConfig.owner}
                </code>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voter Registry</label>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded flex-1 break-all">
                    {systemConfig.voterRegistry}
                  </code>
                  <Button
                    onClick={() => {
                      setShowConfigModal('voterRegistry');
                      setConfigFormData({ voterRegistry: systemConfig.voterRegistry });
                    }}
                    variant="outline"
                    size="small"
                  >
                    Sửa
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voting Token</label>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded flex-1 break-all">
                    {systemConfig.votingToken}
                  </code>
                  <Button
                    onClick={() => {
                      setShowConfigModal('votingToken');
                      setConfigFormData({ votingToken: systemConfig.votingToken });
                    }}
                    variant="outline"
                    size="small"
                  >
                    Sửa
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Voting Age</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">{systemConfig.minVotingAge} tuổi</span>
                  <Button
                    onClick={() => {
                      setShowConfigModal('minVotingAge');
                      setConfigFormData({ minVotingAge: systemConfig.minVotingAge });
                    }}
                    variant="outline"
                    size="small"
                  >
                    Sửa
                  </Button>
                </div>
              </div>
            </div>
            <div className="pt-4 border-t">
              <Button
                onClick={() => {
                  setShowConfigModal('transferOwnership');
                  setConfigFormData({ transferOwnership: '' });
                }}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Chuyển quyền sở hữu (Danger)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Creators Management */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Election Creators</h2>
          <Button
            onClick={() => setShowAddCreator(true)}
            variant="primary"
            size="medium"
            className="w-full sm:w-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm Creator
          </Button>
        </div>

        {creators.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium">Chưa có creator nào</p>
            <p className="text-gray-400 text-sm mt-1">Thêm creator đầu tiên để bắt đầu</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden shadow-sm ring-1 ring-black/5 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Địa chỉ ví
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {creators.map((creator) => (
                      <tr key={creator.address} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <code className="text-sm font-mono text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg">
                            {creator.address}
                          </code>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <Badge variant="success">Active</Badge>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                          <Button
                            onClick={() => handleRemoveCreator(creator.address)}
                            disabled={removingAddress === creator.address}
                            variant="outline"
                            size="small"
                            className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                          >
                            {removingAddress === creator.address ? 'Đang xóa...' : 'Xóa'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Add Creator Modal */}
      <Modal
        isOpen={showAddCreator}
        onClose={() => {
          setShowAddCreator(false);
          setNewCreatorAddress('');
        }}
        title="Thêm Election Creator"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Địa chỉ ví Ethereum
            </label>
            <input
              type="text"
              value={newCreatorAddress}
              onChange={(e) => setNewCreatorAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Địa chỉ ví của người sẽ có quyền tạo elections
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => {
                setShowAddCreator(false);
                setNewCreatorAddress('');
              }}
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              onClick={handleAddCreator}
              disabled={isAddingCreator || !newCreatorAddress}
              variant="primary"
            >
              {isAddingCreator ? 'Đang thêm...' : 'Thêm Creator'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* System Config Modals */}
      {(showConfigModal === 'voterRegistry' || showConfigModal === 'votingToken' || showConfigModal === 'transferOwnership') && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowConfigModal(null);
            setConfigFormData({});
          }}
          title={
            showConfigModal === 'voterRegistry' ? 'Cập nhật Voter Registry' :
            showConfigModal === 'votingToken' ? 'Cập nhật Voting Token' :
            'Chuyển quyền sở hữu'
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Địa chỉ ví Ethereum
              </label>
              <input
                type="text"
                value={configFormData[showConfigModal] || ''}
                onChange={(e) => setConfigFormData({ ...configFormData, [showConfigModal]: e.target.value })}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {showConfigModal === 'transferOwnership' 
                  ? '[WARNING] Cảnh báo: Hành động này không thể hoàn tác!'
                  : 'Địa chỉ contract mới'
                }
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowConfigModal(null);
                  setConfigFormData({});
                }}
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                onClick={() => handleUpdateConfig(showConfigModal)}
                disabled={isUpdatingConfig || !configFormData[showConfigModal]}
                variant="primary"
                className={showConfigModal === 'transferOwnership' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {isUpdatingConfig ? 'Đang cập nhật...' : 'Cập nhật'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showConfigModal === 'minVotingAge' && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowConfigModal(null);
            setConfigFormData({});
          }}
          title="Cập nhật Tuổi tối thiểu"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tuổi tối thiểu để bầu cử
              </label>
              <input
                type="number"
                min="1"
                max="150"
                value={configFormData.minVotingAge || ''}
                onChange={(e) => setConfigFormData({ ...configFormData, minVotingAge: e.target.value })}
                placeholder="18"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Tuổi tối thiểu để một người có thể đăng ký và bầu cử
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => {
                  setShowConfigModal(null);
                  setConfigFormData({});
                }}
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                onClick={handleUpdateMinVotingAge}
                disabled={isUpdatingConfig || !configFormData.minVotingAge}
                variant="primary"
              >
                {isUpdatingConfig ? 'Đang cập nhật...' : 'Cập nhật'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
};

export default OwnerDashboard;

