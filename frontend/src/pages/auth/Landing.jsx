import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Button from '../../components/common/Button';
import useAuthStore from '../../store/useAuthStore';
import apiService from '../../services/apiService';

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isValidating, setIsValidating] = useState(false);

  // Validate token and redirect authenticated users to their dashboard
  useEffect(() => {
    const validateAndRedirect = async () => {
      // If not authenticated, show landing page immediately
      if (!isAuthenticated || !user) {
        setIsValidating(false);
        return;
      }

      // Only validate if we have a token
      const token = apiService.getToken();
      if (!token) {
        setIsValidating(false);
        return;
      }

      // Set validating state only if we have token and user
      setIsValidating(true);

      // Validate token with backend
      try {
        const response = await apiService.getCurrentUser();
        
        if (response.success && response.user) {
          const role = response.user.role;
          // eslint-disable-next-line no-console
          console.log('[Landing] Token valid, role:', role);

          // Redirect based on database role
          // Smart contract permission check will be handled by RoleGuard if needed
          // This allows users to access their dashboard even if smart contract is not fully configured
          if (role === 'OWNER') {
            // eslint-disable-next-line no-console
            console.log('[Landing] Redirecting to Owner dashboard based on database role');
            navigate('/dashboard/owner', { replace: true });
          } else if (role === 'CREATOR') {
            // eslint-disable-next-line no-console
            console.log('[Landing] Redirecting to Creator dashboard based on database role');
            navigate('/dashboard/creator', { replace: true });
          } else if (role === 'VOTER') {
            // eslint-disable-next-line no-console
            console.log('[Landing] Redirecting to Voter dashboard');
            navigate('/dashboard/voter', { replace: true });
          } else {
            // eslint-disable-next-line no-console
            console.warn('[Landing] Unknown role:', role, 'Not redirecting');
            setIsValidating(false);
          }
        } else {
          // Token invalid, clear auth state
          // eslint-disable-next-line no-console
          console.warn('[Landing] Token invalid, clearing auth state');
          await logout();
          setIsValidating(false);
        }
      } catch (error) {
        // Token expired or invalid, clear auth state
        // eslint-disable-next-line no-console
        console.warn('[Landing] Token validation failed:', error);
        await logout();
        setIsValidating(false);
      }
    };

    // Small delay to allow Zustand to hydrate state from localStorage
    const timer = window.setTimeout(() => {
      validateAndRedirect();
    }, 100);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, user?.role]); // Only depend on user.id and user.role, not the entire user object or functions

  // Show loading only if we're validating token
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-600 to-blue-400">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p>Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 bg-gradient-to-br from-blue-900 via-blue-600 to-blue-400 text-white">
      <div className="text-center max-w-3xl mb-16">
        <h1 className="text-3xl md:text-5xl mb-4 text-white">Hệ thống Bầu cử Phi tập trung</h1>
        <p className="text-base md:text-xl mb-8 opacity-90">Sử dụng công nghệ Blockchain để đảm bảo minh bạch và an toàn</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/auth/login">
            <Button size="large" variant="primary">
              Đăng nhập
            </Button>
          </Link>
          <Link to="/auth/register">
            <Button size="large" variant="outline" className="bg-white text-blue-900 border-2 border-white font-semibold hover:bg-white/90 hover:text-blue-700 hover:-translate-y-0.5 hover:shadow-lg">
              Đăng ký
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl w-full">
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl text-center transition-transform hover:-translate-y-1">
          <div className="w-12 h-12 mx-auto mb-4 text-white flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h3 className="mb-2 text-white">Bảo mật</h3>
          <p className="opacity-90 text-white">Mã hóa đầu-cuối và blockchain đảm bảo tính bảo mật</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl text-center transition-transform hover:-translate-y-1">
          <div className="w-12 h-12 mx-auto mb-4 text-white flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <h3 className="mb-2 text-white">Minh bạch</h3>
          <p className="opacity-90 text-white">Mọi giao dịch đều được ghi lại trên blockchain</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl text-center transition-transform hover:-translate-y-1">
          <div className="w-12 h-12 mx-auto mb-4 text-white flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3 className="mb-2 text-white">Có thể kiểm chứng</h3>
          <p className="opacity-90 text-white">Bất kỳ ai cũng có thể xác minh kết quả bầu cử</p>
        </div>
      </div>
    </div>
  );
};

export default Landing;

