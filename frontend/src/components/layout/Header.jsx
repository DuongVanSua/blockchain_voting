import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import useAuthStore from '../../store/useAuthStore';
import useWallet from '../../hooks/useWallet';
import { useAppStore } from '../../store/useAppStore';
import Button from '../common/Button';
import Logo from '../common/Logo';

const Header = () => {
  const { isAuthenticated, user, logout, refreshUser } = useAuthStore();
  const { user: appUser } = useAppStore();
  const wallet = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const SYSTEM_WALLET_ADDRESS = '0xbc5575790975F2C963AbECA62f9eAEb8c3aB073A';

  // Refresh user data from database when component mounts (to get latest wallet address)
  // Only refresh once when authentication status changes, not on every render
  useEffect(() => {
    if (isAuthenticated && refreshUser) {
      refreshUser().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('Failed to refresh user data in Header:', err);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Only depend on isAuthenticated, not refreshUser function

  const getDisplayAddress = () => {
    if (!user) return null;
    
    // For all roles, fetch wallet address from database first
    // Priority 1: Wallet address directly from database (user object) - always check this first
    const walletAddress = user?.walletAddress || user?.wallet_address;
    if (walletAddress) {
      return walletAddress;
    }
    
    // Priority 2: Wallet from app store (synced from database)
    if (appUser?.wallet?.address && appUser?.wallet?.status === 'connected') {
      return appUser.wallet.address;
    }
    
    // Priority 3: Connected MetaMask wallet (for VOTER role only)
    if (user?.role === 'VOTER' && wallet?.account && wallet?.isConnected) {
      return wallet.account;
    }
    
    // Fallback: For OWNER, use hardcoded address only if no database wallet
    if (user?.role === 'OWNER' && !walletAddress) {
      return SYSTEM_WALLET_ADDRESS;
    }
    
    return null;
  };

  const address = getDisplayAddress();
  const isConnected = !!address || wallet?.isConnected || false;
  const disconnect = wallet?.disconnect || (() => {});


  const isActive = (path) => {
    if (path === '/dashboard/owner' || path === '/dashboard/creator' || path === '/dashboard/voter') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    disconnect();
    await logout();
    navigate('/');
  };

  const getRoleNavigation = () => {
    if (!user) return null;

    // Use database role instead of smart contract flags
    // This ensures correct navigation even when contract is not deployed
    const role = user.role;

    // Owner Dashboard - System Management
    if (role === 'OWNER') {
      return (
        <Link
          to="/dashboard/owner"
          className={`hidden md:inline-block no-underline font-semibold text-sm transition-all px-4 py-2 rounded-lg relative ${
            isActive('/dashboard/owner') 
              ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg' 
              : 'text-gray-700 hover:text-red-600 hover:bg-red-50'
          }`}
        >
          Owner Dashboard
        </Link>
      );
    }

    // Creator Dashboard - Election Management
    if (role === 'CREATOR') {
      return (
        <Link
          to="/dashboard/creator"
          className={`hidden md:inline-block no-underline font-semibold text-sm transition-all px-4 py-2 rounded-lg relative ${
            isActive('/dashboard/creator') 
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg' 
              : 'text-gray-700 hover:text-green-600 hover:bg-green-50'
          }`}
        >
          Creator Dashboard
        </Link>
      );
    }

    // Voter Dashboard - Voting
    if (role === 'VOTER') {
      return (
        <Link
          to="/dashboard/voter"
          className={`hidden md:inline-block no-underline font-semibold text-sm transition-all px-4 py-2 rounded-lg relative ${
            isActive('/dashboard/voter') 
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
              : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
          }`}
        >
          Voter Dashboard
        </Link>
      );
    }

    return null;
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-[100] shadow-md backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-3 text-blue-600 font-bold text-xl no-underline hover:text-blue-700 transition-colors">
          <Logo size={32} className="flex-shrink-0" />
          <span className="hidden sm:inline bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Blockchain Voting</span>
        </Link>

        <nav className="flex items-center gap-3 md:gap-6">
          {isAuthenticated ? (
            <>
              {getRoleNavigation()}
              <div className="flex items-center gap-4">
                <div className="hidden sm:block">
                  {isConnected && address && (
                    <span className="text-xs text-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 px-3 py-1.5 rounded-full font-mono shadow-sm">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <button
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white border-2 border-white shadow-lg cursor-pointer font-semibold text-base flex items-center justify-center transition-all hover:scale-110 hover:shadow-xl"
                    onClick={() => setShowMenu(!showMenu)}
                  >
                    {user?.name?.charAt(0) || 'U'}
                  </button>
                  {showMenu && (
                    <div className="absolute top-[calc(100%+8px)] right-0 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[200px] p-2 z-[1000] animate-slideUp">
                      <div className="p-3 border-b border-gray-200">
                        <p className="font-semibold text-gray-900 m-0 mb-1 text-sm">{user?.name || 'User'}</p>
                        <p className="text-xs text-gray-500 m-0 uppercase">{user?.role || 'USER'}</p>
                      </div>
                      <button onClick={handleLogout} className="w-full p-3 text-left bg-transparent border-none cursor-pointer text-gray-600 text-sm rounded-lg transition-colors hover:bg-red-50 hover:text-red-600">
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex gap-3 items-center">
              <Link to="/auth/login">
                <Button variant="outline" size="small">Đăng nhập</Button>
              </Link>
              <Link to="/auth/register">
                <Button variant="primary" size="small">Đăng ký</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;

