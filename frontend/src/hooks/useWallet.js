import { useEffect, useState, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from './useWeb3';
import { useAppStore } from '../store/useAppStore';

const useWallet = () => {
  const { provider, signer, account, isConnected, connect, disconnect } = useWeb3();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(null);
  const { updateWallet, updateWalletStatus } = useAppStore();
  const user = useAppStore((state) => state.user);
  const walletAddressRef = useRef(null);

  // Sync with store
  useEffect(() => {
    const storeWallet = user?.wallet;
    const storeAddress = storeWallet?.address;
    const storeStatus = storeWallet?.status;

    if (storeAddress && storeStatus === 'connected') {
      if (walletAddressRef.current !== storeAddress) {
        walletAddressRef.current = storeAddress;
        updateWallet({
          address: storeAddress,
          status: 'connected',
        });
      }
    } else if (!storeAddress || storeStatus !== 'connected') {
      if (walletAddressRef.current !== null) {
        walletAddressRef.current = null;
        updateWalletStatus('disconnected');
      }
    }
  }, [user?.id, user?.wallet, updateWallet, updateWalletStatus]);

  // Get balance
  const getBalance = useCallback(async () => {
    if (!account || !provider) {
      setBalance(null);
      return;
    }

    try {
      const balance = await provider.getBalance(account);
      const balanceInEth = parseFloat(ethers.formatEther(balance));
      setBalance(balanceInEth);
    } catch (error) {
      console.error('Error getting balance:', error);
      setBalance(null);
    }
  }, [account, provider]);

  // Update wallet when account changes
  useEffect(() => {
    if (account && isConnected) {
      updateWallet({
        address: account,
        status: 'connected',
      });
      walletAddressRef.current = account;
      getBalance();
    } else if (!account && !isConnected) {
      updateWalletStatus('disconnected');
      walletAddressRef.current = null;
      setBalance(null);
    }
  }, [account, isConnected, updateWallet, updateWalletStatus, getBalance]);

  // Connect wallet
  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const success = await connect();
      if (success) {
        await getBalance();
      } else {
        setError('Failed to connect wallet');
      }
      return { success, account };
    } catch (error) {
      console.error('Connect wallet error:', error);
      setError(error.message || 'Failed to connect wallet');
      return { success: false, error: error.message };
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      disconnect();
      updateWalletStatus('disconnected');
      walletAddressRef.current = null;
      setBalance(null);
      setError(null);
    } catch (error) {
      console.error('Disconnect wallet error:', error);
      setError(error.message || 'Failed to disconnect wallet');
    }
  };

  // Refresh balance
  const refreshBalance = async () => {
    await getBalance();
  };

  return {
    account,
    isConnected,
    isConnecting,
    error,
    balance,
    connect: connectWallet,
    disconnect: disconnectWallet,
    refreshBalance,
    provider,
    signer,
  };
};

export default useWallet;
