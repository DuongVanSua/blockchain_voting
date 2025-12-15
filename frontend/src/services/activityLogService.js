import apiService from './apiService';

class ActivityLogService {
  async getLogs(params = {}) {
    try {
      const response = await apiService.get('/api/activity-logs/logs', { params });
      // Handle both direct response and response.data
      const data = response?.data || response;
      if (data && typeof data === 'object') {
        return {
          logs: data.logs || [],
          total: data.total || 0,
          hasMore: data.hasMore || false,
        };
      }
      return { logs: [], total: 0, hasMore: false };
    } catch (error) {
      console.error('[ActivityLogService] Error fetching logs:', error);
      throw error;
    }
  }

  formatLog(log) {
    return {
      id: log.id,
      action: log.action,
      icon: log.icon,
      actor: log.actor,
      eventName: log.eventName,
      contractType: log.contractType,
      contractAddress: log.contractAddress,
      timestamp: log.timestamp,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      args: log.args,
    };
  }
}

export const activityLogService = new ActivityLogService();
export default activityLogService;

