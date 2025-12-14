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
  const [voters, setVoters] = useState([]);
  const [systemConfig, setSystemConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPausing, setIsPausing] = useState(false);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [newCreatorAddress, setNewCreatorAddress] = useState('');
  const [isAddingCreator, setIsAddingCreator] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(null);
  const [configFormData, setConfigFormData] = useState({});
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, creatorsRes, configRes, usersRes] = await Promise.allSettled([
        apiService.getSystemStatus(),
        apiService.getCreators(),
        apiService.getSystemConfig(),
        apiService.getUsers(searchQuery, '', 1, 1000) // Get all users
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

      // Handle users
      if (usersRes.status === 'fulfilled' && usersRes.value.success) {
        const allUsers = usersRes.value.users || [];
        // Filter by role
        setVoters(allUsers.filter(u => u.role === 'VOTER'));
        setCreators(allUsers.filter(u => u.role === 'CREATOR'));
      } else {
        const error = usersRes.status === 'rejected' ? usersRes.reason : usersRes.value.error;
        console.warn('Failed to load users:', error);
        setVoters([]);
        setCreators([]);
      }

      // Only show error if ALL requests failed
      const allFailed = 
        (statusRes.status === 'rejected' || !statusRes.value?.success) &&
        (creatorsRes.status === 'rejected' || !creatorsRes.value?.success) &&
        (configRes.status === 'rejected' || !configRes.value?.success) &&
        (usersRes.status === 'rejected' || !usersRes.value?.success);

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

  // Load users when search query changes
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadUsers();
    }, 500); // Debounce search

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const loadUsers = async () => {
    try {
      const response = await apiService.getUsers(searchQuery, '', 1, 1000);
      if (response.success) {
        const allUsers = response.users || [];
        setVoters(allUsers.filter(u => u.role === 'VOTER'));
        setCreators(allUsers.filter(u => u.role === 'CREATOR'));
      }
    } catch (error) {
      console.error('Load users error:', error);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển người dùng này thành ${newRole === 'CREATOR' ? 'Creator' : 'Voter'}?`)) {
      return;
    }

    setUpdatingUserId(userId);
    try {
      const response = await apiService.updateUserRole(userId, newRole);
      if (response.success) {
        toast.success(`Đã chuyển người dùng thành ${newRole === 'CREATOR' ? 'Creator' : 'Voter'} thành công`);
        // Wait a bit for blockchain transaction to be mined
        window.setTimeout(() => {
          loadUsers();
        }, 2000);
      } else {
        toast.error(response.error || 'Không thể chuyển đổi role');
      }
    } catch (error) {
      console.error('Update role error:', error);
      toast.error(error.message || 'Không thể chuyển đổi role');
    } finally {
      setUpdatingUserId(null);
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

      {/* Users Management */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Quản lý người dùng</h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên hoặc email..."
              className="flex-1 sm:flex-none sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Voters Table */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Voters ({voters.length})</h3>
          {voters.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Chưa có voter nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden shadow-sm ring-1 ring-black/5 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-blue-50 to-blue-100/50">
                      <tr>
                        <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Tên
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Địa chỉ ví
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Hành động
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {voters.map((voter) => (
                        <tr key={voter.id} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{voter.name}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{voter.email}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            {voter.walletAddress ? (
                              <code className="text-xs font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                {voter.walletAddress.slice(0, 10)}...{voter.walletAddress.slice(-8)}
                              </code>
                            ) : (
                              <span className="text-xs text-gray-400">Chưa có ví</span>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              onClick={() => handleRoleChange(voter.id, 'CREATOR')}
                              disabled={updatingUserId === voter.id || !voter.walletAddress}
                              variant="primary"
                              size="small"
                            >
                              {updatingUserId === voter.id ? 'Đang chuyển...' : 'Chuyển thành Creator'}
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
        </div>

        {/* Creators Table */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Creators ({creators.length})</h3>
          {creators.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Chưa có creator nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden shadow-sm ring-1 ring-black/5 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-purple-50 to-purple-100/50">
                      <tr>
                        <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Tên
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Địa chỉ ví
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Hành động
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {creators.map((creator) => (
                        <tr key={creator.id} className="hover:bg-purple-50/50 transition-colors">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{creator.name}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{creator.email}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            {creator.walletAddress ? (
                              <code className="text-xs font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                {creator.walletAddress.slice(0, 10)}...{creator.walletAddress.slice(-8)}
                              </code>
                            ) : (
                              <span className="text-xs text-gray-400">Chưa có ví</span>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                            <Button
                              onClick={() => handleRoleChange(creator.id, 'VOTER')}
                              disabled={updatingUserId === creator.id || !creator.walletAddress}
                              variant="outline"
                              size="small"
                              className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:border-orange-400"
                            >
                              {updatingUserId === creator.id ? 'Đang chuyển...' : 'Chuyển thành Voter'}
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
        </div>
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

