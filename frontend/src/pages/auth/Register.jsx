import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import useAuthStore from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import Checkbox from '../../components/common/Checkbox';
import Alert from '../../components/common/Alert';
import PrivateKeyDisplay from '../../components/wallet/PrivateKeyDisplay';
import apiService from '../../services/apiService';
import { toast } from 'react-hot-toast';


const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const { addUser } = useAppStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generatedWallet, setGeneratedWallet] = useState(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const getPasswordStrength = (password) => {
    if (!password) {
      return { strength: 0, label: '', color: '#e5e7eb' };
    }

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    const levels = [
      { label: 'Rất yếu',   color: '#ef4444' },
      { label: 'Yếu',       color: '#ef4444' },
      { label: 'Trung bình',color: '#f59e0b' },
      { label: 'Mạnh',      color: '#10b981' },
      { label: 'Rất mạnh',  color: '#10b981' },
    ];

    const idx = Math.min(Math.max(strength - 1, 0), 4);
    return { ...levels[idx], strength: idx };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Vui lòng nhập họ tên';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Họ tên phải có ít nhất 2 ký tự';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Email không hợp lệ';
      }
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
    } else {
      const phoneRegex = /^[0-9]{10,11}$/;
      const cleanPhone = formData.phone.replace(/\s/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        newErrors.phone = 'Số điện thoại không hợp lệ (10-11 số)';
      }
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'Vui lòng đồng ý với điều khoản';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    const value = field === 'agreeToTerms' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Vui lòng kiểm tra lại thông tin');
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const result = await register(
        formData.name,
        formData.email,
        formData.phone,
        formData.password
      );

      if (result.success) {
        // Generate wallet for voter
        const wallet = ethers.Wallet.createRandom();
        const walletAddress = wallet.address;
        const privateKey = wallet.privateKey;

        // Save wallet address to database (NOT private key)
        try {
          const updateResult = await apiService.updateWalletAddress(walletAddress);
          if (!updateResult.success) {
            // eslint-disable-next-line no-console
            console.warn('Failed to save wallet address:', updateResult.error);
            toast.error('Đăng ký thành công nhưng không thể lưu địa chỉ ví. Vui lòng cập nhật sau.');
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error saving wallet address:', error);
          toast.error('Đăng ký thành công nhưng không thể lưu địa chỉ ví. Vui lòng cập nhật sau.');
        }

        // Store generated wallet temporarily (will be cleared after user confirms)
        setGeneratedWallet({
          address: walletAddress,
          privateKey: privateKey,
        });

        // Update user in auth store with wallet address
        const { updateUser } = useAuthStore.getState();
        if (updateUser) {
          updateUser({
            walletAddress: walletAddress,
            wallet_address: walletAddress,
          });
        }

        // Sync wallet address to app store
        const { syncUserFromAuth } = useAppStore.getState();
        if (syncUserFromAuth) {
          syncUserFromAuth({
            ...result.user,
            walletAddress: walletAddress,
            wallet_address: walletAddress,
          });
        }

        addUser({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: 'VOTER',
        });

        // Show private key display
        setShowPrivateKey(true);
        toast.success('Đăng ký thành công! Vui lòng lưu private key của bạn.');
      } else {
        const errorMsg = result.error || 'Đăng ký thất bại';
        setErrors({ submit: typeof errorMsg === 'string' ? errorMsg : 'Đăng ký thất bại' });
        toast.error(typeof errorMsg === 'string' ? errorMsg : 'Đăng ký thất bại');
      }
    } catch (err) {
      const errorMsg = err?.message || 'Đã xảy ra lỗi';
      const finalMsg = typeof errorMsg === 'string' ? errorMsg : 'Đã xảy ra lỗi';
      setErrors({ submit: finalMsg });
      toast.error(finalMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrivateKeyConfirmed = () => {
    // Clear private key from memory
    setGeneratedWallet(null);
    setShowPrivateKey(false);
    
    // Navigate to wallet onboarding or dashboard
    window.setTimeout(() => {
      navigate('/auth/wallet-onboarding');
    }, 500);
  };

  // Show private key display if wallet was generated
  if (showPrivateKey && generatedWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        </div>
        <div className="relative z-10">
          <PrivateKeyDisplay
            privateKey={generatedWallet.privateKey}
            walletAddress={generatedWallet.address}
            onConfirm={handlePrivateKeyConfirmed}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 animate-slideUp">
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Đăng ký</h1>
            <p className="text-gray-600">Tạo tài khoản mới để tham gia bầu cử</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Họ tên đầy đủ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="Nhập họ tên đầy đủ"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm ${
                  errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-blue-400'
                } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                disabled={isLoading}
                autoComplete="name"
              />
              {errors.name && (
                <span className="mt-1 text-sm text-red-600 block">{errors.name}</span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="Nhập email"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm ${
                  errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-blue-400'
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
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={handleChange('phone')}
                placeholder="Nhập số điện thoại (10-11 số)"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm ${
                  errors.phone ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-blue-400'
                } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                disabled={isLoading}
                autoComplete="tel"
              />
              {errors.phone && (
                <span className="mt-1 text-sm text-red-600 block">{errors.phone}</span>
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
                  className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm ${
                    errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-blue-400'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  disabled={isLoading}
                  autoComplete="new-password"
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

            {formData.password && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${(passwordStrength.strength + 1) * 20}%`,
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                </div>
                <span className="text-sm font-medium" style={{ color: passwordStrength.color }}>
                  {passwordStrength.label}
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Xác nhận mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange('confirmPassword')}
                  placeholder="Nhập lại mật khẩu"
                  className={`w-full px-4 py-3 pr-12 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm ${
                    errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 hover:border-blue-400'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  disabled={isLoading}
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none p-1"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? (
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
              {errors.confirmPassword && (
                <span className="mt-1 text-sm text-red-600 block">{errors.confirmPassword}</span>
              )}
            </div>

            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <div className="text-sm text-green-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Mật khẩu khớp
              </div>
            )}

            <div>
              <Checkbox
                checked={formData.agreeToTerms}
                onChange={handleChange('agreeToTerms')}
                label={
                  <>
                    Tôi đồng ý với{' '}
                    <Link to="/terms" target="_blank" className="text-blue-600 hover:text-blue-700 underline">
                      Điều khoản sử dụng
                    </Link>{' '}
                    và{' '}
                    <Link to="/privacy" target="_blank" className="text-blue-600 hover:text-blue-700 underline">
                      Chính sách bảo mật
                    </Link>
                  </>
                }
                disabled={isLoading}
              />
              {errors.agreeToTerms && (
                <span className="mt-1 text-sm text-red-600 block">{errors.agreeToTerms}</span>
              )}
            </div>

            {errors.submit && (
              <Alert variant="error">{errors.submit}</Alert>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Đang đăng ký...
                </span>
              ) : 'Đăng ký'}
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

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-900">
              Đã có tài khoản?{' '}
              <Link to="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium underline">
                Đăng nhập ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
