import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ethers } from 'ethers';
import Button from '../common/Button';
import Card from '../common/Card';
import { toast } from 'react-hot-toast';

const AccountSelector = ({ onSelectAccount, onCancel, currentAccount = null }) => {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(currentAccount);
  const [balances, setBalances] = useState({});

  const loadAccounts = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Request all accounts from MetaMask
      const allAccounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (allAccounts.length === 0) {
        toast.error('Không tìm thấy account nào trong MetaMask');
        setIsLoading(false);
        return;
      }

      setAccounts(allAccounts);
      
      // Set default selected account if not already set
      setSelectedAccount((prev) => {
        if (!prev && allAccounts.length > 0) {
          return allAccounts[0];
        }
        return prev;
      });

      // Get balances for all accounts
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balancePromises = allAccounts.map(async (account) => {
        try {
          const balance = await provider.getBalance(account);
          return { account, balance: ethers.formatEther(balance) };
        } catch (error) {
          return { account, balance: '0' };
        }
      });

      const balanceResults = await Promise.all(balancePromises);
      const balanceMap = {};
      balanceResults.forEach(({ account, balance }) => {
        balanceMap[account] = balance;
      });
      setBalances(balanceMap);

      setIsLoading(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading accounts:', error);
      toast.error('Lỗi tải danh sách accounts: ' + error.message);
      setIsLoading(false);
    }
  }, []); // loadAccounts doesn't depend on selectedAccount since we use functional update

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleCreateNewAccount = () => {
    toast.info(
      'Vui lòng tạo account mới trong MetaMask:\n' +
      '1. Mở MetaMask\n' +
      '2. Click vào icon account ở góc trên bên phải\n' +
      '3. Chọn "Create account"\n' +
      '4. Quay lại và refresh trang này',
      { duration: 5000 }
    );
  };

  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
  };

  const handleConfirm = () => {
    if (!selectedAccount) {
      toast.error('Vui lòng chọn một account');
      return;
    }
    onSelectAccount(selectedAccount);
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Đang tải danh sách accounts...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        Chọn Account từ MetaMask
      </h3>
      <p className="text-gray-600 mb-6">
        Chọn account bạn muốn sử dụng cho tài khoản này. Mỗi tài khoản voter nên có account riêng.
      </p>

      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
        {accounts.map((account) => (
          <div
            key={account}
            onClick={() => handleSelectAccount(account)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedAccount === account
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedAccount === account
                        ? 'border-blue-600 bg-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedAccount === account && (
                      <div className="w-2 h-2 rounded-full bg-white"></div>
                    )}
                  </div>
                  <span className="font-mono text-sm font-medium text-gray-900">
                    {formatAddress(account)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 ml-6">
                  {parseFloat(balances[account] || '0').toFixed(4)} ETH
                </p>
              </div>
              {selectedAccount === account && (
                <span className="text-blue-600 text-sm font-medium">Đã chọn</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={handleCreateNewAccount}
          className="flex-1"
        >
          Tạo Account Mới trong MetaMask
        </Button>
        <Button
          variant="secondary"
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!selectedAccount}
        >
          Xác nhận
        </Button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Nếu bạn muốn tạo account mới, hãy tạo trong MetaMask trước, sau đó refresh trang này để thấy account mới.
        </p>
      </div>
    </Card>
  );
};

AccountSelector.propTypes = {
  onSelectAccount: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  currentAccount: PropTypes.string,
};

export default AccountSelector;

