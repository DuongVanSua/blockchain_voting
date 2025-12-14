# Hướng dẫn Deploy qua MetaMask

## 🎯 Tổng quan

Script deploy qua MetaMask sẽ yêu cầu bạn xác nhận từng transaction trong MetaMask extension, thay vì sử dụng private key từ file `.env`.

## 📋 Có 2 cách deploy qua MetaMask:

### Cách 1: Sử dụng HTML Page (Khuyến nghị) ⭐

**Ưu điểm:** Dễ sử dụng, giao diện trực quan, không cần cấu hình

#### Bước 1: Compile contracts
```bash
cd smartcontract
npm run compile
```

#### Bước 2: Mở HTML page
```bash
# Mở file trong browser
open scripts/deploy-metamask-browser.html
# hoặc
# Windows: start scripts/deploy-metamask-browser.html
# Linux: xdg-open scripts/deploy-metamask-browser.html
```

#### Bước 3: Làm theo hướng dẫn trên page
1. **Connect MetaMask** - Click nút "Connect MetaMask"
2. **Load Contract Artifacts** - Upload 3 file JSON từ `artifacts/contracts/`:
   - `VotingToken.sol/VotingToken.json`
   - `VoterRegistry.sol/VoterRegistry.json`
   - `ElectionFactory.sol/ElectionFactory.json`
3. **Deploy Contracts** - Click "Deploy All Contracts"
   - MetaMask sẽ popup để xác nhận từng transaction
   - Xác nhận 3 transactions (VotingToken, VoterRegistry, ElectionFactory)

#### Bước 4: Copy kết quả
- Deployment addresses sẽ hiển thị trên page
- Click "Copy Results to Clipboard" để copy JSON

---

### Cách 2: Sử dụng Script Node.js (Nâng cao)

**Lưu ý:** Script này yêu cầu browser environment hoặc bridge để kết nối với MetaMask.

#### Option A: Sử dụng với Browser Console

1. Compile contracts:
```bash
npm run compile
```

2. Mở browser console (F12) và chạy:
```javascript
// Load script
const script = document.createElement('script');
script.src = 'https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js';
document.head.appendChild(script);

// Sau đó chạy logic deploy (cần load artifacts từ files)
```

#### Option B: Sử dụng với Puppeteer (Tự động hóa)

Cần cài đặt thêm:
```bash
npm install --save-dev puppeteer
```

Tạo script bridge để kết nối với MetaMask extension.

---

## 🔧 Cấu hình

### 1. MetaMask Network

Đảm bảo MetaMask đang kết nối đúng network:

- **Localhost:** `http://127.0.0.1:8545` (Chain ID: 1337)
- **Sepolia Testnet:** Chain ID: 11155111
- **Goerli Testnet:** Chain ID: 5

### 2. Add Localhost Network vào MetaMask (nếu chưa có)

Nếu deploy trên localhost, thêm network vào MetaMask:

1. Mở MetaMask → Settings → Networks → Add Network
2. Thông tin network:
   - **Network Name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `1337`
   - **Currency Symbol:** `ETH`
   - **Block Explorer:** (để trống)

---

## 📝 Quy trình Deploy

### Thứ tự deploy tự động:

1. **VotingToken** 
   - Constructor: `("Voting Token", "VOTE")`
   - MetaMask popup #1: Xác nhận deploy VotingToken

2. **VoterRegistry**
   - Constructor: `(18)` - min voting age
   - MetaMask popup #2: Xác nhận deploy VoterRegistry

3. **ElectionFactory**
   - Constructor: `(voterRegistryAddress, votingTokenAddress)`
   - MetaMask popup #3: Xác nhận deploy ElectionFactory

### Mỗi transaction sẽ:
- Hiển thị gas estimate
- Yêu cầu xác nhận trong MetaMask
- Chờ confirmation trên blockchain
- Hiển thị contract address sau khi deploy thành công

---

## ⚠️ Lưu ý quan trọng

1. **Gas Fees:** Bạn cần có đủ ETH trong MetaMask để trả gas fees
   - Localhost: Không cần ETH thật (nhưng cần có trong account)
   - Testnet: Cần ETH từ faucet
   - Mainnet: Cần ETH thật

2. **Network Matching:** Đảm bảo MetaMask đang ở đúng network với script deploy

3. **Account Balance:** Kiểm tra balance trước khi deploy
   - Minimum: 0.01 ETH (cho testnet)
   - Recommended: 0.1 ETH

4. **Transaction Confirmation:** 
   - Đừng đóng MetaMask popup
   - Đợi confirmation trước khi deploy contract tiếp theo
   - Có thể mất vài giây đến vài phút tùy network

---

## 🐛 Troubleshooting

### Lỗi: "MetaMask is not installed"
- Cài đặt MetaMask extension: https://metamask.io/
- Refresh page và thử lại

### Lỗi: "User rejected the transaction"
- Bạn đã từ chối transaction trong MetaMask
- Thử lại và xác nhận transaction

### Lỗi: "Insufficient funds"
- Fund account với ETH
- Localhost: Account có sẵn ETH từ Hardhat node
- Testnet: Dùng faucet để lấy ETH

### Lỗi: "Network mismatch"
- Kiểm tra MetaMask đang ở đúng network
- Switch network trong MetaMask nếu cần

### Lỗi: "Contract artifacts not found"
- Chạy `npm run compile` trước
- Đảm bảo file JSON tồn tại trong `artifacts/contracts/`

---

## 📊 So sánh với Deploy thông thường

| Tính năng | Deploy thông thường | Deploy qua MetaMask |
|-----------|---------------------|---------------------|
| **Private Key** | Cần trong `.env` | Không cần |
| **Xác nhận** | Tự động | Popup MetaMask |
| **Bảo mật** | Private key trong file | Private key trong MetaMask |
| **Dễ sử dụng** | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Phù hợp** | CI/CD, automation | Development, Testing |

---

## ✅ Checklist

Trước khi deploy qua MetaMask:

- [ ] MetaMask đã được cài đặt
- [ ] MetaMask đã unlock và có account
- [ ] Đã kết nối đúng network (localhost/testnet)
- [ ] Account có đủ ETH để trả gas fees
- [ ] Đã compile contracts (`npm run compile`)
- [ ] Đã chuẩn bị contract artifacts (cho HTML page)

---

## 🎉 Sau khi deploy thành công

1. **Lưu addresses:** Copy deployment addresses từ kết quả
2. **Update backend:** Cập nhật `backend/config/blockchain.js` với addresses mới
3. **Test:** Test các chức năng với addresses mới

---

**Chúc bạn deploy thành công qua MetaMask! 🚀**

