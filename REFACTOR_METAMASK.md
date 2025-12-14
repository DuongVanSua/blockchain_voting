# Refactor Frontend: MetaMask Integration

## Tổng quan
Đã refactor toàn bộ frontend để bỏ cơ chế "tạo ví + privateKey" và thay bằng Connect MetaMask.

## Files đã thay đổi

### 1. Store & Hooks
- **`frontend/src/store/useWalletStore.js`** (NEW)
  - Wallet store mới với Zustand
  - Quản lý state: `address`, `chainId`, `isConnected`, `isConnecting`, `error`
  - Methods: `connectWallet()`, `disconnectWallet()`, `checkConnection()`, `getProvider()`, `getSigner()`
  - Listen events: `accountsChanged`, `chainChanged` → auto reload page

- **`frontend/src/hooks/useWallet.js`** (UPDATED)
  - Refactor để chỉ dùng MetaMask
  - Tự động sync với `useWalletStore`
  - Tự động update wallet address trong database khi connect

### 2. Components
- **`frontend/src/components/wallet/WalletConnectButton.jsx`** (NEW)
  - Component để connect/disconnect MetaMask
  - Hiển thị address khi đã connect
  - Show loading state khi connecting

- **`frontend/src/components/wallet/WalletGuard.jsx`** (NEW)
  - Component wrapper để protect actions cần MetaMask
  - Show warning toast nếu chưa connect
  - Có thể show connect button

### 3. Pages
- **`frontend/src/pages/auth/WalletOnboarding.jsx`** (REFACTORED)
  - Bỏ tất cả logic tạo wallet/import private key
  - Chỉ còn connect MetaMask
  - Hướng dẫn user cài đặt MetaMask nếu chưa có

- **`frontend/src/pages/auth/Register.jsx`** (REFACTORED)
  - Bỏ tạo wallet khi đăng ký
  - Bỏ PrivateKeyDisplay component
  - Sau khi đăng ký thành công → redirect đến WalletOnboarding

### 4. Services
- **`frontend/src/services/contractService.js`** (UPDATED)
  - Tự động lấy signer từ `useWalletStore` thay vì nhận từ params
  - Methods `createElection()`, `castVote()`, etc. tự động dùng MetaMask signer
  - MetaMask sẽ popup để user xác nhận transactions

### 5. Dashboard Components
- **`frontend/src/pages/voter/VoterDashboardRBAC.jsx`** (UPDATED)
  - Disable "Bầu cử" button nếu chưa connect MetaMask
  - Show toast warning nếu chưa connect
  - `handleVote()` check `wallet.isConnected` trước khi vote

- **`frontend/src/pages/creator/CreatorDashboard.jsx`** (UPDATED)
  - Disable "Tạo Election Mới" button nếu chưa connect MetaMask
  - `handleCreateElection()` check `wallet.isConnected`
  - Wrap button với `WalletGuard`

- **`frontend/src/components/layout/Header.jsx`** (UPDATED)
  - Thay address display bằng `WalletConnectButton`
  - Hiển thị connect button nếu chưa connect

## Tính năng mới

### 1. Auto Event Listeners
- `accountsChanged`: Khi user switch account trong MetaMask → auto reload page
- `chainChanged`: Khi user switch network → auto reload page

### 2. Disable Actions
- Tất cả actions cần signer (vote, create election, etc.) đều disable nếu chưa connect
- Show tooltip/warning message

### 3. Toast Notifications
- Warning khi chưa connect MetaMask
- Success khi connect thành công
- Error khi connect fail

## Migration Guide

### Để sử dụng trong components mới:

```jsx
import useWallet from '../../hooks/useWallet';
import WalletGuard from '../../components/wallet/WalletGuard';
import WalletConnectButton from '../../components/wallet/WalletConnectButton';

const MyComponent = () => {
  const wallet = useWallet();
  
  // Check connection
  if (!wallet.isConnected) {
    return <WalletConnectButton />;
  }
  
  // Or wrap actions
  return (
    <WalletGuard>
      <Button onClick={handleAction}>Action</Button>
    </WalletGuard>
  );
};
```

### Để gọi contract methods:

```jsx
import { contractService } from '../../services/contractService';

// ContractService tự động lấy signer từ wallet store
// MetaMask sẽ popup để user xác nhận
const result = await contractService.createElection(...);
const voteResult = await contractService.castVote(...);
```

## Files cần xóa (không còn dùng)

- `frontend/src/components/wallet/PrivateKeyDisplay.jsx` - Không còn dùng
- `frontend/src/utils/walletHelpers.js` - Có thể xóa `connectWithPrivateKey()`

## Testing Checklist

- [ ] Connect MetaMask từ WalletOnboarding
- [ ] Disconnect MetaMask
- [ ] Switch account trong MetaMask → page reload
- [ ] Switch network → page reload
- [ ] Vote election → MetaMask popup xuất hiện
- [ ] Create election → MetaMask popup xuất hiện
- [ ] Disable buttons khi chưa connect
- [ ] Show toast warnings khi chưa connect

