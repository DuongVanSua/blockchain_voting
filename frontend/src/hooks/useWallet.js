import { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import useWalletStore from '../store/useWalletStore';

const useWallet = () => {
  const {
    address,
    chainId,
    isConnected,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    checkConnection,
    getProvider,
  } = useWalletStore();

  const [balance, setBalance] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Update provider and signer
  useEffect(() => {
    if (isConnected && address) {
      const prov = getProvider();
      setProvider(prov);
      
      if (prov) {
        prov.getSigner().then((sig) => {
          setSigner(sig);
        }).catch((err) => {
          console.error('Error getting signer:', err);
        });
      }
    } else {
      setProvider(null);
      setSigner(null);
    }
  }, [isConnected, address, getProvider]);

  // Get balance
  const getBalance = useCallback(async () => {
    if (!address || !provider) {
      setBalance(null);
      return;
    }

    try {
      const balance = await provider.getBalance(address);
      const balanceInEth = parseFloat(ethers.formatEther(balance));
      setBalance(balanceInEth);
    } catch (error) {
      console.error('Error getting balance:', error);
      setBalance(null);
    }
  }, [address, provider]);

  // Update balance when address or provider changes
  useEffect(() => {
    if (address && provider) {
      getBalance();
    } else {
      setBalance(null);
    }
  }, [address, provider, getBalance]);

  // Connect wallet and update database
  const connect = async () => {
    const result = await connectWallet();
    
    // Note: Database update is now handled in useWalletStore.connectWallet()
    // to ensure it happens even if address changed
    // This hook just returns the result
    
    return result;
  };

  // Disconnect wallet
  const disconnect = async () => {
    disconnectWallet();
    setBalance(null);
  };

  return {
    account: address,
    address,
    chainId,
    isConnected,
    isConnecting,
    error,
    balance,
    connect,
    disconnect,
    refreshBalance: getBalance,
    provider,
    signer,
  };
};

export default useWallet;
