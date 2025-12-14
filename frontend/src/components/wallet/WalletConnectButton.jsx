import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import useWallet from '../../hooks/useWallet';
import useWalletStore from '../../store/useWalletStore';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { toast } from 'react-hot-toast';

const WalletConnectButton = ({ showAddress = true, variant = 'primary', size = 'medium', className = '' }) => {
  const { account, isConnected, isConnecting, connect, disconnect } = useWallet();
  const isMetaMaskInstalled = useWalletStore((state) => state.isMetaMaskInstalled);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    setHasMetaMask(isMetaMaskInstalled());
  }, [isMetaMaskInstalled]);

  const handleConnect = async () => {
    // Check MetaMask installation first
    if (!hasMetaMask) {
      toast.error('MetaMask chưa được cài đặt. Vui lòng cài đặt MetaMask extension.', {
        duration: 5000,
      });
      // Open MetaMask download page
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    // Show info toast that popup will appear
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
      
      // Note: Database update and page reload are handled in useWalletStore.connectWallet()
      // No need to manually refresh here as the page will reload automatically
    } else {
      toast.error(result.error || 'Không thể kết nối MetaMask', {
        duration: 5000,
      });
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    toast.success('Đã ngắt kết nối MetaMask');
  };

  if (isConnected && account) {
    return (
      <div className="flex items-center gap-2">
        {showAddress && (
          <Badge variant="success" className="font-mono text-xs">
            {account.slice(0, 6)}...{account.slice(-4)}
          </Badge>
        )}
        <Button
          onClick={handleDisconnect}
          variant="outline"
          size={size}
          className={className}
        >
          Ngắt kết nối
        </Button>
      </div>
    );
  }

  if (!hasMetaMask) {
    return (
      <Button
        onClick={handleConnect}
        variant={variant}
        size={size}
        className={className}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Cài đặt MetaMask
        </span>
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      variant={variant}
      size={size}
      className={className}
    >
      {isConnecting ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Đang kết nối...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Kết nối MetaMask
        </span>
      )}
    </Button>
  );
};

WalletConnectButton.propTypes = {
  showAddress: PropTypes.bool,
  variant: PropTypes.string,
  size: PropTypes.string,
  className: PropTypes.string,
};

export default WalletConnectButton;

