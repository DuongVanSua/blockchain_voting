# ACTIVITY LOG PANEL - THIẾT KẾ VÀ Ý TƯỞNG

## 📋 TỔNG QUAN

**Activity Log Panel** hiển thị lịch sử hoạt động từ blockchain events, không lưu database, phân quyền theo role.

---

## 🎯 MỤC TIÊU

### **Hiển thị:**
- ✅ **Ai thực hiện**: Address + Role (Owner/Creator/Voter)
- ✅ **Khi nào**: Timestamp (block.timestamp)
- ✅ **Thao tác gì**: Action type (create election, vote, mint token...)
- ✅ **Chi tiết**: Event data (electionId, candidateId, amount...)

### **Nguồn dữ liệu:**
- ✅ **Blockchain Events**: Query trực tiếp từ contracts
- ✅ **Không lưu database**: Real-time từ blockchain
- ✅ **Immutable**: Không thể sửa (blockchain đảm bảo)

### **Phân quyền:**
- ✅ **Owner**: Toàn bộ log hệ thống
- ✅ **Creator**: Log elections mình tạo + voter logs trong elections đó
- ✅ **Voter**: Log liên quan đến mình + public logs

---

## 📊 DANH SÁCH EVENTS CẦN THEO DÕI

### **1. ElectionFactory Events:**

| Event | Actor | Action | Data |
|-------|-------|--------|------|
| `ElectionCreated` | Creator | Create Election | electionId, title, creator, timestamp |
| `CreatorAdded` | Owner | Add Creator | creator, addedBy, timestamp |
| `CreatorRemoved` | Owner | Remove Creator | creator, removedBy, timestamp |
| `SystemPaused` | Owner | Pause System | pausedBy, timestamp |
| `SystemUnpaused` | Owner | Unpause System | unpausedBy, timestamp |
| `ElectionDeactivated` | Owner | Deactivate Election | electionId, deactivatedBy, timestamp |
| `OwnershipTransferred` | Owner | Transfer Ownership | oldOwner, newOwner, timestamp |
| `VoterRegistryUpdated` | Owner | Update Registry | oldRegistry, newRegistry, updatedBy, timestamp |
| `VotingTokenUpdated` | Owner | Update Token | oldToken, newToken, updatedBy, timestamp |

### **2. Election Events:**

| Event | Actor | Action | Data |
|-------|-------|--------|------|
| `ElectionStarted` | System/Auto | Start Election | electionId, startTime |
| `ElectionPaused` | Creator | Pause Election | electionId, pausedBy, timestamp |
| `ElectionResumed` | Creator | Resume Election | electionId, resumedBy, timestamp |
| `ElectionEnded` | System/Auto | End Election | electionId, endTime |
| `ElectionFinalized` | Creator | Finalize Election | electionId, winnerId, totalVotes, timestamp |
| `CandidateAdded` | Creator | Add Candidate | candidateId, name, party, addedBy |
| `CandidateRemoved` | Creator | Remove Candidate | candidateId, name, removedBy |
| `VoteCast` | Voter | Vote | voter, candidateId, timestamp, voteHash |
| `VoterRegistered` | Creator/Voter | Register Voter | voter, registeredBy, timestamp |
| `VoterRemoved` | Creator | Remove Voter | voter, removedBy, timestamp |
| `TokenRequirementUpdated` | Creator | Update Token Req | requireToken, tokenAmount, updatedBy, timestamp |
| `ElectionConfigUpdated` | Creator | Update Config | updatedBy, timestamp |
| `ChairpersonTransferred` | Creator | Transfer Chairperson | oldChairperson, newChairperson, timestamp |

### **3. VoterRegistry Events:**

| Event | Actor | Action | Data |
|-------|-------|--------|------|
| `VoterRegistered` | Voter | Register | voterAddress, voterId, timestamp |
| `VoterApproved` | Chairperson | Approve Voter | voterAddress, approver, timestamp |
| `VoterRejected` | Chairperson | Reject Voter | voterAddress, rejector, reason, timestamp |
| `VoterBlocked` | Chairperson | Block Voter | voterAddress, blocker, reason, timestamp |
| `VoterUnblocked` | Chairperson | Unblock Voter | voterAddress, unblocker, timestamp |
| `ChairpersonAdded` | Owner | Add Chairperson | chairperson, addedBy, timestamp |
| `ChairpersonRemoved` | Owner | Remove Chairperson | chairperson, removedBy, timestamp |
| `MinVotingAgeUpdated` | Owner | Update Min Age | oldAge, newAge, updatedBy, timestamp |
| `OwnershipTransferred` | Owner | Transfer Ownership | oldOwner, newOwner, timestamp |

### **4. VotingToken Events:**

| Event | Actor | Action | Data |
|-------|-------|--------|------|
| `Mint` | Minter | Mint Token | to, amount |
| `Burn` | Minter | Burn Token | from, amount |
| `MinterAdded` | Owner | Add Minter | minter, addedBy |
| `MinterRemoved` | Owner | Remove Minter | minter, removedBy |
| `TransferabilityChanged` | Owner | Change Transferable | isTransferable, changedBy |
| `OwnershipTransferred` | Owner | Transfer Ownership | oldOwner, newOwner |

---

## 🔐 PHÂN QUYỀN HIỂN THỊ LOG

### **1. OWNER - Toàn bộ log hệ thống**

**Xem được:**
- ✅ Tất cả events từ ElectionFactory
- ✅ Tất cả events từ tất cả Elections
- ✅ Tất cả events từ VoterRegistry
- ✅ Tất cả events từ VotingToken

**Filter options:**
- Filter theo contract (Factory/Election/Registry/Token)
- Filter theo action type
- Filter theo address (người thực hiện)
- Filter theo time range
- Search theo electionId, voterId, etc.

**UI:**
```
┌─────────────────────────────────────────┐
│ Activity Log - System Overview          │
├─────────────────────────────────────────┤
│ [All Contracts ▼] [All Actions ▼]      │
│ [Time Range] [Search...]                │
├─────────────────────────────────────────┤
│ 📋 ElectionFactory                      │
│   • CreatorAdded by 0x123... (2h ago)  │
│   • SystemPaused by 0x456... (1h ago)   │
│                                          │
│ 📋 Election #1                          │
│   • VoteCast by 0x789... (30m ago)      │
│   • CandidateAdded by 0xabc... (1d ago) │
│                                          │
│ 📋 VoterRegistry                        │
│   • VoterApproved 0xdef... (3h ago)     │
└─────────────────────────────────────────┘
```

---

### **2. CREATOR - Log elections mình tạo + voter logs**

**Xem được:**
- ✅ Events từ ElectionFactory: `ElectionCreated` (chỉ elections mình tạo)
- ✅ Events từ Elections mình tạo:
  - Tất cả events (CandidateAdded, VoteCast, ElectionStarted, etc.)
- ✅ Events từ VoterRegistry: Chỉ voters trong elections mình tạo
- ❌ Events từ VotingToken: Không xem được (trừ khi liên quan đến election mình)

**Logic filter:**
```javascript
// Pseudo-code
const creatorElections = await factory.getElectionsByCreator(creatorAddress);
const creatorElectionAddresses = creatorElections.map(e => e.electionAddress);

// Filter Election events
const electionEvents = await Promise.all(
  creatorElectionAddresses.map(addr => 
    getElectionEvents(addr) // All events from creator's elections
  )
);

// Filter VoterRegistry events
const voterEvents = await getVoterRegistryEvents({
  filter: (event) => {
    // Only voters who voted in creator's elections
    return creatorElectionAddresses.includes(event.electionAddress);
  }
});
```

**UI:**
```
┌─────────────────────────────────────────┐
│ Activity Log - My Elections             │
├─────────────────────────────────────────┤
│ [My Elections ▼] [All Actions ▼]       │
│ [Time Range] [Search...]                │
├─────────────────────────────────────────┤
│ 📋 Election #1: "Presidential 2024"    │
│   • VoteCast by 0x789... (30m ago)      │
│   • CandidateAdded by me (1d ago)        │
│   • ElectionStarted (2d ago)            │
│                                          │
│ 📋 Election #2: "Local Council"         │
│   • VoteCast by 0xabc... (1h ago)       │
│   • VoterRegistered 0xdef... (3h ago)   │
└─────────────────────────────────────────┘
```

---

### **3. VOTER - Log liên quan đến mình + public logs**

**Xem được:**
- ✅ Events liên quan đến mình:
  - `VoteCast` (chính mình vote)
  - `VoterRegistered` (mình đăng ký)
  - `VoterApproved` (mình được approve)
  - `VoterBlocked` (mình bị block)
  - `Mint` (mình được mint token)
  - `Burn` (mình bị burn token)
- ✅ Public events:
  - `ElectionCreated` (tất cả elections)
  - `ElectionStarted` (tất cả elections)
  - `ElectionEnded` (tất cả elections)
  - `CandidateAdded` (tất cả elections)
- ❌ Private events: Không xem được (Creator actions, Owner actions)

**Logic filter:**
```javascript
// Pseudo-code
const voterAddress = currentUser.walletAddress;

// Personal events
const personalEvents = await Promise.all([
  getElectionEvents({ filter: { voter: voterAddress } }), // VoteCast
  getVoterRegistryEvents({ filter: { voterAddress } }), // Registration, Approval
  getVotingTokenEvents({ filter: { to: voterAddress, from: voterAddress } }) // Mint, Burn
]);

// Public events
const publicEvents = await Promise.all([
  getElectionFactoryEvents({ filter: { eventName: 'ElectionCreated' } }),
  getElectionEvents({ filter: { eventName: ['ElectionStarted', 'ElectionEnded', 'CandidateAdded'] } })
]);
```

**UI:**
```
┌─────────────────────────────────────────┐
│ Activity Log - My Activity              │
├─────────────────────────────────────────┤
│ [My Activity ▼] [Public Events ▼]      │
│ [Time Range] [Search...]                │
├─────────────────────────────────────────┤
│ 👤 My Actions                            │
│   • VoteCast in Election #1 (30m ago)   │
│   • VoterApproved (2d ago)               │
│   • TokenMinted 1 VOTE (3d ago)          │
│                                          │
│ 🌐 Public Events                         │
│   • ElectionCreated #2 (1h ago)          │
│   • ElectionStarted #1 (2d ago)          │
│   • CandidateAdded in #1 (3d ago)        │
└─────────────────────────────────────────┘
```

---

## 🏗️ KIẾN TRÚC KỸ THUẬT

### **1. Backend Service: `activityLogService.js`**

```javascript
// backend/services/activityLogService.js

class ActivityLogService {
  /**
   * Get all activity logs for Owner
   */
  async getOwnerLogs(filters = {}) {
    const logs = await Promise.all([
      this.getElectionFactoryLogs(filters),
      this.getAllElectionLogs(filters),
      this.getVoterRegistryLogs(filters),
      this.getVotingTokenLogs(filters)
    ]);
    return this.mergeAndSortLogs(logs);
  }

  /**
   * Get activity logs for Creator
   */
  async getCreatorLogs(creatorAddress, filters = {}) {
    // Get creator's elections
    const creatorElections = await this.getCreatorElections(creatorAddress);
    const electionAddresses = creatorElections.map(e => e.electionAddress);
    
    const logs = await Promise.all([
      this.getElectionFactoryLogs({ 
        filter: { creator: creatorAddress } 
      }),
      this.getElectionLogs(electionAddresses, filters),
      this.getVoterRegistryLogsForElections(electionAddresses, filters)
    ]);
    return this.mergeAndSortLogs(logs);
  }

  /**
   * Get activity logs for Voter
   */
  async getVoterLogs(voterAddress, filters = {}) {
    const logs = await Promise.all([
      this.getPersonalLogs(voterAddress, filters),
      this.getPublicLogs(filters)
    ]);
    return this.mergeAndSortLogs(logs);
  }

  /**
   * Query events from blockchain
   */
  async getElectionFactoryLogs(filters) {
    const factory = getElectionFactoryContract();
    const events = await factory.queryFilter(
      factory.filters.ElectionCreated(),
      filters.fromBlock,
      filters.toBlock
    );
    return this.formatEvents(events, 'ElectionFactory');
  }

  async getElectionLogs(electionAddresses, filters) {
    const logs = [];
    for (const address of electionAddresses) {
      const election = getElectionContract(address);
      const events = await Promise.all([
        election.queryFilter(election.filters.VoteCast(), filters.fromBlock, filters.toBlock),
        election.queryFilter(election.filters.CandidateAdded(), filters.fromBlock, filters.toBlock),
        // ... other events
      ]);
      logs.push(...this.formatEvents(events.flat(), 'Election', address));
    }
    return logs;
  }

  /**
   * Format events to unified log format
   */
  formatEvents(events, contractType, contractAddress = null) {
    return events.map(event => ({
      id: `${event.blockNumber}-${event.logIndex}`,
      contractType, // 'ElectionFactory', 'Election', 'VoterRegistry', 'VotingToken'
      contractAddress,
      eventName: event.event,
      actor: this.getActor(event),
      timestamp: event.args.timestamp || event.blockTimestamp,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      data: this.extractEventData(event),
      action: this.getActionLabel(event.event),
      icon: this.getActionIcon(event.event)
    }));
  }

  getActor(event) {
    // Extract actor address from event
    // Priority: msg.sender fields (creator, addedBy, pausedBy, etc.)
    return event.args.creator || 
           event.args.addedBy || 
           event.args.pausedBy || 
           event.args.voter || 
           event.args.updatedBy || 
           event.transaction.from;
  }

  getActionLabel(eventName) {
    const labels = {
      'ElectionCreated': 'Created Election',
      'VoteCast': 'Voted',
      'CandidateAdded': 'Added Candidate',
      'VoterApproved': 'Approved Voter',
      'Mint': 'Minted Token',
      // ... more mappings
    };
    return labels[eventName] || eventName;
  }
}
```

---

### **2. Backend API Routes: `routes/activityLog.js`**

```javascript
// backend/routes/activityLog.js

router.get('/logs', authenticate, async (req, res) => {
  try {
    const { role, walletAddress } = req.user;
    const { 
      fromBlock, 
      toBlock, 
      contractType, 
      actionType,
      limit = 100,
      offset = 0 
    } = req.query;

    const filters = {
      fromBlock: fromBlock || 0,
      toBlock: toBlock || 'latest',
      contractType,
      actionType,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    let logs;
    switch (role) {
      case 'OWNER':
        logs = await activityLogService.getOwnerLogs(filters);
        break;
      case 'CREATOR':
        logs = await activityLogService.getCreatorLogs(walletAddress, filters);
        break;
      case 'VOTER':
        logs = await activityLogService.getVoterLogs(walletAddress, filters);
        break;
      default:
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Apply pagination
    const paginatedLogs = logs.slice(offset, offset + limit);

    res.json({
      success: true,
      logs: paginatedLogs,
      total: logs.length,
      hasMore: offset + limit < logs.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time updates via WebSocket or polling
router.get('/logs/stream', authenticate, (req, res) => {
  // WebSocket or SSE for real-time updates
});
```

---

### **3. Frontend Service: `services/activityLogService.js`**

```javascript
// frontend/src/services/activityLogService.js

class ActivityLogService {
  async getLogs(filters = {}) {
    const response = await apiService.get('/api/activity-logs/logs', {
      params: filters
    });
    return response.data;
  }

  async getLogsStream(callback) {
    // WebSocket or polling for real-time updates
    const eventSource = new EventSource('/api/activity-logs/logs/stream');
    eventSource.onmessage = (event) => {
      const log = JSON.parse(event.data);
      callback(log);
    };
  }

  formatLog(log) {
    return {
      id: log.id,
      action: log.action,
      actor: this.formatAddress(log.actor),
      timestamp: this.formatTimestamp(log.timestamp),
      details: this.formatDetails(log),
      icon: log.icon,
      contractType: log.contractType
    };
  }

  formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }
}
```

---

### **4. Frontend Component: `ActivityLogPanel.jsx`**

```jsx
// frontend/src/components/ActivityLogPanel.jsx

function ActivityLogPanel() {
  const { user } = useAppStore();
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({
    contractType: 'all',
    actionType: 'all',
    timeRange: '7d'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLogs();
    // Subscribe to real-time updates
    const unsubscribe = activityLogService.getLogsStream((newLog) => {
      setLogs(prev => [newLog, ...prev]);
    });
    return unsubscribe;
  }, [filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await activityLogService.getLogs(filters);
      setLogs(data.logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="activity-log-panel">
      <div className="filters">
        <Select 
          value={filters.contractType}
          onChange={(e) => setFilters({...filters, contractType: e.target.value})}
        >
          <option value="all">All Contracts</option>
          <option value="ElectionFactory">Election Factory</option>
          <option value="Election">Elections</option>
          <option value="VoterRegistry">Voter Registry</option>
          <option value="VotingToken">Voting Token</option>
        </Select>
        
        <Select 
          value={filters.actionType}
          onChange={(e) => setFilters({...filters, actionType: e.target.value})}
        >
          <option value="all">All Actions</option>
          <option value="VoteCast">Votes</option>
          <option value="ElectionCreated">Election Creation</option>
          <option value="CandidateAdded">Candidate Management</option>
          {/* ... more options */}
        </Select>

        <DateRangePicker 
          value={filters.timeRange}
          onChange={(range) => setFilters({...filters, timeRange: range})}
        />
      </div>

      <div className="logs-list">
        {loading ? (
          <LoadingSpinner />
        ) : logs.length === 0 ? (
          <EmptyState message="No activity logs found" />
        ) : (
          logs.map(log => (
            <LogItem key={log.id} log={log} />
          ))
        )}
      </div>
    </div>
  );
}

function LogItem({ log }) {
  return (
    <div className="log-item">
      <div className="log-icon">{log.icon}</div>
      <div className="log-content">
        <div className="log-action">
          <strong>{log.action}</strong>
          {log.contractType === 'Election' && (
            <span className="election-badge">Election #{log.data.electionId}</span>
          )}
        </div>
        <div className="log-actor">
          by <AddressLink address={log.actor} />
          {log.role && <RoleBadge role={log.role} />}
        </div>
        <div className="log-timestamp">{log.timestamp}</div>
        <div className="log-details">{log.details}</div>
      </div>
      <div className="log-actions">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => viewOnBlockExplorer(log.transactionHash)}
        >
          View on Explorer
        </Button>
      </div>
    </div>
  );
}
```

---

## 🎨 UI/UX DESIGN

### **Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ Activity Log Panel                                      │
├─────────────────────────────────────────────────────────┤
│ Filters:                                                │
│ [All Contracts ▼] [All Actions ▼] [Last 7 days ▼]    │
│ [Search...]                                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 📋 ElectionFactory                                      │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🆕 Created Election                                 │ │
│ │    Election #1: "Presidential 2024"                │ │
│ │    by 0x1234...5678 (Creator)                       │ │
│ │    2 hours ago                                      │ │
│ │    [View on Explorer]                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ 📋 Election #1                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ Vote Cast                                        │ │
│ │    Voted for Candidate #2                          │ │
│ │    by 0xabcd...ef01 (Voter)                        │ │
│ │    30 minutes ago                                   │ │
│ │    [View on Explorer]                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Added Candidate                                 │ │
│ │    Candidate: "John Doe" (Party A)                 │ │
│ │    by 0x1234...5678 (Creator)                       │ │
│ │    1 day ago                                        │ │
│ │    [View on Explorer]                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ 📋 VoterRegistry                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ Voter Approved                                   │ │
│ │    Voter: 0xabcd...ef01                             │ │
│ │    by 0x9876...5432 (Chairperson)                   │ │
│ │    2 days ago                                        │ │
│ │    [View on Explorer]                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Load More]                                             │
└─────────────────────────────────────────────────────────┘
```

### **Icons cho Actions:**

| Action | Icon | Color |
|--------|------|-------|
| ElectionCreated | 🆕 | Blue |
| VoteCast | ✅ | Green |
| CandidateAdded | 👤 | Purple |
| VoterApproved | ✅ | Green |
| VoterBlocked | 🚫 | Red |
| SystemPaused | ⏸️ | Orange |
| TokenMinted | 💰 | Gold |
| TokenBurned | 🔥 | Red |

---

## ⚡ TỐI ƯU HÓA

### **1. Caching:**

```javascript
// Cache events by block range
const eventCache = new Map();

async function getCachedEvents(contract, eventFilter, fromBlock, toBlock) {
  const cacheKey = `${contract}-${eventFilter}-${fromBlock}-${toBlock}`;
  if (eventCache.has(cacheKey)) {
    return eventCache.get(cacheKey);
  }
  const events = await contract.queryFilter(eventFilter, fromBlock, toBlock);
  eventCache.set(cacheKey, events);
  return events;
}
```

### **2. Pagination:**

```javascript
// Load logs in chunks
const PAGE_SIZE = 50;

async function loadLogsPage(page = 0) {
  const fromBlock = page * PAGE_SIZE;
  const toBlock = (page + 1) * PAGE_SIZE;
  return await getLogs({ fromBlock, toBlock, limit: PAGE_SIZE });
}
```

### **3. Real-time Updates:**

```javascript
// Poll for new events every 5 seconds
setInterval(async () => {
  const latestBlock = await provider.getBlockNumber();
  const newEvents = await getLogs({ 
    fromBlock: lastCheckedBlock, 
    toBlock: latestBlock 
  });
  if (newEvents.length > 0) {
    updateLogs(newEvents);
    lastCheckedBlock = latestBlock;
  }
}, 5000);
```

---

## 📝 IMPLEMENTATION CHECKLIST

### **Backend:**
- [ ] Create `activityLogService.js`
- [ ] Implement `getOwnerLogs()`
- [ ] Implement `getCreatorLogs()`
- [ ] Implement `getVoterLogs()`
- [ ] Create API route `/api/activity-logs/logs`
- [ ] Add authentication & authorization
- [ ] Add filtering & pagination
- [ ] Add caching mechanism
- [ ] Add real-time updates (WebSocket/SSE)

### **Frontend:**
- [ ] Create `ActivityLogPanel.jsx` component
- [ ] Create `activityLogService.js` service
- [ ] Add filters UI (contract type, action type, time range)
- [ ] Add log item component with icons
- [ ] Add pagination/infinite scroll
- [ ] Add real-time updates
- [ ] Add loading states
- [ ] Add empty states
- [ ] Add error handling

### **Integration:**
- [ ] Add Activity Log Panel to Owner Dashboard
- [ ] Add Activity Log Panel to Creator Dashboard
- [ ] Add Activity Log Panel to Voter Dashboard
- [ ] Test with different roles
- [ ] Test filtering
- [ ] Test real-time updates

---

## 🎯 KẾT LUẬN

**Activity Log Panel** sử dụng blockchain events làm nguồn dữ liệu duy nhất, không lưu database, phân quyền rõ ràng theo role, và hiển thị real-time các hoạt động trong hệ thống.

**Ưu điểm:**
- ✅ Immutable (không thể sửa)
- ✅ Transparent (minh bạch)
- ✅ Real-time (cập nhật ngay)
- ✅ Không tốn storage (dùng blockchain)
- ✅ Phân quyền rõ ràng

---

**Ngày tạo**: 2025-12-14  
**Phiên bản**: 1.0  
**Status**: Design Phase - Chưa implement

