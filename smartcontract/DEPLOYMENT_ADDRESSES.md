# Contract Deployment Addresses

## Localhost (Chain ID: 1337)

**Deployer:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

**Deployment Date:** 2025-12-14T04:11:18.444Z

### Contract Addresses

| Contract | Address |
|----------|---------|
| **VotingToken** | `0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e` |
| **VoterRegistry** | `0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0` |
| **ElectionFactory** | `0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82` |
| **Election** (Test) | `0x9A676e781A523b5d0C0e43731313A708CB607508` |

### JSON Format

```json
{
  "network": "unknown",
  "chainId": "1337",
  "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "contracts": {
    "VotingToken": "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    "VoterRegistry": "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    "ElectionFactory": "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
    "Election": "0x9A676e781A523b5d0C0e43731313A708CB607508"
  },
  "timestamp": "2025-12-14T04:11:18.444Z"
}
```

## Files to Update After New Deployment

Khi deploy contract mới, cần cập nhật địa chỉ ở các file sau:

1. **`frontend/src/config/contracts.js`**
   - Cập nhật `CONTRACT_ADDRESSES` object

2. **`smartcontract/deployments/localhost/deployment.json`**
   - Cập nhật toàn bộ file với địa chỉ mới

3. **`smartcontract/DEPLOYMENT_ADDRESSES.md`** (file này)
   - Cập nhật bảng địa chỉ và JSON format

## Notes

- **VotingToken**: Được sử dụng để mint token cho voters khi creator add voter
- **VoterRegistry**: Quản lý danh sách voters eligible
- **ElectionFactory**: Factory contract để tạo các election mới
- **Election**: Được tạo bởi ElectionFactory, mỗi election có địa chỉ riêng

## Verification

Để verify contract đã được deploy đúng:

```bash
# Check VotingToken
npx hardhat verify --network localhost 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e "Voting Token" "VOTE"

# Check VoterRegistry
npx hardhat verify --network localhost 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0 18

# Check ElectionFactory
npx hardhat verify --network localhost 0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82 0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0 0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e
```

