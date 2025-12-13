import apiService from './apiService';

class IPFSService {
  async uploadJSON(data) {
    try {
      const result = await apiService.request('/api/ipfs/upload', {
        method: 'POST',
        body: { data },
      });
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IPFS upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload to IPFS',
      };
    }
  }

  async getJSON(hash) {
    try {
      const result = await apiService.request(`/api/ipfs/${hash}`, {
        includeAuth: false,
      });
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IPFS get error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get from IPFS',
      };
    }
  }

  async checkStatus() {
    try {
      const result = await apiService.request('/api/ipfs/status', {
        includeAuth: false,
      });
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IPFS status error:', error);
      return {
        success: false,
        connected: false,
        error: error.message || 'Failed to check IPFS status',
      };
    }
  }

  async uploadFile(file) {
    try {
      // eslint-disable-next-line no-undef
      const formData = new FormData();
      formData.append('file', file);

      // Use fetch directly for FormData to avoid JSON.stringify
      // Get token from localStorage or apiService
      let token = null;
      try {
        // Try apiService first (most reliable)
        if (typeof apiService.getToken === 'function') {
          token = apiService.getToken();
        }
        // Fallback to localStorage
        if (!token) {
          token = localStorage.getItem('api_token');
        }
        // Fallback to auth-storage
        if (!token) {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            try {
              const parsed = JSON.parse(authStorage);
              token = parsed?.state?.token;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      } catch (e) {
        console.warn('Could not get token:', e);
      }
      
      const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const url = `${baseURL}/api/ipfs/upload-file`;

      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      // Don't set Content-Type - let browser set it with boundary for FormData

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[IPFS] Uploading file:', file.name, file.size, 'bytes');
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[IPFS] Upload request:', {
          url,
          hasToken: !!token,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[IPFS] Upload response status:', response.status, response.statusText);
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Upload failed' };
        }
        
        // Handle 401 - Token expired
        if (response.status === 401) {
          const errorMessage = errorData.error || errorData.message || 'Token expired. Vui lòng đăng nhập lại.';
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[IPFS] Upload failed - Token expired:', errorData);
          }
          throw new Error(errorMessage);
        }
        
        const errorMessage = errorData.error || errorData.message || `Upload failed: ${response.status}`;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[IPFS] Upload failed:', response.status, errorData);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[IPFS] Upload response:', result);
      }
      
      // Ensure result has success field
      if (result.success === undefined) {
        // If hash exists, consider it successful
        if (result.hash) {
          result.success = true;
        } else {
          result.success = false;
          result.error = result.error || 'Upload response missing hash';
        }
      }
      
      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IPFS file upload error:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload file to IPFS',
      };
    }
  }
}

export const ipfsService = new IPFSService();
export default ipfsService;
