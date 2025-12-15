
import { API_ENDPOINTS } from '../config/api';

class APIService {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('api_token');
      if (!this.token) {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
          try {
            const parsed = JSON.parse(authStorage);
            if (parsed?.state?.token) {
              this.token = parsed.state.token;
              localStorage.setItem('api_token', this.token);
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to parse auth storage:', e);
          }
        }
      }
    } else {
      this.token = null;
    }
  }


  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('api_token', token);
    } else {
      localStorage.removeItem('api_token');
    }
  }


  getToken() {
    if (!this.token) {
      this.token = localStorage.getItem('api_token');
    }
    return this.token;
  }


  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug('[API] Token found, adding to headers');
        }
      } else {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[API] No token available for authenticated request');
          // eslint-disable-next-line no-console
          console.warn('[API] Token in instance:', this.token);
          // eslint-disable-next-line no-console
          console.warn('[API] Token in localStorage:', localStorage.getItem('api_token'));
        }
      }
    }

    return headers;
  }


  async handleResponse(response) {
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    let data;
    try {
      if (isJson) {
        data = await response.json();
      } else {
        const text = await response.text();
        // Check if response is HTML (error page)
        if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
          // eslint-disable-next-line no-console
          console.error('[API] Received HTML instead of JSON. Response:', text.substring(0, 500));
          throw new Error(`Server returned HTML error page (${response.status}). Check backend logs for details.`);
        }
        // Try to parse as JSON anyway
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
    } catch (parseError) {
      // eslint-disable-next-line no-console
      console.error('[API] Failed to parse response:', parseError);
      throw new Error(`Failed to parse server response: ${parseError.message}`);
    }

    if (!response.ok) {

      let errorMessage = `HTTP error! status: ${response.status}`;

      if (data) {

        if (data.detail) {
          if (Array.isArray(data.detail)) {

            errorMessage = data.detail
              .map(err => {
                if (typeof err === 'string') {
                  return err;
                }
                if (err && typeof err === 'object') {
                  const field = err.loc && Array.isArray(err.loc) && err.loc.length > 1
                    ? err.loc[err.loc.length - 1]
                    : 'field';
                  const msg = err.msg || err.message || JSON.stringify(err);
                  return `${field}: ${msg}`;
                }
                return String(err);
              })
              .join('; ');
          } else if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (data.detail && typeof data.detail === 'object') {
            errorMessage = JSON.stringify(data.detail);
          }
        } else if (data.error) {
          errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        } else if (data.message) {
          errorMessage = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
        } else if (typeof data === 'string') {
          errorMessage = data;
        } else if (typeof data === 'object') {

          errorMessage = JSON.stringify(data);
        } else {
          errorMessage = String(data);
        }
      }


      const finalErrorMessage = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
      throw new Error(finalErrorMessage);
    }

    return data;
  }


  async request(url, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {},
      includeAuth = true,
    } = options;

    // If URL is relative (starts with /), prepend baseURL
    let fullUrl = url;
    if (url.startsWith('/')) {
      fullUrl = `${this.baseURL}${url}`;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // If URL doesn't start with http/https and doesn't start with /, assume it's relative
      fullUrl = `${this.baseURL}/${url}`;
    }

    const requestHeaders = {
      ...this.getHeaders(includeAuth),
      ...headers,
    };

    const config = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      // Only stringify if body is not already a string
      if (typeof body === 'string') {
        config.body = body;
      } else {
        config.body = JSON.stringify(body);
      }
    }


    if (import.meta.env.DEV) {
      if (includeAuth) {
        const token = this.getToken();
        if (!token) {
          // eslint-disable-next-line no-console
          console.warn(`[API] Request to ${fullUrl} has no token`);
          // eslint-disable-next-line no-console
          console.warn(`[API] Headers:`, requestHeaders);
        } else {
          // eslint-disable-next-line no-console
          console.debug(`[API] Request to ${fullUrl} with token: ${token.substring(0, 20)}...`);
          // eslint-disable-next-line no-console
          console.debug(`[API] Authorization header:`, requestHeaders.Authorization ? `${requestHeaders.Authorization.substring(0, 30)}...` : 'MISSING');
        }
      }
    }

    try {
      const response = await window.fetch(fullUrl, config);


      // Handle 401 Unauthorized - Token expired
      if (!response.ok && response.status === 401) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error(`[API] Request failed: ${method} ${url} - ${response.status} ${response.statusText}`);
          // eslint-disable-next-line no-console
          console.error(`[API] 401 Unauthorized - Token may be missing or invalid`);
        }
        
        if (typeof window !== 'undefined' && includeAuth) {
          const token = this.getToken();
          if (token) {
            // eslint-disable-next-line no-console
            console.warn(`[API] Token expired. Attempting to refresh or redirecting to login...`);
            
            // Try to get refresh token from auth store
            const authStore = localStorage.getItem('auth-storage');
            let refreshToken = null;
            if (authStore) {
              try {
                const parsed = JSON.parse(authStore);
                refreshToken = parsed?.state?.refreshToken;
              } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('Failed to parse auth storage:', e);
              }
            }
            
            // Try to refresh token if available
            if (refreshToken) {
              try {
                // eslint-disable-next-line no-console
                console.log('[API] Attempting to refresh token...');
                const refreshResponse = await this.refreshToken(refreshToken);
                if (refreshResponse.success && refreshResponse.token) {
                  // eslint-disable-next-line no-console
                  console.log('[API] Token refreshed successfully, retrying request...');
                  // Retry the original request with new token
                  const newHeaders = {
                    ...this.getHeaders(includeAuth),
                    ...headers,
                  };
                  const retryConfig = {
                    method,
                    headers: newHeaders,
                  };
                  if (body && method !== 'GET') {
                    // Only stringify if body is not already a string
                    if (typeof body === 'string') {
                      retryConfig.body = body;
                    } else {
                      retryConfig.body = JSON.stringify(body);
                    }
                  }
                  const retryResponse = await window.fetch(url, retryConfig);
                  return await this.handleResponse(retryResponse);
                }
              } catch (refreshError) {
                // eslint-disable-next-line no-console
                console.error('[API] Token refresh failed:', refreshError);
              }
            }
            
            // If refresh failed or no refresh token, clear auth and redirect
            this.setToken(null);
            localStorage.removeItem('api_token');
            
            if (authStore) {
              try {
                const parsed = JSON.parse(authStore);
                if (parsed?.state) {
                  parsed.state.token = null;
                  parsed.state.isAuthenticated = false;
                  parsed.state.user = null;
                  localStorage.setItem('auth-storage', JSON.stringify(parsed));
                }
              } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('Failed to update auth storage:', e);
              }
            }
            
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
              // Show toast notification before redirect
              if (window.toast) {
                window.toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
              }
              window.setTimeout(() => {
                window.location.href = '/login';
              }, 1000);
            }
          }
        }
      }

      return await this.handleResponse(response);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('API request error:', error);

      if (error instanceof Error) {
        throw error;
      } else {
        const errorMsg = typeof error === 'string' ? error : JSON.stringify(error);
        throw new Error(errorMsg);
      }
    }
  }




  async register(userData) {
    return this.request(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: userData,
      includeAuth: false,
    });
  }


  async login(email, password) {
    const response = await this.request(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: { email, password },
      includeAuth: false,
    });

    if (response.success && response.token) {
      this.setToken(response.token.access_token);
    }

    return response;
  }


  async logout() {
    try {
      await this.request(API_ENDPOINTS.AUTH.LOGOUT, {
        method: 'POST',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Logout error:', error);
    } finally {
      this.setToken(null);
    }
  }


  async refreshToken(refreshToken) {
    const response = await this.request(API_ENDPOINTS.AUTH.REFRESH, {
      method: 'POST',
      body: { refresh_token: refreshToken },
      includeAuth: false,
    });

    if (response.success && response.token) {
      this.setToken(response.token.access_token);
    }

    return response;
  }


  async getCurrentUser() {
    return this.request(API_ENDPOINTS.AUTH.ME);
  }

  // Update wallet address
  async updateWalletAddress(walletAddress) {
    return this.request(API_ENDPOINTS.AUTH.UPDATE_WALLET, {
      method: 'PUT',
      body: { walletAddress },
    });
  }

  // Get nonce for SIWE
  async getNonce() {
    return this.request(API_ENDPOINTS.AUTH.NONCE);
  }

  // Verify signature for SIWE
  async verifySignature({ walletAddress, signature, nonce }) {
    return this.request(API_ENDPOINTS.AUTH.VERIFY_SIGNATURE, {
      method: 'POST',
      body: { walletAddress, signature, nonce },
    });
  }

  // Relay vote (Gasless Voting)
  async relayVote(voteData) {
    return this.request(API_ENDPOINTS.VOTES.RELAY, {
      method: 'POST',
      body: voteData,
    });
  }




  // User management (Owner only - not used in frontend UI currently)
  async getUser(userId) {
    return this.request(API_ENDPOINTS.USERS.DETAIL(userId));
  }




  async submitKYC(kycData) {
    return this.request(API_ENDPOINTS.KYC.SUBMIT, {
      method: 'POST',
      body: kycData,
    });
  }


  async getKYCStatus() {
    return this.request(API_ENDPOINTS.KYC.STATUS);
  }


  async getKYCSubmissions() {
    return this.request(API_ENDPOINTS.KYC.SUBMISSIONS);
  }


  async getPendingKYC(limit = 100) {
    const url = `${API_ENDPOINTS.KYC.PENDING}?limit=${limit}`;
    return this.request(url);
  }


  async getKYCDetails(kycId) {
    return this.request(API_ENDPOINTS.KYC.DETAIL(kycId));
  }


  async approveKYC(kycId, adminNotes = null) {
    return this.request(API_ENDPOINTS.KYC.APPROVE(kycId), {
      method: 'POST',
      body: { admin_notes: adminNotes },
    });
  }


  async rejectKYC(kycId, reason, adminNotes = null) {
    return this.request(API_ENDPOINTS.KYC.REJECT(kycId), {
      method: 'POST',
      body: {
        reason,
        admin_notes: adminNotes,
      },
    });
  }




  // Activity logs (Owner only - not used in frontend UI currently)
  // async getActivities(params = {}) {
  //   const { page = 1, limit = 50, user_id } = params;
  //   const queryParams = new window.URLSearchParams({
  //     page: page.toString(),
  //     limit: limit.toString(),
  //   });

  //   if (user_id) {
  //     queryParams.append('user_id', user_id.toString());
  //   }

  //   const url = `${API_ENDPOINTS.ACTIVITIES.LIST}?${queryParams.toString()}`;
  //   return this.request(url);
  // }




  // Deprecated: Use createElectionAsCreator instead
  // async createElection(electionData) {
  //   return this.request(API_ENDPOINTS.ELECTIONS.CREATE, {
  //     method: 'POST',
  //     body: electionData,
  //   });
  // }


  async getElections(params = {}) {
    const { page = 1, limit = 100, status, created_by } = params;
    const queryParams = new window.URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status) {
      queryParams.append('status', status);
    }

    if (created_by) {
      queryParams.append('created_by', created_by.toString());
    }

    const url = `${API_ENDPOINTS.ELECTIONS.LIST}?${queryParams.toString()}`;
    return this.request(url);
  }


  async getElection(electionId) {
    return this.request(API_ENDPOINTS.ELECTIONS.DETAIL(electionId));
  }


  // Deprecated: Election management is now done via Creator routes

  async getElectionByContract(contractAddress) {
    try {
      const result = await this.request(API_ENDPOINTS.ELECTIONS.BY_CONTRACT(contractAddress), {
        method: 'GET',
      });
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Get election by contract error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get election by contract address',
      };
    }
  }

  async pauseElection(electionId) {
    return this.request(API_ENDPOINTS.ELECTIONS.PAUSE(electionId), {
      method: 'POST',
    });
  }

  async resumeElection(electionId) {
    return this.request(API_ENDPOINTS.ELECTIONS.RESUME(electionId), {
      method: 'POST',
    });
  }




  async getIPFSStatus() {
    try {
      const response = await this.request(API_ENDPOINTS.IPFS.STATUS, {
        includeAuth: false,
      });


      return {
        success: true,
        connected: response?.connected === true,
        ...response,
      };
    } catch (error) {

      return {
        success: false,
        connected: false,
        error: error.message || 'Failed to check IPFS status',
      };
    }
  }




  // Deprecated: Not used anymore
  // async getAdminWallet() {
  //   return {
  //     success: true,
  //     wallet_address: '0xbc5575790975F2C963AbECA62f9eAEb8c3aB073A',
  //     private_key: '0x5da29cffea08ef3e94992c884e60cbd71c29d77e107346c7a385f02765a2f953'
  //   };
  // }




  // Dashboard statistics (Owner only - not used in frontend UI currently)
  // async getDashboardStatistics() {
  //   return this.request(API_ENDPOINTS.DASHBOARD.STATISTICS);
  // }

  // Owner APIs
  async getSystemStatus() {
    return this.request(API_ENDPOINTS.OWNER.STATUS);
  }

  async pauseSystem() {
    return this.request(API_ENDPOINTS.OWNER.PAUSE, {
      method: 'POST',
    });
  }

  async unpauseSystem() {
    return this.request(API_ENDPOINTS.OWNER.UNPAUSE, {
      method: 'POST',
    });
  }

  async getCreators() {
    return this.request(API_ENDPOINTS.OWNER.CREATORS);
  }

  async addCreator(address) {
    return this.request(API_ENDPOINTS.OWNER.ADD_CREATOR, {
      method: 'POST',
      body: { address },
    });
  }

  async removeCreator(address) {
    return this.request(API_ENDPOINTS.OWNER.REMOVE_CREATOR(address), {
      method: 'DELETE',
    });
  }

  // Get users with search and role filter
  async getUsers(search = '', role = '', page = 1, limit = 100) {
    const params = new window.URLSearchParams();
    if (search) params.append('search', search);
    if (role) params.append('role', role);
    params.append('page', page);
    params.append('limit', limit);
    return this.request(`${API_ENDPOINTS.OWNER.USERS}?${params.toString()}`);
  }

  // Update user role (VOTER <-> CREATOR)
  async updateUserRole(userId, role) {
    return this.request(API_ENDPOINTS.OWNER.UPDATE_USER_ROLE(userId), {
      method: 'PUT',
      body: { role },
    });
  }

  async getSystemConfig() {
    return this.request(API_ENDPOINTS.OWNER.CONFIG);
  }

  async updateVoterRegistry(address) {
    return this.request(API_ENDPOINTS.OWNER.UPDATE_VOTER_REGISTRY, {
      method: 'PUT',
      body: { address }
    });
  }

  async updateVotingToken(address) {
    return this.request(API_ENDPOINTS.OWNER.UPDATE_VOTING_TOKEN, {
      method: 'PUT',
      body: { address }
    });
  }

  async transferOwnership(address) {
    return this.request(API_ENDPOINTS.OWNER.TRANSFER_OWNERSHIP, {
      method: 'PUT',
      body: { address }
    });
  }

  async updateMinVotingAge(age) {
    return this.request(API_ENDPOINTS.OWNER.UPDATE_MIN_VOTING_AGE, {
      method: 'PUT',
      body: { age }
    });
  }

  // Creator APIs
  async createElectionAsCreator(electionData) {
    return this.request(API_ENDPOINTS.CREATOR.CREATE_ELECTION, {
      method: 'POST',
      body: electionData,
    });
  }

  async saveElectionToDatabase(electionData) {
    return this.request(API_ENDPOINTS.CREATOR.SAVE_ELECTION, {
      method: 'POST',
      body: electionData,
    });
  }

  async getCreatorElections() {
    return this.request(API_ENDPOINTS.CREATOR.ELECTIONS);
  }

  async getCreatorElectionDetail(electionAddress) {
    return this.request(API_ENDPOINTS.CREATOR.ELECTION_DETAIL(electionAddress));
  }

  async updateElectionConfig(electionAddress, config) {
    return this.request(API_ENDPOINTS.CREATOR.UPDATE_CONFIG(electionAddress), {
      method: 'PUT',
      body: config,
    });
  }

  async getElectionVoters(electionAddress) {
    return this.request(API_ENDPOINTS.CREATOR.GET_VOTERS(electionAddress));
  }

  async addVoterToElection(electionAddress, voterAddress) {
    return this.request(API_ENDPOINTS.CREATOR.ADD_VOTER(electionAddress), {
      method: 'POST',
      body: { address: voterAddress },
    });
  }

  async removeVoterFromElection(electionAddress, voterAddress) {
    return this.request(API_ENDPOINTS.CREATOR.REMOVE_VOTER(electionAddress, voterAddress), {
      method: 'DELETE',
    });
  }

  // Get all voters (role = 'VOTER') from database
  async getAllVoters(search = '') {
    const params = new window.URLSearchParams();
    if (search) params.append('search', search);
    return this.request(`${API_ENDPOINTS.CREATOR.ALL_VOTERS}?${params.toString()}`);
  }

  async endElection(electionAddress) {
    return this.request(API_ENDPOINTS.CREATOR.END_ELECTION(electionAddress), {
      method: 'POST',
    });
  }

  // Voter APIs
  async getVoterElections() {
    return this.request(API_ENDPOINTS.VOTER.ELECTIONS);
  }

  async registerForElection(electionAddress) {
    return this.request(API_ENDPOINTS.VOTER.REGISTER(electionAddress), {
      method: 'POST',
    });
  }

  async castVote(electionAddress, candidateId, voteHash) {
    return this.request(API_ENDPOINTS.VOTER.VOTE(electionAddress), {
      method: 'POST',
      body: { candidateId, voteHash },
    });
  }

  async saveVote(voteData) {
    return this.request(API_ENDPOINTS.VOTES.CREATE, {
      method: 'POST',
      body: voteData,
    });
  }

  async getElectionResults(electionAddress) {
    return this.request(API_ENDPOINTS.VOTER.RESULTS(electionAddress));
  }

  async getVoterElectionDetail(electionAddress) {
    return this.request(API_ENDPOINTS.VOTER.ELECTION_DETAIL(electionAddress));
  }

  async getElectionStatus(electionAddress) {
    return this.request(API_ENDPOINTS.VOTER.STATUS(electionAddress));
  }

  // Generic GET helper
  async get(url, options = {}) {
    return this.request(url, { method: 'GET', ...options });
  }
}


export const apiService = new APIService();
export default apiService;

