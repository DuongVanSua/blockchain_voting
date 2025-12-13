import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultWallet = {
  address: null,
  balance: '0',
  network: 'localhost',
  status: 'disconnected',
};

const getDefaultUser = () => ({
  name: 'Người dùng',
  nationalId: '',
  avatar: '/assets/images/placeholder-avatar.png',
  kycStatus: 'PENDING',
  wallet: defaultWallet,
});


const loadUsers = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('app-users-storage');
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (err) {
    console.error('Error loading users:', err);
  }

  return [
    {
      id: '0',
      name: 'Chủ sở hữu',
      email: 'owner@example.com',
      phone: '0900000000',
      role: 'OWNER',
      status: 'active',
      kycStatus: 'APPROVED',
      registeredAt: new Date().toISOString().split('T')[0],
      wallet: defaultWallet,
    },
    {
      id: '1',
      name: 'Người tạo bầu cử',
      email: 'creator@example.com',
      phone: '0901234567',
      role: 'CREATOR',
      status: 'active',
      kycStatus: 'APPROVED',
      registeredAt: new Date().toISOString().split('T')[0],
      wallet: defaultWallet,
    },
    {
      id: '2',
      name: 'Cử tri',
      email: 'voter@example.com',
      phone: '0901234568',
      role: 'VOTER',
      status: 'active',
      kycStatus: 'PENDING',
      registeredAt: new Date().toISOString().split('T')[0],
      wallet: defaultWallet,
    },
  ];
};


const saveUsers = (users) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('app-users-storage', JSON.stringify(users));
    }
  } catch (err) {
    console.error('Error saving users:', err);
  }
};

export const useAppStore = create(
  persist(
    (set, get) => ({
      user: getDefaultUser(),
      users: loadUsers(),
      electionStatuses: {
        UPCOMING: 'upcoming',
        LIVE: 'live',
        CLOSED: 'closed',
      },
      selectedElectionId: null,
      realtimeFeed: [],
      contractAddresses: {
        VotingToken: null,
        VoterRegistry: null,
        ElectionFactory: null,
      },


      setSelectedElection: (id) => set({ selectedElectionId: id }),
      pushRealtimeFeed: (message) =>
        set((state) => ({
          realtimeFeed: [message, ...state.realtimeFeed].slice(0, 25),
        })),
      updateWalletStatus: (status) =>
        set((state) => ({
          user: {
            ...state.user,
            wallet: { ...state.user.wallet, status },
          },
        })),
      updateWallet: (walletData) =>
        set((state) => ({
          user: {
            ...state.user,
            wallet: { ...state.user.wallet, ...walletData },
          },
        })),
      updateKYCStatus: (status) =>
        set((state) => ({
          user: { ...state.user, kycStatus: status },
        })),
      setContractAddresses: (addresses) =>
        set({ contractAddresses: addresses }),


      syncUserFromAuth: (authUser) =>
        set((state) => {
          const defaultWallet = {
            address: null,
            balance: '0',
            network: 'localhost',
            status: 'disconnected',
          };
          // Handle both camelCase (walletAddress) and snake_case (wallet_address)
          const walletAddress = authUser?.walletAddress || authUser?.wallet_address;
          // IMPORTANT: Only use wallet address from database, never fallback to localStorage
          // This prevents users from seeing wallet addresses from previous sessions
          return {
            user: {
              ...state.user,
              id: authUser?.id || state.user.id,
              name: authUser?.name || state.user.name,
              avatar: authUser?.avatar || state.user.avatar,
              email: authUser?.email,
              phone: authUser?.phone || state.user.phone,
              role: authUser?.role,
              wallet: walletAddress 
                ? { ...defaultWallet, address: walletAddress, status: 'connected' }
                : defaultWallet, // Always use defaultWallet if no wallet in database
            },
          };
        }),


      resetUser: () => set({ user: getDefaultUser() }),


      addUser: (userData) => {
        const newUser = {
          id: Date.now().toString(),
          name: userData.name || 'User',
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || 'VOTER',
          status: 'active',
          kycStatus: 'PENDING',
          registeredAt: new Date().toISOString().split('T')[0],
          wallet: defaultWallet,
          ...userData,
        };

        set((state) => {
          const updatedUsers = [...state.users, newUser];
          saveUsers(updatedUsers);
          return { users: updatedUsers };
        });

        return newUser;
      },

      updateUser: (userId, updates) => {
        set((state) => {
          const updatedUsers = state.users.map((user) =>
            user.id === userId ? { ...user, ...updates } : user
          );
          saveUsers(updatedUsers);
          return { users: updatedUsers };
        });
      },

      updateUserByEmail: (email, updates) => {
        set((state) => {
          const updatedUsers = state.users.map((user) =>
            user.email === email ? { ...user, ...updates } : user
          );
          saveUsers(updatedUsers);
          return { users: updatedUsers };
        });
      },

      getUserByEmail: (email) => {
        const { users } = get();
        return users.find((user) => user.email === email);
      },


      approveKYC: (userId) => {
        set((state) => {
          const updatedUsers = state.users.map((user) =>
            user.id === userId ? { ...user, kycStatus: 'APPROVED' } : user
          );
          saveUsers(updatedUsers);
          return { users: updatedUsers };
        });
      },

      rejectKYC: (userId) => {
        set((state) => {
          const updatedUsers = state.users.map((user) =>
            user.id === userId ? { ...user, kycStatus: 'REJECTED' } : user
          );
          saveUsers(updatedUsers);
          return { users: updatedUsers };
        });
      },


    }),
    {
      name: 'app-storage',

      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Error rehydrating app store:', error);
        }

      },
    }
  )
);

export default useAppStore;

