import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import Checkbox from '../../components/common/Checkbox';
import Alert from '../../components/common/Alert';
import { toast } from 'react-hot-toast';


const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Email không hợp lệ';
      }
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    const value = field === 'rememberMe' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        toast.success('Đăng nhập thành công!');

        if (formData.rememberMe) {
          localStorage.setItem('rememberEmail', formData.email);
        } else {
          localStorage.removeItem('rememberEmail');
        }

        // Get role and wallet address from result.user (from database, most up-to-date)
        const role = result.user?.role;
        const walletAddress = result.user?.walletAddress || result.user?.wallet_address;
        // eslint-disable-next-line no-console
        console.log('[Login] User role from database:', role);
        // eslint-disable-next-line no-console
        console.log('[Login] User wallet address:', walletAddress);
        
        // Check if user has wallet address (except OWNER who uses system wallet)
        if (role !== 'OWNER' && !walletAddress) {
          // User doesn't have wallet address, redirect to wallet onboarding
          toast('Vui lòng kết nối MetaMask để tiếp tục', {
            icon: '⚠️',
            duration: 3000,
            style: {
              background: '#f59e0b',
              color: '#fff',
            },
          });
          window.setTimeout(() => {
            navigate('/auth/wallet-onboarding', { replace: true });
          }, 500);
          return;
        }
        
        // Small delay to ensure state is updated
        window.setTimeout(() => {
          // RBAC routing based on role from database
          // Redirect immediately based on database role, don't wait for smart contract check
          // RoleGuard will handle smart contract permission check if needed
          if (role === 'OWNER') {
            // eslint-disable-next-line no-console
            console.log('[Login] Redirecting to Owner dashboard');
            navigate('/dashboard/owner', { replace: true });
          } else if (role === 'CREATOR') {
            // eslint-disable-next-line no-console
            console.log('[Login] Redirecting to Creator dashboard');
            navigate('/dashboard/creator', { replace: true });
          } else if (role === 'VOTER') {
            // eslint-disable-next-line no-console
            console.log('[Login] Redirecting to Voter dashboard');
            navigate('/dashboard/voter', { replace: true });
          } else {
            // eslint-disable-next-line no-console
            console.warn('[Login] Unknown role:', role, 'Redirecting to home');
            navigate('/', { replace: true });
          }
        }, 100); // Small delay to ensure Zustand state is updated
      } else {
        setErrors({ submit: result.error || 'Đăng nhập thất bại' });
        toast.error(result.error || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setErrors({ submit: err.message || 'Đã xảy ra lỗi' });
      toast.error(err.message || 'Đã xảy ra lỗi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberedEmail) {
      setFormData(prev => ({ ...prev, email: rememberedEmail, rememberMe: true }));
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/20 animate-scaleIn">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Đăng nhập</h1>
            <p className="text-gray-600 text-lg">Chào mừng trở lại!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="Nhập email của bạn"
                className={`w-full px-4 py-3.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm ${
                  errors.email ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-blue-300'
                } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                disabled={isLoading}
                autoComplete="email"
              />
              {errors.email && (
                <span className="mt-1 text-sm text-red-600 block">{errors.email}</span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange('password')}
                  placeholder="Nhập mật khẩu"
                  className={`w-full px-4 py-3.5 pr-12 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm ${
                    errors.password ? 'border-red-400 bg-red-50/50' : 'border-gray-200 hover:border-blue-300'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  disabled={isLoading}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none p-1"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="mt-1 text-sm text-red-600 block">{errors.password}</span>
              )}
            </div>

            <div>
              <Checkbox
                checked={formData.rememberMe}
                onChange={handleChange('rememberMe')}
                label="Ghi nhớ đăng nhập"
                disabled={isLoading}
              />
            </div>

            {errors.submit && (
              <Alert variant="error">{errors.submit}</Alert>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 focus:outline-none focus:ring-4 focus:ring-purple-500/50 focus:ring-offset-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:scale-95"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang đăng nhập...
                </span>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">hoặc</span>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Chưa có tài khoản?{' '}
              <Link to="/auth/register" className="text-blue-600 hover:text-purple-600 font-semibold underline decoration-2 underline-offset-2 transition-colors">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
