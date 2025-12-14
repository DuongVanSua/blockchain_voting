# Hướng dẫn Deploy Smart Contracts

## 📋 Mục lục
1. [Chuẩn bị](#chuẩn-bị)
2. [Deploy trên Hardhat Network (Testing)](#deploy-trên-hardhat-network-testing)
3. [Deploy trên Localhost](#deploy-trên-localhost)
4. [Deploy trên Testnet (Sepolia/Goerli)](#deploy-trên-testnet-sepoliagoerli)
5. [Kiểm tra Deployment](#kiểm-tra-deployment)

---

## 🔧 Chuẩn bị

### 1. Cài đặt dependencies
```bash
cd smartcontract
npm install
```

### 2. Compile contracts
```bash
npm run compile
```

### 3. Tạo file `.env` (cho testnet/mainnet)
```bash
# Copy từ .env.example nếu có, hoặc tạo mới
touch .env
```

Thêm vào `.env`:
```env
# Private key của account deployer (bắt đầu với 0x)
PRIVATE_KEY=0x...

# Alchemy API key (cho testnet/mainnet)
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

### 4. Generate account mới (nếu cần)
```bash
npm run generate-account
```

---

## 🚀 Deploy trên Hardhat Network (Testing)

**Ưu điểm:** Nhanh, không cần node chạy, dùng cho testing

```bash
npm run deploy:hardhat
# hoặc
npm run deploy:local
```

**Kết quả:**
- Contracts được deploy trên Hardhat in-memory network
- Addresses được lưu vào `deployments/hardhat/deployment.json`
- **Lưu ý:** Addresses sẽ thay đổi mỗi lần chạy lại

---

## 🏠 Deploy trên Localhost

**Yêu cầu:** Cần chạy Hardhat node trước

### Bước 1: Khởi động Hardhat node
```bash
# Terminal 1: Chạy Hardhat node
npm run node
# hoặc
npx hardhat node
```

Node sẽ chạy tại `http://127.0.0.1:8545` với 20 accounts có sẵn ETH.

### Bước 2: Deploy contracts
```bash
# Terminal 2: Deploy
npm run deploy:localhost
```

**Kết quả:**
- Contracts được deploy trên localhost network
- Addresses được lưu vào `deployments/localhost/deployment.json`
- Addresses sẽ giữ nguyên nếu dùng cùng node

---

## 🌐 Deploy trên Testnet (Sepolia/Goerli)

### Bước 1: Cấu hình `.env`
```env
PRIVATE_KEY=0x... # Private key của account deployer
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

### Bước 2: Fund account với ETH
- **Sepolia:** https://sepoliafaucet.com/
- **Goerli:** https://goerlifaucet.com/
- Cần ít nhất 0.01 ETH để deploy

### Bước 3: Deploy
```bash
# Deploy lên Sepolia
npm run deploy:sepolia

# Hoặc deploy lên Goerli (nếu có trong config)
npx hardhat run scripts/deploy.js --network goerli
```

**Kết quả:**
- Contracts được deploy trên testnet
- Addresses được lưu vào `deployments/sepolia/deployment.json` (hoặc goerli)
- Có thể xem trên Etherscan

---

## 📊 Kiểm tra Deployment

### 1. Xem deployment info
```bash
# Xem file deployment.json
cat deployments/hardhat/deployment.json
# hoặc
cat deployments/localhost/deployment.json
```

### 2. Verify contracts trên Etherscan (testnet/mainnet)
```bash
# Cài đặt hardhat-verify plugin (nếu chưa có)
npm install --save-dev @nomicfoundation/hardhat-verify

# Verify contract
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### 3. Copy ABI cho frontend
```bash
npm run copy-abi
```

ABI files sẽ được copy vào thư mục phù hợp cho frontend sử dụng.

---

## 📝 Thứ tự Deploy Contracts

Script `deploy.js` tự động deploy theo thứ tự:

1. **VotingToken** - Token ERC-20 cho voting
   - Constructor: `(name, symbol)` = `("Voting Token", "VOTE")`

2. **VoterRegistry** - Registry quản lý voters
   - Constructor: `(minVotingAge)` = `(18)`

3. **ElectionFactory** - Factory tạo elections
   - Constructor: `(voterRegistry, votingToken)`
   - Sử dụng addresses từ 2 contracts trên

**Lưu ý:** `Election.sol` không deploy trực tiếp, được tạo bởi `ElectionFactory` khi tạo election mới.

---

## 🔍 Troubleshooting

### Lỗi: "PRIVATE_KEY is not set"
- Kiểm tra file `.env` có tồn tại
- Đảm bảo `PRIVATE_KEY` bắt đầu với `0x` và có 66 ký tự

### Lỗi: "Insufficient balance"
- Fund account với ETH (testnet) hoặc dùng Hardhat network (có sẵn ETH)

### Lỗi: "Network not found"
- Kiểm tra `hardhat.config.js` có network đó không
- Đảm bảo đã cài đặt dependencies: `npm install`

### Lỗi: "Contract compilation failed"
- Chạy `npm run compile` để xem lỗi chi tiết
- Kiểm tra Solidity version trong `hardhat.config.js` (hiện tại: 0.8.20)

---

## 📚 Scripts có sẵn

| Script | Mô tả |
|--------|-------|
| `npm run compile` | Compile tất cả contracts |
| `npm run test` | Chạy tests |
| `npm run node` | Khởi động Hardhat node |
| `npm run deploy:hardhat` | Deploy trên Hardhat network |
| `npm run deploy:localhost` | Deploy trên localhost |
| `npm run deploy:sepolia` | Deploy trên Sepolia testnet |
| `npm run generate-account` | Tạo account mới |
| `npm run copy-abi` | Copy ABI files cho frontend |
| `npm run build` | Compile + Copy ABI |

---

## ✅ Checklist trước khi deploy

- [ ] Đã cài đặt dependencies (`npm install`)
- [ ] Đã compile contracts (`npm run compile`)
- [ ] Đã tạo file `.env` (cho testnet/mainnet)
- [ ] Đã set `PRIVATE_KEY` trong `.env` (cho testnet/mainnet)
- [ ] Đã set `ALCHEMY_API_KEY` trong `.env` (cho testnet/mainnet)
- [ ] Account có đủ ETH (cho testnet/mainnet)
- [ ] Đã chạy `npm run node` (cho localhost deployment)

---

## 🎯 Sau khi deploy

1. **Lưu addresses:** Copy addresses từ `deployment.json` vào backend config
2. **Update backend:** Cập nhật `backend/config/blockchain.js` với addresses mới
3. **Copy ABI:** Chạy `npm run copy-abi` để copy ABI cho frontend
4. **Test:** Test các chức năng với addresses mới

---

**Chúc bạn deploy thành công! 🚀**

