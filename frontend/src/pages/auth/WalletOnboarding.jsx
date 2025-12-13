import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import useWallet from '../../hooks/useWallet';
import useAppStore from '../../store/useAppStore';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import Alert from '../../components/common/Alert';
import Checkbox from '../../components/common/Checkbox';
import AccountSelector from '../../components/wallet/AccountSelector';
import { toast } from 'react-hot-toast';


const WalletOnboarding = () => {
  const navigate = useNavigate();
  const { account, isConnecting } = useWallet();
  const { user, updateWallet, updateUserByEmail } = useAppStore();

  const [step, setStep] = useState(1);
  const [generatedWallet, setGeneratedWallet] = useState(null);
  const [seedPhrase, setSeedPhrase] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [importErrors, setImportErrors] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConnectingMetaMask, setIsConnectingMetaMask] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(() => typeof window !== 'undefined' && !!window.ethereum);
  const [showAccountSelector, setShowAccountSelector] = useState(false);


  const handleGenerateWallet = async () => {
    setIsGenerating(true);
    try {

      const wallet = ethers.Wallet.createRandom();
      const mnemonic = wallet.mnemonic.phrase;
      const address = wallet.address;
      const privateKey = wallet.privateKey;

      setGeneratedWallet({
        address,
        mnemonic,
        privateKey,
      });
      setSeedPhrase(mnemonic);
      setStep(3);
      toast.success('Ví đã được tạo thành công!');
    } catch (error) {
      console.error('Error generating wallet:', error);
      toast.error('Lỗi tạo ví: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };


  const validateSeedPhrase = (phrase) => {
    const words = phrase.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      return { valid: false, error: 'Seed phrase phải có 12 hoặc 24 từ' };
    }


    try {
      ethers.Wallet.fromPhrase(phrase);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Seed phrase không hợp lệ' };
    }
  };


  const validatePrivateKey = (key) => {
    if (!key.startsWith('0x')) {
      return { valid: false, error: 'Private key phải bắt đầu bằng 0x' };
    }
    if (key.length !== 66) {
      return { valid: false, error: 'Private key không đúng độ dài' };
    }

    try {
      new ethers.Wallet(key);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Private key không hợp lệ' };
    }
  };


  const handleImportWallet = async () => {
    const errors = {};

    if (seedPhrase.trim() && privateKey.trim()) {
      errors.general = 'Chỉ nhập seed phrase HOẶC private key, không nhập cả hai';
      setImportErrors(errors);
      return;
    }

    if (seedPhrase.trim()) {
      const validation = validateSeedPhrase(seedPhrase);
      if (!validation.valid) {
        errors.seedPhrase = validation.error;
        setImportErrors(errors);
        return;
      }

      try {
        const wallet = ethers.Wallet.fromPhrase(seedPhrase.trim());
        await saveWallet(wallet.address, seedPhrase, wallet.privateKey);
      } catch (error) {
        errors.seedPhrase = 'Không thể import từ seed phrase: ' + error.message;
        setImportErrors(errors);
        return;
      }
    } else if (privateKey.trim()) {
      const validation = validatePrivateKey(privateKey.trim());
      if (!validation.valid) {
        errors.privateKey = validation.error;
        setImportErrors(errors);
        return;
      }

      try {
        const wallet = new ethers.Wallet(privateKey.trim());
        await saveWallet(wallet.address, null, wallet.privateKey);
      } catch (error) {
        errors.privateKey = 'Không thể import từ private key: ' + error.message;
        setImportErrors(errors);
        return;
      }
    } else {
      errors.general = 'Vui lòng nhập seed phrase hoặc private key';
      setImportErrors(errors);
      return;
    }

    setImportErrors({});
  };


  const saveWallet = async (address, mnemonic, _privateKey) => {
    try {
      // Import apiService to update wallet address in database
      const { default: apiService } = await import('../../services/apiService');
      
      try {
        // Update wallet address in database
        const updateResult = await apiService.updateWalletAddress(address);
        
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Không thể cập nhật địa chỉ ví vào database');
        }
      } catch (error) {
        console.error('Error updating wallet address:', error);
        toast.error('Lỗi cập nhật địa chỉ ví: ' + error.message);
        return;
      }

      const { updateWallet, updateUserByEmail } = useAppStore.getState();

      if (user?.email) {
        updateUserByEmail(user.email, {
          wallet: {
            address,
            mnemonic: mnemonic || null,
            status: 'connected',
          },
        });
      }

      updateWallet({
        address,
        status: 'connected',
      });

      const currentUser = useAppStore.getState().user;
      const updatedUser = {
        ...currentUser,
        wallet: {
          ...currentUser.wallet,
          address,
          mnemonic: mnemonic || null,
          status: 'connected',
        },
      };

      useAppStore.setState({ user: updatedUser });

      window.setTimeout(() => {
        toast.success('Ví đã được import thành công!');
        setStep(6);
      }, 100);
    } catch (error) {
      toast.error('Lỗi lưu ví: ' + error.message);
    }
  };


  const handleDownloadBackup = () => {
    if (!generatedWallet) return;

    const backupData = {
      address: generatedWallet.address,
      mnemonic: generatedWallet.mnemonic,
      privateKey: generatedWallet.privateKey,
      createdAt: new Date().toISOString(),
      warning: 'KHÔNG CHIA SẺ FILE NÀY VỚI BẤT KỲ AI!',
    };

    const encrypted = window.btoa(JSON.stringify(backupData));
    const blob = new window.Blob([encrypted], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-backup-${generatedWallet.address.slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('Đã tải về file backup!');
  };

  const handleConnectMetaMask = async () => {
    if (!hasMetaMask) {
      toast.error('MetaMask chưa được cài đặt. Vui lòng cài đặt MetaMask extension.');
      return;
    }

    // Show account selector to let user choose which account to use
    setShowAccountSelector(true);
  };

  const handleAccountSelected = async (selectedAccount) => {
    if (!selectedAccount) {
      toast.error('Vui lòng chọn một account');
      return;
    }

    setIsConnectingMetaMask(true);
    setShowAccountSelector(false);

    try {
      // Request permission to access accounts
      if (typeof window !== 'undefined' && window.ethereum) {
        // Request accounts access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });

        // Check if selected account is in the list
        if (!accounts.includes(selectedAccount)) {
          // If not, try to get all accounts
          const allAccounts = await window.ethereum.request({
            method: 'eth_accounts',
          });
          
          if (!allAccounts.includes(selectedAccount)) {
            throw new Error('Account đã chọn không có trong MetaMask. Vui lòng chọn lại hoặc tạo account mới trong MetaMask.');
          }
        }

        // Create provider and get current active account
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const currentSignerAddress = await signer.getAddress();
        
        // If the selected account is not the active one, save it anyway
        // User can switch account in MetaMask later
        if (currentSignerAddress.toLowerCase() !== selectedAccount.toLowerCase()) {
          toast.info(
            `Account hiện tại trong MetaMask là ${currentSignerAddress.slice(0, 6)}...${currentSignerAddress.slice(-4)}. ` +
            `Đã lưu account ${selectedAccount.slice(0, 6)}...${selectedAccount.slice(-4)} vào tài khoản của bạn. ` +
            `Bạn có thể chuyển sang account này trong MetaMask khi cần.`,
            { duration: 6000 }
          );
        }
      }

      // Import apiService to update wallet address in database
      const { default: apiService } = await import('../../services/apiService');
      
      try {
        // Update wallet address in database with selected account
        const updateResult = await apiService.updateWalletAddress(selectedAccount);
        
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Không thể cập nhật địa chỉ ví vào database');
        }
      } catch (error) {
        console.error('Error updating wallet address:', error);
        toast.error('Lỗi cập nhật địa chỉ ví: ' + error.message);
        setIsConnectingMetaMask(false);
        return;
      }

      const walletData = {
        address: selectedAccount,
        status: 'connected',
        balance: '0',
        network: 'localhost',
        type: 'metamask',
      };

      if (user?.email) {
        updateUserByEmail(user.email, {
          wallet: walletData,
        });
      }

      updateWallet(walletData);

      const currentUser = useAppStore.getState().user;
      const updatedUser = {
        ...currentUser,
        wallet: {
          ...currentUser.wallet,
          ...walletData,
        },
      };

      useAppStore.setState({ user: updatedUser });

      toast.success('Đã lưu địa chỉ ví vào tài khoản!');
      window.setTimeout(() => {
        navigate('/voter/dashboard');
      }, 500);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error connecting with selected account:', error);
      toast.error('Lỗi kết nối MetaMask: ' + error.message);
      setShowAccountSelector(true); // Show selector again on error
    } finally {
      setIsConnectingMetaMask(false);
    }
  };



  const handleUseGeneratedWallet = async () => {
    if (!generatedWallet) return;
    await saveWallet(generatedWallet.address, generatedWallet.mnemonic, generatedWallet.privateKey);
  };

  const handleInstallMetaMask = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    let installUrl = 'https://metamask.io/download/';
    
    if (userAgent.includes('chrome') || userAgent.includes('chromium')) {
      installUrl = 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn';
    } else if (userAgent.includes('firefox')) {
      installUrl = 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/';
    } else if (userAgent.includes('edge')) {
      installUrl = 'https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm';
    } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
      installUrl = 'https://addons.opera.com/en/extensions/details/metamask/';
    }
    
    window.open(installUrl, '_blank');
  };

  useEffect(() => {
    if (seedPhrase || privateKey) {
      setImportErrors({});
    }
  }, [seedPhrase, privateKey]);

  useEffect(() => {
    const checkMetaMask = () => {
      const hasMM = typeof window !== 'undefined' && !!window.ethereum;
      if (hasMM !== hasMetaMask) {
        setHasMetaMask(hasMM);
        if (hasMM) {
          toast.success('MetaMask đã được phát hiện! Bạn có thể kết nối ngay.');
        }
      }
    };

    checkMetaMask();
    const interval = window.setInterval(checkMetaMask, 1000);
    return () => window.clearInterval(interval);
  }, [hasMetaMask]);

  useEffect(() => {
    const checkMetaMask = () => {
      const hasMM = typeof window !== 'undefined' && !!window.ethereum;
      if (hasMM !== hasMetaMask) {
        setHasMetaMask(hasMM);
      }
    };

    checkMetaMask();
    const interval = window.setInterval(checkMetaMask, 1000);
    return () => window.clearInterval(interval);
  }, [hasMetaMask]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8 shadow-xl animate-slideUp">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">Thiết lập Ví Blockchain</h1>

        {showAccountSelector ? (
          <AccountSelector
            onSelectAccount={handleAccountSelected}
            onCancel={() => setShowAccountSelector(false)}
            currentAccount={account}
          />
        ) : step === 1 && (
          <div>
            <p className="text-gray-600 mb-6">Chọn phương thức thiết lập ví của bạn:</p>

            <Alert variant="warning" className="mb-6">
              <strong>Cảnh báo bảo mật:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Không bao giờ chia sẻ seed phrase hoặc private key với bất kỳ ai</li>
                <li>Lưu trữ seed phrase ở nơi an toàn, không lưu trên thiết bị công cộng</li>
                <li>Nếu mất seed phrase, bạn sẽ mất quyền truy cập ví vĩnh viễn</li>
                <li>Luôn xác minh địa chỉ ví trước khi nhận tiền</li>
              </ul>
            </Alert>

            <div className="space-y-4">
              {!hasMetaMask ? (
                <Button
                  onClick={handleInstallMetaMask}
                  variant="primary"
                  size="large"
                  className="w-full flex flex-col items-center p-6"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    <span>Cài đặt MetaMask</span>
                  </div>
                  <span className="text-sm opacity-90">Tải và cài đặt MetaMask extension</span>
                </Button>
              ) : (
                <Button
                  onClick={handleConnectMetaMask}
                  variant="primary"
                  size="large"
                  className="w-full flex flex-col items-center p-6"
                  disabled={isConnectingMetaMask || isConnecting}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    <span>{isConnectingMetaMask || isConnecting ? 'Đang kết nối...' : 'Kết nối MetaMask'}</span>
                  </div>
                  <span className="text-sm opacity-90">Kết nối với ví MetaMask của bạn</span>
                </Button>
              )}
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                size="large"
                className="w-full flex flex-col items-center p-6"
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>Tạo ví mới</span>
                </div>
                <span className="text-sm opacity-90">Tạo ví mới với seed phrase</span>
              </Button>
              <Button
                onClick={() => setStep(4)}
                variant="outline"
                size="large"
                className="w-full flex flex-col items-center p-6"
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span>Import ví có sẵn</span>
                </div>
                <span className="text-sm opacity-90">Nhập seed phrase hoặc private key</span>
              </Button>
            </div>

            <div className="mt-6 text-center">
              <Button
                onClick={() => navigate('/voter/dashboard')}
                variant="ghost"
                size="medium"
              >
                Bỏ qua và quay lại dashboard
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <Alert variant="info" className="mb-6">
              <strong>Thông tin:</strong> Hệ thống sẽ tạo một ví mới với seed phrase 12 từ.
              Bạn cần lưu lại seed phrase này để có thể khôi phục ví sau này.
            </Alert>

            <div className="flex gap-4">
              <Button
                onClick={handleGenerateWallet}
                variant="primary"
                size="large"
                disabled={isGenerating}
              >
                {isGenerating ? 'Đang tạo ví...' : 'Tạo ví mới'}
              </Button>
              <Button onClick={() => setStep(1)} variant="ghost" size="medium">
                ← Quay lại
              </Button>
            </div>
          </div>
        )}

        {step === 3 && generatedWallet && (
          <div>
            <Alert variant="error" className="mb-6">
              <strong>🔴 QUAN TRỌNG:</strong> Hãy ghi lại seed phrase này ngay bây giờ!
              Bạn sẽ không thể xem lại sau khi đóng trang này.
            </Alert>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Seed Phrase của bạn (12 từ)</h3>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                >
                  {showSeedPhrase ? 'Ẩn' : 'Hiện'}
                </Button>
              </div>

              {showSeedPhrase ? (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                  {generatedWallet.mnemonic.split(' ').map((word, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <span className="text-xs font-semibold text-gray-500 w-6">{index + 1}</span>
                      <span className="font-mono text-sm text-gray-900">{word}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 bg-gray-100 rounded-lg text-center">
                  <p className="text-gray-600">Nhấn nút &quot;Hiện&quot; để xem seed phrase</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleDownloadBackup}
                  size="medium"
                >
                  Tải về file backup (mã hóa)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.navigator.clipboard.writeText(generatedWallet.mnemonic);
                    toast.success('Đã sao chép seed phrase!');
                  }}
                  size="medium"
                >
                  Sao chép seed phrase
                </Button>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Địa chỉ ví</h3>
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <code className="font-mono text-sm bg-gray-100 p-3 rounded-lg break-all">{generatedWallet.address}</code>
                <div className="flex flex-col items-center">
                  <QRCodeSVG value={generatedWallet.address} size={150} />
                  <p className="text-sm text-gray-500 mt-2">Quét mã QR để xem địa chỉ</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <Checkbox
                checked={confirmedBackup}
                onChange={(e) => setConfirmedBackup(e.target.checked)}
                label="Tôi xác nhận đã ghi lại seed phrase và lưu trữ ở nơi an toàn"
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleUseGeneratedWallet}
                variant="primary"
                size="large"
                disabled={!confirmedBackup}
              >
                Xác nhận và Tiếp tục
              </Button>
              <Button onClick={() => setStep(1)} variant="ghost" size="medium">
                ← Quay lại
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <Alert variant="info" className="mb-6">
              Nhập seed phrase (12 hoặc 24 từ) hoặc private key để import ví có sẵn.
            </Alert>

            {importErrors.general && (
              <Alert variant="error" className="mb-6">{importErrors.general}</Alert>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seed Phrase (12 hoặc 24 từ)
                </label>
                <div className="relative">
                  <input
                    type={showSeedPhrase ? 'text' : 'password'}
                    value={seedPhrase}
                    onChange={(e) => {
                      setSeedPhrase(e.target.value);
                      setPrivateKey('');
                    }}
                    placeholder="word1 word2 word3 ..."
                    className={`w-full px-4 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      importErrors.seedPhrase ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                    tabIndex="-1"
                  >
                    {showSeedPhrase ? (
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
                {importErrors.seedPhrase && <span className="text-red-500 text-sm mt-1 block">{importErrors.seedPhrase}</span>}
              </div>

              <div className="text-center">
                <p className="text-gray-500 font-medium">HOẶC</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Private Key
                </label>
                <div className="relative">
                  <input
                    type={showPrivateKey ? 'text' : 'password'}
                    value={privateKey}
                    onChange={(e) => {
                      setPrivateKey(e.target.value);
                      setSeedPhrase('');
                    }}
                    placeholder="0x..."
                    className={`w-full px-4 py-2 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      importErrors.privateKey ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    tabIndex="-1"
                  >
                    {showPrivateKey ? (
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
                {importErrors.privateKey && <span className="text-red-500 text-sm mt-1 block">{importErrors.privateKey}</span>}
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <Button
                onClick={handleImportWallet}
                variant="primary"
                size="large"
                disabled={!seedPhrase.trim() && !privateKey.trim()}
              >
                Import và Kết nối
              </Button>
              <Button onClick={() => {
                setStep(1);
                setSeedPhrase('');
                setPrivateKey('');
                setImportErrors({});
              }} variant="text" size="medium">
                ← Quay lại
              </Button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ví đã được thiết lập thành công!</h2>
            <p className="text-gray-600 mb-6">Bạn có thể bắt đầu sử dụng hệ thống bầu cử.</p>
            <Button
              onClick={() => {
                window.setTimeout(() => {
                  navigate('/voter/dashboard');
                }, 200);
              }}
              variant="primary"
              size="large"
            >
              Về trang chủ
            </Button>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
};

export default WalletOnboarding;

