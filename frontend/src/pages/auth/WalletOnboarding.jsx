import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useWallet from '../../hooks/useWallet';
import useWalletStore from '../../store/useWalletStore';
import useAuthStore from '../../store/useAuthStore';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Alert from '../../components/common/Alert';
import { toast } from 'react-hot-toast';

const WalletOnboarding = () => {
  const navigate = useNavigate();
  const { isConnecting, connect, error } = useWallet();
  const { logout, user, isAuthenticated } = useAuthStore();
  const isMetaMaskInstalled = useWalletStore((state) => state.isMetaMaskInstalled);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    setHasMetaMask(isMetaMaskInstalled());
  }, [isMetaMaskInstalled]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check if user already has wallet address (shouldn't happen, but just in case)
  useEffect(() => {
    if (user && isAuthenticated) {
      const walletAddress = user?.walletAddress || user?.wallet_address;
      const userRole = user?.role;
      
      // If user already has wallet address (except OWNER), redirect to dashboard
      if (walletAddress && userRole !== 'OWNER') {
        // eslint-disable-next-line no-console
        console.log('[WalletOnboarding] User already has wallet address, redirecting to dashboard');
        if (userRole === 'CREATOR') {
          navigate('/dashboard/creator', { replace: true });
        } else if (userRole === 'VOTER') {
          navigate('/dashboard/voter', { replace: true });
        }
      }
    }
  }, [user, isAuthenticated, navigate]);

  const handleConnectMetaMask = async () => {
    // Check MetaMask installation first
    if (!hasMetaMask) {
      toast.error('MetaMask chưa được cài đặt. Vui lòng cài đặt MetaMask extension.', {
        duration: 5000,
      });
      // Open MetaMask download page
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    // Show info toast that popup will appear (same as WalletConnectButton)
    toast.loading('Đang mở MetaMask popup. Vui lòng xác nhận trong MetaMask extension...', {
      id: 'metamask-connecting',
      duration: 10000,
    });

    const result = await connect();
    
    // Dismiss loading toast
    toast.dismiss('metamask-connecting');
    
    if (result.success) {
      toast.success('Đã kết nối MetaMask thành công! Đang cập nhật...', {
        duration: 2000,
      });
      
      // Wait for database update to complete (handled in useWalletStore.connectWallet())
      // Then logout and redirect to login page
      window.setTimeout(async () => {
        try {
          // Logout user to force them to login again
          await logout();
          // Navigate to login page
          navigate('/auth/login');
          toast.success('Vui lòng đăng nhập lại để tiếp tục', {
            duration: 3000,
          });
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Error during logout:', err);
          // Navigate to login page anyway
          navigate('/auth/login');
        }
      }, 1500); // Wait 1.5 seconds for database update to complete
    } else {
      toast.error(result.error || 'Không thể kết nối MetaMask', {
        duration: 5000,
      });
    }
  };

  const handleInstallMetaMask = () => {
    window.open('https://metamask.io/download/', '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="p-8 bg-white/95 backdrop-blur-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Kết nối MetaMask
            </h1>
            <p className="text-gray-600">
              Kết nối ví MetaMask của bạn để tham gia bầu cử
            </p>
          </div>

          {!hasMetaMask ? (
            <div className="space-y-4">
              <Alert variant="warning">
                MetaMask chưa được cài đặt. Vui lòng cài đặt MetaMask extension để tiếp tục.
              </Alert>
              <Button
                onClick={handleInstallMetaMask}
                variant="primary"
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              >
                Cài đặt MetaMask
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <Alert variant="error">{error}</Alert>
              )}
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Hướng dẫn:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                    <li>Nhấn nút &quot;Kết nối MetaMask&quot; bên dưới</li>
                    <li>Chọn tài khoản bạn muốn kết nối</li>
                    <li>Xác nhận kết nối trong MetaMask popup</li>
                  </ol>
                </div>
                <Button
                  onClick={handleConnectMetaMask}
                  disabled={isConnecting}
                  variant="primary"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isConnecting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Đang kết nối...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Kết nối MetaMask
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default WalletOnboarding;
