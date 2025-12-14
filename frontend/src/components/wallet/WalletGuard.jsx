import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import useWallet from '../../hooks/useWallet';
import useWalletStore from '../../store/useWalletStore';
import WalletConnectButton from './WalletConnectButton';
import Badge from '../common/Badge';
import { toast } from 'react-hot-toast';

const WalletGuard = ({ children, showConnectButton = true, showWarning = true }) => {
  const { isConnected, isConnecting } = useWallet();
  const isMetaMaskInstalled = useWalletStore((state) => state.isMetaMaskInstalled);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    setHasMetaMask(isMetaMaskInstalled());
  }, [isMetaMaskInstalled]);

  useEffect(() => {
    if (!isConnected && !isConnecting && showWarning) {
      if (!hasMetaMask) {
        toast.error('MetaMask chưa được cài đặt. Vui lòng cài đặt MetaMask extension.', {
          id: 'wallet-not-installed',
          duration: 5000,
        });
      } else {
        toast.error('Vui lòng kết nối MetaMask để thực hiện thao tác này', {
          id: 'wallet-not-connected',
          duration: 3000,
        });
      }
    }
  }, [isConnected, isConnecting, showWarning, hasMetaMask]);

  if (!isConnected) {
    return (
      <div className="space-y-4">
        {showWarning && (
          <div className={`p-4 border rounded-lg ${
            !hasMetaMask 
              ? 'bg-red-50 border-red-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={!hasMetaMask ? 'error' : 'warning'}>
                {!hasMetaMask ? 'Lỗi' : 'Cảnh báo'}
              </Badge>
              <span className={`text-sm font-medium ${
                !hasMetaMask ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {!hasMetaMask ? 'MetaMask chưa được cài đặt' : 'Chưa kết nối MetaMask'}
              </span>
            </div>
            <p className={`text-sm mb-3 ${
              !hasMetaMask ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {!hasMetaMask 
                ? 'Bạn cần cài đặt MetaMask extension để sử dụng tính năng này. MetaMask là ví tiền điện tử an toàn và miễn phí.'
                : 'Bạn cần kết nối MetaMask để thực hiện thao tác này. MetaMask sẽ hiển thị popup để bạn xác nhận giao dịch.'
              }
            </p>
            {showConnectButton && (
              <WalletConnectButton />
            )}
          </div>
        )}
        {showConnectButton && !showWarning && (
          <WalletConnectButton />
        )}
      </div>
    );
  }

  return <>{children}</>;
};

WalletGuard.propTypes = {
  children: PropTypes.node.isRequired,
  showConnectButton: PropTypes.bool,
  showWarning: PropTypes.bool,
};

export default WalletGuard;

