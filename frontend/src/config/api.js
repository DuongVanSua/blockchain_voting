const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {

  AUTH: {
    REGISTER: `${API_BASE_URL}/api/auth/register`,
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout`,
    REFRESH: `${API_BASE_URL}/api/auth/refresh`,
    ME: `${API_BASE_URL}/api/auth/me`,
    UPDATE_WALLET: `${API_BASE_URL}/api/auth/wallet`,
    NONCE: `${API_BASE_URL}/api/auth/nonce`,
    VERIFY_SIGNATURE: `${API_BASE_URL}/api/auth/verify-signature`,
  },

  // Users endpoints (Owner only - not used in frontend UI currently)
  USERS: {
    LIST: `${API_BASE_URL}/api/users`,
    DETAIL: (id) => `${API_BASE_URL}/api/users/${id}`,
  },

  KYC: {
    SUBMIT: `${API_BASE_URL}/api/kyc/submit`,
    STATUS: `${API_BASE_URL}/api/kyc/status`,
    SUBMISSIONS: `${API_BASE_URL}/api/kyc/submissions`,
    PENDING: `${API_BASE_URL}/api/kyc/pending`,
    DETAIL: (id) => `${API_BASE_URL}/api/kyc/${id}`,
    APPROVE: (id) => `${API_BASE_URL}/api/kyc/${id}/approve`,
    REJECT: (id) => `${API_BASE_URL}/api/kyc/${id}/reject`,
  },

  ELECTIONS: {
    LIST: `${API_BASE_URL}/api/elections`,
    DETAIL: (id) => `${API_BASE_URL}/api/elections/${id}`,
    BY_CONTRACT: (address) => `${API_BASE_URL}/api/elections/by-contract/${address}`,
  },

  IPFS: {
    STATUS: `${API_BASE_URL}/api/ipfs/status`,
    UPLOAD_FILE: `${API_BASE_URL}/api/ipfs/upload-file`,
    UPLOAD_JSON: `${API_BASE_URL}/api/ipfs/upload`,
    FILE: (hash) => `${API_BASE_URL}/api/ipfs/file/${hash}`,
    JSON: (hash) => `${API_BASE_URL}/api/ipfs/json/${hash}`,
    PIN: (hash) => `${API_BASE_URL}/api/ipfs/pin/${hash}`,
    UNPIN: (hash) => `${API_BASE_URL}/api/ipfs/pin/${hash}`,
  },

  // Activities endpoint (Owner only - not used in frontend UI currently)
  ACTIVITIES: {
    LIST: `${API_BASE_URL}/api/activities`,
  },

  // Dashboard endpoint (Owner only - not used in frontend UI currently)
  DASHBOARD: {
    STATISTICS: `${API_BASE_URL}/api/dashboard/statistics`,
  },

  VOTES: {
    RELAY: `${API_BASE_URL}/api/votes/relay`,
    LIST: `${API_BASE_URL}/api/votes/my-votes`,
  },

  // RBAC Routes
  OWNER: {
    STATUS: `${API_BASE_URL}/api/owner/status`,
    PAUSE: `${API_BASE_URL}/api/owner/pause`,
    UNPAUSE: `${API_BASE_URL}/api/owner/unpause`,
    CREATORS: `${API_BASE_URL}/api/owner/creators`,
    ADD_CREATOR: `${API_BASE_URL}/api/owner/creators`,
    REMOVE_CREATOR: (address) => `${API_BASE_URL}/api/owner/creators/${address}`,
    CONFIG: `${API_BASE_URL}/api/owner/config`,
    UPDATE_VOTER_REGISTRY: `${API_BASE_URL}/api/owner/config/voter-registry`,
    UPDATE_VOTING_TOKEN: `${API_BASE_URL}/api/owner/config/voting-token`,
    TRANSFER_OWNERSHIP: `${API_BASE_URL}/api/owner/config/transfer-ownership`,
    UPDATE_MIN_VOTING_AGE: `${API_BASE_URL}/api/owner/config/min-voting-age`,
  },

  CREATOR: {
    ELECTIONS: `${API_BASE_URL}/api/creator/elections`,
    CREATE_ELECTION: `${API_BASE_URL}/api/creator/elections`,
    UPDATE_CONFIG: (address) => `${API_BASE_URL}/api/creator/elections/${address}/config`,
    GET_VOTERS: (address) => `${API_BASE_URL}/api/creator/elections/${address}/voters`,
    ADD_VOTER: (address) => `${API_BASE_URL}/api/creator/elections/${address}/voters`,
    REMOVE_VOTER: (address, voterAddress) => `${API_BASE_URL}/api/creator/elections/${address}/voters/${voterAddress}`,
    END_ELECTION: (address) => `${API_BASE_URL}/api/creator/elections/${address}/end`,
  },

  VOTER: {
    ELECTIONS: `${API_BASE_URL}/api/voter/elections`,
    REGISTER: (address) => `${API_BASE_URL}/api/voter/elections/${address}/register`,
    VOTE: (address) => `${API_BASE_URL}/api/voter/elections/${address}/vote`,
    RESULTS: (address) => `${API_BASE_URL}/api/voter/elections/${address}/results`,
    STATUS: (address) => `${API_BASE_URL}/api/voter/elections/${address}/status`,
  },
};

export default API_BASE_URL;