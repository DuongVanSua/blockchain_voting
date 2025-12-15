const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { getProvider, loadContractABI } = require('../config/blockchain');

/**
 * Load deployment info from smartcontract/deployments/localhost/deployment.json
 */
function loadDeployment() {
  const deploymentPath = path.join(__dirname, '..', '..', 'smartcontract', 'deployments', 'localhost', 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    throw new Error('Deployment file not found. Please deploy contracts first.');
  }
  return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
}

function getContract(address, abi) {
  const provider = getProvider();
  return new ethers.Contract(address, abi, provider);
}

/**
 * Map event name to a user-friendly action + icon
 */
function getActionMeta(eventName) {
  const map = {
    // ElectionFactory
    ElectionCreated: { action: 'Created Election', icon: '🆕' },
    ElectionDeactivated: { action: 'Deactivated Election', icon: '⏹️' },
    CreatorAdded: { action: 'Added Creator', icon: '➕' },
    CreatorRemoved: { action: 'Removed Creator', icon: '➖' },
    SystemPaused: { action: 'Paused System', icon: '⏸️' },
    SystemUnpaused: { action: 'Unpaused System', icon: '▶️' },
    OwnershipTransferred: { action: 'Transfer Ownership', icon: '🔑' },
    VoterRegistryUpdated: { action: 'Update VoterRegistry', icon: '🔄' },
    VotingTokenUpdated: { action: 'Update VotingToken', icon: '🔄' },
    // Election
    ElectionStarted: { action: 'Start Election', icon: '🚀' },
    ElectionPaused: { action: 'Pause Election', icon: '⏸️' },
    ElectionResumed: { action: 'Resume Election', icon: '▶️' },
    ElectionEnded: { action: 'End Election', icon: '⏹️' },
    ElectionFinalized: { action: 'Finalize Election', icon: '🏁' },
    CandidateAdded: { action: 'Add Candidate', icon: '👤' },
    CandidateRemoved: { action: 'Remove Candidate', icon: '🗑️' },
    VoteCast: { action: 'Vote Cast', icon: '✅' },
    VoteVerified: { action: 'Vote Verified', icon: '🔍' },
    ChairpersonTransferred: { action: 'Transfer Chairperson', icon: '🔑' },
    TokenRequirementUpdated: { action: 'Update Token Requirement', icon: '💰' },
    VoterRegistered: { action: 'Register Voter', icon: '📝' },
    VoterRemoved: { action: 'Remove Voter', icon: '🚫' },
    ElectionConfigUpdated: { action: 'Update Election Config', icon: '⚙️' },
    // VoterRegistry
    VoterApproved: { action: 'Approve Voter', icon: '✅' },
    VoterRejected: { action: 'Reject Voter', icon: '❌' },
    VoterBlocked: { action: 'Block Voter', icon: '🚫' },
    VoterUnblocked: { action: 'Unblock Voter', icon: '♻️' },
    ChairpersonAdded: { action: 'Add Chairperson', icon: '➕' },
    ChairpersonRemoved: { action: 'Remove Chairperson', icon: '➖' },
    MinVotingAgeUpdated: { action: 'Update Min Voting Age', icon: '📏' },
    // VotingToken
    Mint: { action: 'Mint Token', icon: '💰' },
    Burn: { action: 'Burn Token', icon: '🔥' },
    MinterAdded: { action: 'Add Minter', icon: '➕' },
    MinterRemoved: { action: 'Remove Minter', icon: '➖' },
    TransferabilityChanged: { action: 'Change Transferability', icon: '🔄' },
  };
  return map[eventName] || { action: eventName, icon: '📄' };
}

function pickActor(args) {
  const candidates = [
    'creator',
    'addedBy',
    'removedBy',
    'pausedBy',
    'unpausedBy',
    'deactivatedBy',
    'updatedBy',
    'voter',
    'voterAddress',
    'approver',
    'rejector',
    'blocker',
    'unblocker',
    'chairperson',
    'previousOwner',
    'newOwner',
    'from',
    'to',
    'minter',
  ];
  for (const key of candidates) {
    if (args[key]) return args[key];
  }
  return null;
}

function toSerializable(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(toSerializable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = toSerializable(v);
    }
    return out;
  }
  return value;
}

function normalizeEvent(event, contractType, contractAddress) {
  const meta = getActionMeta(event.event);
  const safeArgs = toSerializable(event.args || {});
  const actor = pickActor(safeArgs || {});
  const timestamp = safeArgs?.timestamp || safeArgs?.startTime || safeArgs?.endTime || null;
  return {
    id: `${event.blockNumber}-${event.logIndex}`,
    contractType,
    contractAddress,
    eventName: event.event,
    action: meta.action,
    icon: meta.icon,
    actor,
    args: safeArgs,
    blockNumber: Number(event.blockNumber),
    transactionHash: event.transactionHash,
    timestamp,
  };
}

async function queryAll(contract, filters = [], fromBlock, toBlock) {
  const res = [];
  for (const f of filters) {
    const evs = await contract.queryFilter(f, fromBlock, toBlock);
    res.push(...evs);
  }
  return res;
}

function getBlockRange(provider, fromBlock, toBlock) {
  return (async () => {
    const latest = await provider.getBlockNumber();
    const from = fromBlock !== undefined ? fromBlock : Math.max(latest - 5000, 0);
    const to = toBlock !== undefined ? toBlock : latest;
    return { from, to };
  })();
}

async function getOwnerLogs({ fromBlock, toBlock }) {
  const deployment = loadDeployment();
  const provider = getProvider();
  const { from, to } = await getBlockRange(provider, fromBlock, toBlock);

  const logs = [];

  // ElectionFactory
  if (deployment.contracts?.ElectionFactory) {
    const abi = loadContractABI('ElectionFactory');
    const c = getContract(deployment.contracts.ElectionFactory, abi);
    const filters = [
      c.filters.ElectionCreated(),
      c.filters.CreatorAdded(),
      c.filters.CreatorRemoved(),
      c.filters.SystemPaused(),
      c.filters.SystemUnpaused(),
      c.filters.ElectionDeactivated(),
      c.filters.OwnershipTransferred(),
      c.filters.VoterRegistryUpdated(),
      c.filters.VotingTokenUpdated(),
    ];
    const evs = await queryAll(c, filters, from, to);
    logs.push(...evs.map(e => normalizeEvent(e, 'ElectionFactory', c.target)));
  }

  // Elections (need addresses from factory)
  if (deployment.contracts?.ElectionFactory && deployment.contracts?.Election) {
    const factoryAbi = loadContractABI('ElectionFactory');
    const factory = getContract(deployment.contracts.ElectionFactory, factoryAbi);
    const total = Number(await factory.totalElections().catch(() => 0));
    const electionAbi = loadContractABI('Election');
    for (let i = 1; i <= total; i++) {
      const info = await factory.elections(i).catch(() => null);
      if (!info || !info.electionAddress) continue;
      const addr = info.electionAddress;
      const el = getContract(addr, electionAbi);
      const filters = [
        el.filters.ElectionStarted(),
        el.filters.ElectionPaused(),
        el.filters.ElectionResumed(),
        el.filters.ElectionEnded(),
        el.filters.ElectionFinalized(),
        el.filters.CandidateAdded(),
        el.filters.CandidateRemoved(),
        el.filters.VoteCast(),
        el.filters.VoteVerified(),
        el.filters.ChairpersonTransferred(),
        el.filters.TokenRequirementUpdated(),
        el.filters.VoterRegistered(),
        el.filters.VoterRemoved(),
        el.filters.ElectionConfigUpdated(),
      ];
      const evs = await queryAll(el, filters, from, to);
      logs.push(...evs.map(e => normalizeEvent(e, 'Election', addr)));
    }
  }

  // VoterRegistry
  if (deployment.contracts?.VoterRegistry) {
    const abi = loadContractABI('VoterRegistry');
    const c = getContract(deployment.contracts.VoterRegistry, abi);
    const filters = [
      c.filters.VoterRegistered(),
      c.filters.VoterApproved(),
      c.filters.VoterRejected(),
      c.filters.VoterBlocked(),
      c.filters.VoterUnblocked(),
      c.filters.ChairpersonAdded(),
      c.filters.ChairpersonRemoved(),
      c.filters.MinVotingAgeUpdated(),
      c.filters.OwnershipTransferred(),
    ];
    const evs = await queryAll(c, filters, from, to);
    logs.push(...evs.map(e => normalizeEvent(e, 'VoterRegistry', c.target)));
  }

  // VotingToken
  if (deployment.contracts?.VotingToken) {
    const abi = loadContractABI('VotingToken');
    const c = getContract(deployment.contracts.VotingToken, abi);
    const filters = [
      c.filters.Mint(),
      c.filters.Burn(),
      c.filters.MinterAdded(),
      c.filters.MinterRemoved(),
      // Some builds may not emit TransferabilityChanged; guard it
      c.filters.TransferabilityChanged ? c.filters.TransferabilityChanged() : null,
      c.filters.OwnershipTransferred(),
    ].filter(Boolean);
    const evs = await queryAll(c, filters, from, to);
    logs.push(...evs.map(e => normalizeEvent(e, 'VotingToken', c.target)));
  }

  return logs.sort((a, b) => b.blockNumber - a.blockNumber || b.id.localeCompare(a.id));
}

async function getCreatorLogs(creatorAddress, opts = {}) {
  const deployment = loadDeployment();
  const provider = getProvider();
  const { from, to } = await getBlockRange(provider, opts.fromBlock, opts.toBlock);

  const logs = [];
  if (deployment.contracts?.ElectionFactory) {
    const factoryAbi = loadContractABI('ElectionFactory');
    const factory = getContract(deployment.contracts.ElectionFactory, factoryAbi);
    const created = await factory.queryFilter(factory.filters.ElectionCreated(null, null, null, null, creatorAddress), from, to);
    logs.push(...created.map(e => normalizeEvent(e, 'ElectionFactory', factory.target)));

    // collect addresses
    const total = Number(await factory.totalElections().catch(() => 0));
    const electionAbi = loadContractABI('Election');
    for (let i = 1; i <= total; i++) {
      const info = await factory.elections(i).catch(() => null);
      if (!info || info.creator?.toLowerCase() !== creatorAddress.toLowerCase()) continue;
      const addr = info.electionAddress;
      const el = getContract(addr, electionAbi);
      const filters = [
        el.filters.ElectionStarted(),
        el.filters.ElectionPaused(),
        el.filters.ElectionResumed(),
        el.filters.ElectionEnded(),
        el.filters.ElectionFinalized(),
        el.filters.CandidateAdded(),
        el.filters.CandidateRemoved(),
        el.filters.VoteCast(),
        el.filters.VoterRegistered(),
        el.filters.VoterRemoved(),
        el.filters.ElectionConfigUpdated(),
      ];
      const evs = await queryAll(el, filters, from, to);
      logs.push(...evs.map(e => normalizeEvent(e, 'Election', addr)));
    }
  }
  return logs.sort((a, b) => b.blockNumber - a.blockNumber || b.id.localeCompare(a.id));
}

async function getVoterLogs(voterAddress, opts = {}) {
  const deployment = loadDeployment();
  const provider = getProvider();
  const { from, to } = await getBlockRange(provider, opts.fromBlock, opts.toBlock);
  const logs = [];

  // Personal Election events (votes cast by this voter)
  if (deployment.contracts?.ElectionFactory) {
    const factoryAbi = loadContractABI('ElectionFactory');
    const factory = getContract(deployment.contracts.ElectionFactory, factoryAbi);
    const total = Number(await factory.totalElections().catch(() => 0));
    const electionAbi = loadContractABI('Election');
    for (let i = 1; i <= total; i++) {
      const info = await factory.elections(i).catch(() => null);
      if (!info) continue;
      const addr = info.electionAddress;
      const el = getContract(addr, electionAbi);
      // Only get VoteCast events for this voter
      const evs = await el.queryFilter(el.filters.VoteCast(voterAddress), from, to);
      logs.push(...evs.map(e => normalizeEvent(e, 'Election', addr)));
    }
  }

  // Registry events about voter (registration, approval, rejection, blocking)
  if (deployment.contracts?.VoterRegistry) {
    const abi = loadContractABI('VoterRegistry');
    const c = getContract(deployment.contracts.VoterRegistry, abi);
    const filters = [
      c.filters.VoterRegistered(voterAddress),
      c.filters.VoterApproved(voterAddress),
      c.filters.VoterRejected(voterAddress),
      c.filters.VoterBlocked(voterAddress),
      c.filters.VoterUnblocked(voterAddress),
    ];
    const evs = await queryAll(c, filters, from, to);
    logs.push(...evs.map(e => normalizeEvent(e, 'VoterRegistry', c.target)));
  }

  // Public events (ElectionCreated, ElectionStarted - visible to all voters)
  if (deployment.contracts?.ElectionFactory) {
    const abi = loadContractABI('ElectionFactory');
    const factory = getContract(deployment.contracts.ElectionFactory, abi);
    // Public: ElectionCreated
    const publicEvs = await factory.queryFilter(factory.filters.ElectionCreated(), from, to);
    logs.push(...publicEvs.map(e => normalizeEvent(e, 'ElectionFactory', factory.target)));
  }

  // Public Election events (ElectionStarted - visible to all voters)
  if (deployment.contracts?.ElectionFactory) {
    const factoryAbi = loadContractABI('ElectionFactory');
    const factory = getContract(deployment.contracts.ElectionFactory, factoryAbi);
    const total = Number(await factory.totalElections().catch(() => 0));
    const electionAbi = loadContractABI('Election');
    for (let i = 1; i <= total; i++) {
      const info = await factory.elections(i).catch(() => null);
      if (!info) continue;
      const addr = info.electionAddress;
      const el = getContract(addr, electionAbi);
      // Public events: ElectionStarted
      const publicEvs = await el.queryFilter(el.filters.ElectionStarted(), from, to);
      logs.push(...publicEvs.map(e => normalizeEvent(e, 'Election', addr)));
    }
  }

  return logs.sort((a, b) => b.blockNumber - a.blockNumber || b.id.localeCompare(a.id));
}

module.exports = {
  getOwnerLogs,
  getCreatorLogs,
  getVoterLogs,
};

