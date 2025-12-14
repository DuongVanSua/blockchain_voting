import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService from '../services/apiService';
import { useAppStore } from './useAppStore';

const useAuthStore = create(
  persist(
    (set) => ({

      user: null,
      isAuthenticated: false,
      token: null,
      refreshToken: null,


      login: async (email, password) => {
        try {
          const response = await apiService.login(email, password);

          if (response.success && response.user && response.token) {
            const accessToken = response.token.access_token;
            const refreshToken = response.token.refresh_token;

            apiService.setToken(accessToken);
            
            // Use role from login response (most up-to-date from database)
            // Don't fetch from /api/auth/me immediately as it may have cached data
            // The login response already has the latest role from database
            const fullUserData = response.user;
            
            // eslint-disable-next-line no-console
            console.log('[useAuthStore] Login response user:', fullUserData);
            // eslint-disable-next-line no-console
            console.log('[useAuthStore] User role from login:', fullUserData.role);

            set({
              user: fullUserData,
              isAuthenticated: true,
              token: accessToken,
              refreshToken: refreshToken,
            });
            
            // Sync wallet address from database to app store
            const { syncUserFromAuth } = useAppStore.getState();
            
            // Always sync from database - syncUserFromAuth will handle clearing wallet if not in database
            if (syncUserFromAuth) {
              syncUserFromAuth(fullUserData);
            }
            
            return { success: true, user: fullUserData };
          }

          return { success: false, error: response.detail || 'Đăng nhập thất bại' };
        } catch (error) {
          console.error('Login error:', error);
          return { success: false, error: error.message || 'Đăng nhập thất bại' };
        }
      },


      register: async (name, email, phone, password) => {
        try {
          const response = await apiService.register({
            name,
            email,
            phone,
            password,
          });

          if (response.success && response.user && response.token) {
            const accessToken = response.token.access_token;
            const refreshToken = response.token.refresh_token;

            apiService.setToken(accessToken);
            set({
              user: response.user,
              isAuthenticated: true,
              token: accessToken,
              refreshToken: refreshToken,
            });
            return { success: true, user: response.user };
          }


          let errorMsg = 'Đăng ký thất bại';
          if (response.detail) {
            if (Array.isArray(response.detail)) {
              errorMsg = response.detail.map(err => err.msg || err).join('; ');
            } else if (typeof response.detail === 'string') {
              errorMsg = response.detail;
            }
          }
          return { success: false, error: errorMsg };
        } catch (error) {
          console.error('Register error:', error);

          const errorMsg = error?.message || 'Đăng ký thất bại';
          return { success: false, error: typeof errorMsg === 'string' ? errorMsg : 'Đăng ký thất bại' };
        }
      },


      logout: async () => {
        try {
          await apiService.logout();
        } catch (error) {
          console.warn('Logout error:', error);
        } finally {
          // Clear wallet from app store when logging out
          const { resetUser } = useAppStore.getState();
          if (resetUser) {
            resetUser();
          }

          apiService.setToken(null);
          set({
            user: null,
            isAuthenticated: false,
            token: null,
            refreshToken: null,
          });
        }
      },


      updateUser: (updates) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      // Refresh user data from database (including wallet address)
      refreshUser: async () => {
        try {
          const currentUserResponse = await apiService.getCurrentUser();
          if (currentUserResponse.success && currentUserResponse.user) {
            const fullUserData = currentUserResponse.user;
            set(() => ({
              user: fullUserData,
            }));
            
            // Sync wallet address from database to app store
            const { syncUserFromAuth } = useAppStore.getState();
            if (syncUserFromAuth) {
              syncUserFromAuth(fullUserData);
            }
            
            return { success: true, user: fullUserData };
          }
          return { success: false, error: 'Failed to refresh user data' };
        } catch (error) {
          console.error('Refresh user error:', error);
          return { success: false, error: error.message || 'Failed to refresh user data' };
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        refreshToken: state.refreshToken,
      }),

      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Error rehydrating auth store:', error);
        }

        // Note: state is available but we use it via getState() if needed
        // Token is set via getState() in the rehydration callback
      },
    },
  )
);

export default useAuthStore;

