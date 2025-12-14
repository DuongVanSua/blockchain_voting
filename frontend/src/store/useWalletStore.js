import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ethers } from 'ethers';

const useWalletStore = create(
  persist(
    (set, get) => ({
      // Wallet state
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      error: null,

      // Check if MetaMask is installed
      isMetaMaskInstalled: () => {
        if (typeof window === 'undefined') {
          return false;
        }
        // Check for MetaMask specifically
        return !!window.ethereum && (window.ethereum.isMetaMask || window.ethereum.providers?.some(p => p.isMetaMask));
      },

      // Get MetaMask provider
      getMetaMaskProvider: () => {
        if (typeof window === 'undefined' || !window.ethereum) {
          return null;
        }
        // If multiple providers, find MetaMask
        if (window.ethereum.providers) {
          return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
        }
        // Check if current provider is MetaMask
        if (window.ethereum.isMetaMask) {
          return window.ethereum;
        }
        return window.ethereum;
      },

      // Connect wallet via MetaMask
      connectWallet: async () => {
        // Check if MetaMask is installed
        if (!get().isMetaMaskInstalled()) {
          const error = 'MetaMask chưa được cài đặt. Vui lòng cài đặt MetaMask extension từ https://metamask.io';
          set({ error, isConnecting: false });
          return { success: false, error };
        }

        const provider = get().getMetaMaskProvider();
        if (!provider) {
          const error = 'Không thể tìm thấy MetaMask provider';
          set({ error, isConnecting: false });
          return { success: false, error };
        }

        set({ isConnecting: true, error: null });

        try {
          // First, try to revoke existing permissions to force popup
          // This ensures popup always shows even if previously connected
          try {
            // Check if already connected
            const existingAccounts = await provider.request({
              method: 'eth_accounts',
            });
            
            if (existingAccounts && existingAccounts.length > 0) {
              // Try to revoke permissions to force new popup
              // Note: This may not work in all browsers, but we'll try
              try {
                await provider.request({
                  method: 'wallet_revokePermissions',
                  params: [{ eth_accounts: {} }],
                });
              } catch (revokeError) {
                // Ignore revoke errors, continue with request
                // eslint-disable-next-line no-console
                console.log('Could not revoke permissions (this is normal):', revokeError);
              }
            }
          } catch (checkError) {
            // Ignore errors during permission check
            // eslint-disable-next-line no-console
            console.log('Permission check error (this is normal):', checkError);
          }

          // Request account access using wallet_requestPermissions
          // This will ALWAYS show popup, even if previously approved
          let accounts;
          try {
            // Try wallet_requestPermissions first (always shows popup)
            await provider.request({
              method: 'wallet_requestPermissions',
              params: [{ eth_accounts: {} }],
            });
            // After permission granted, get accounts
            accounts = await provider.request({
              method: 'eth_accounts',
            });
          } catch (permError) {
            // Fallback to eth_requestAccounts if wallet_requestPermissions not supported
            if (permError.code === -32601 || permError.code === -32000) {
              accounts = await provider.request({
                method: 'eth_requestAccounts',
              });
            } else {
              throw permError;
            }
          }

          if (!accounts || accounts.length === 0) {
            throw new Error('Không tìm thấy tài khoản. Vui lòng tạo tài khoản trong MetaMask.');
          }

          const address = accounts[0];
          
          // Get chain ID
          const chainIdHex = provider.chainId || await provider.request({ method: 'eth_chainId' });
          const chainId = parseInt(chainIdHex, 16);

          // Check if address changed
          const oldAddress = get().address;
          const addressChanged = oldAddress && oldAddress.toLowerCase() !== address.toLowerCase();

          set({
            address,
            chainId,
            isConnected: true,
            isConnecting: false,
            error: null,
          });

          // Setup event listeners if not already set
          get().setupEventListeners();

          // Update database if address changed or first time connecting
          // Skip for OWNER role (they use system wallet)
          let shouldUpdateDB = !oldAddress || addressChanged;
          
          if (shouldUpdateDB) {
            // Check user role before updating database
            try {
              const { default: apiService } = await import('../services/apiService');
              const currentUserResponse = await apiService.getCurrentUser();
              
              if (currentUserResponse.success && currentUserResponse.user) {
                const userRole = currentUserResponse.user.role;
                
                // Only update database for VOTER and CREATOR, not OWNER
                if (userRole !== 'OWNER') {
                  // Normalize address to lowercase before sending to backend
                  const normalizedAddress = address.toLowerCase();
                  
                  // eslint-disable-next-line no-console
                  console.log('[WalletStore] Updating wallet address in database:', normalizedAddress);
                  
                  const updateResult = await apiService.updateWalletAddress(normalizedAddress);
                  if (updateResult.success) {
                    // eslint-disable-next-line no-console
                    console.log('[WalletStore] Successfully updated wallet address in database:', normalizedAddress);
                    
                    // Refresh user data from database to update UI immediately
                    try {
                      const { default: useAuthStore } = await import('./useAuthStore');
                      const { refreshUser } = useAuthStore.getState();
                      if (refreshUser) {
                        // Wait for refresh to complete
                        await refreshUser();
                        // eslint-disable-next-line no-console
                        console.log('[WalletStore] User data refreshed after wallet update');
                      }
                    } catch (refreshError) {
                      // eslint-disable-next-line no-console
                      console.error('[WalletStore] Error refreshing user data after wallet update:', refreshError);
                    }
                    
                    // Don't reload page if we're on wallet onboarding page
                    // The WalletOnboarding component will handle navigation to login page
                    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
                    if (currentPath !== '/auth/wallet-onboarding') {
                      // Reload page to ensure all components get updated data
                      // This is necessary because some components may not react to state changes
                      if (typeof window !== 'undefined') {
                        // eslint-disable-next-line no-console
                        console.log('[WalletStore] Reloading page to reflect wallet address update');
                        window.setTimeout(() => {
                          window.location.reload();
                        }, 500); // Small delay to allow state updates to complete
                      }
                    } else {
                      // eslint-disable-next-line no-console
                      console.log('[WalletStore] On wallet onboarding page, skipping reload - component will handle navigation');
                    }
                  } else {
                    // eslint-disable-next-line no-console
                    console.error('[WalletStore] Failed to update wallet address in database:', updateResult.error || updateResult);
                  }
                } else {
                  // eslint-disable-next-line no-console
                  console.log('[WalletStore] Skipping database update for OWNER role');
                }
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('[WalletStore] Error updating wallet address in database:', error);
              // Continue even if database update fails
            }
          }

          return { success: true, address, chainId, addressChanged: !!addressChanged };
        } catch (error) {
          console.error('Connect wallet error:', error);
          let errorMessage = 'Không thể kết nối MetaMask';
          
          if (error.code === 4001) {
            errorMessage = 'Bạn đã từ chối yêu cầu kết nối. Vui lòng chấp nhận trong MetaMask popup.';
          } else if (error.code === -32002) {
            errorMessage = 'Yêu cầu kết nối đang chờ xử lý. Vui lòng kiểm tra MetaMask extension.';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          set({
            isConnected: false,
            isConnecting: false,
            error: errorMessage,
          });

          return { success: false, error: errorMessage };
        }
      },

      // Disconnect wallet
      disconnectWallet: () => {
        set({
          address: null,
          chainId: null,
          isConnected: false,
          error: null,
        });
      },

      // Setup event listeners
      setupEventListeners: () => {
        const provider = get().getMetaMaskProvider();
        if (!provider) {
          return;
        }

        // Remove existing listeners to avoid duplicates
        if (provider.removeListener) {
          provider.removeListener('accountsChanged', get().handleAccountsChanged);
          provider.removeListener('chainChanged', get().handleChainChanged);
        }

        // Add new listeners
        provider.on('accountsChanged', get().handleAccountsChanged);
        provider.on('chainChanged', get().handleChainChanged);
      },

      // Handle accounts changed
      handleAccountsChanged: async (accounts) => {
        if (!accounts || accounts.length === 0) {
          // User disconnected wallet
          get().disconnectWallet();
          // Reload page to reset state
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        } else {
          const newAddress = accounts[0];
          const oldAddress = get().address;
          
          // Check if address actually changed
          if (!oldAddress || oldAddress.toLowerCase() !== newAddress.toLowerCase()) {
            // Account changed - update state first
            set({ address: newAddress });
            
            // Update database with new address (skip for OWNER)
            try {
              const { default: apiService } = await import('../services/apiService');
              const currentUserResponse = await apiService.getCurrentUser();
              
              if (currentUserResponse.success && currentUserResponse.user) {
                const userRole = currentUserResponse.user.role;
                
                // Only update database for VOTER and CREATOR, not OWNER
                if (userRole !== 'OWNER') {
                  // Normalize address to lowercase before sending to backend
                  const normalizedAddress = newAddress.toLowerCase();
                  
                  // eslint-disable-next-line no-console
                  console.log('[WalletStore] Updating wallet address in database after account change:', normalizedAddress);
                  
                  const updateResult = await apiService.updateWalletAddress(normalizedAddress);
                  if (updateResult.success) {
                    // eslint-disable-next-line no-console
                    console.log('[WalletStore] Successfully updated wallet address in database after account change:', normalizedAddress);
                    
                    // Refresh user data from database to update UI immediately
                    try {
                      const { default: useAuthStore } = await import('./useAuthStore');
                      const { refreshUser } = useAuthStore.getState();
                      if (refreshUser) {
                        await refreshUser();
                        // eslint-disable-next-line no-console
                        console.log('[WalletStore] User data refreshed after account change');
                      }
                    } catch (refreshError) {
                      // eslint-disable-next-line no-console
                      console.error('[WalletStore] Error refreshing user data after account change:', refreshError);
                    }
                  } else {
                    // eslint-disable-next-line no-console
                    console.error('[WalletStore] Failed to update wallet address in database:', updateResult.error || updateResult);
                  }
                }
              }
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('[WalletStore] Error updating wallet address in database:', error);
              // Continue even if database update fails
            }
            
            // Reload page to refresh data
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }
        }
      },

      // Handle chain changed
      handleChainChanged: (chainIdHex) => {
        const chainId = parseInt(chainIdHex, 16);
        set({ chainId });
        // Reload page to refresh data
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      },

      // Check connection on mount
      checkConnection: async () => {
        if (!get().isMetaMaskInstalled()) {
          return;
        }

        const provider = get().getMetaMaskProvider();
        if (!provider) {
          return;
        }

        try {
          const accounts = await provider.request({
            method: 'eth_accounts',
          });

          if (accounts && accounts.length > 0) {
            const address = accounts[0];
            const chainIdHex = provider.chainId || await provider.request({ method: 'eth_chainId' });
            const chainId = parseInt(chainIdHex, 16);

            set({
              address,
              chainId,
              isConnected: true,
            });

            // Setup event listeners
            get().setupEventListeners();
          }
        } catch (error) {
          console.error('Check connection error:', error);
        }
      },

      // Get provider
      getProvider: () => {
        const provider = get().getMetaMaskProvider();
        if (!provider) {
          return null;
        }
        return new ethers.BrowserProvider(provider);
      },

      // Get signer
      getSigner: async () => {
        const provider = get().getProvider();
        if (!provider) {
          throw new Error('Provider not available');
        }
        return await provider.getSigner();
      },
    }),
    {
      name: 'wallet-storage',
      partialize: (state) => ({
        // Only persist address and chainId, not connection state
        address: state.address,
        chainId: state.chainId,
      }),
    }
  )
);

export default useWalletStore;


