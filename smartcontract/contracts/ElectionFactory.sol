// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Election.sol";

interface IElection {
    function electionId() external view returns (uint256);
    function title() external view returns (string memory);
    function state() external view returns (uint8);
    function chairperson() external view returns (address);
    function totalVotes() external view returns (uint256);
    function getElectionInfo() external view returns (
        uint256,
        string memory,
        string memory,
        string memory,
        uint256,
        uint256,
        uint8,
        uint256,
        uint256
    );
    function transferChairperson(address _newChairperson) external;
}

/**
 * @title ElectionFactory
 * @notice Manages election creation with Role-Based Access Control (RBAC)
 * Roles:
 * - OWNER: Deployer, can add/remove creators, pause/unpause system
 * - CREATOR: Can create elections, manage their own elections
 * - VOTER: Can register and vote in elections
 */
contract ElectionFactory {
    struct ElectionInfo {
        address electionAddress;
        uint256 electionId;
        string title;
        address creator;
        uint256 creationTime;
        bool isActive;
        string ipfsCid; // IPFS CID for election metadata
    }

    event ElectionCreated(
        uint256 indexed electionId,
        address indexed electionAddress,
        string title,
        string ipfsCid,
        address indexed creator,
        uint256 timestamp
    );

    event ElectionDeactivated(
        uint256 indexed electionId,
        address indexed electionAddress,
        address indexed deactivatedBy,
        uint256 timestamp
    );

    event CreatorAdded(
        address indexed creator,
        address indexed addedBy,
        uint256 timestamp
    );

    event CreatorRemoved(
        address indexed creator,
        address indexed removedBy,
        uint256 timestamp
    );

    event SystemPaused(
        address indexed pausedBy,
        uint256 timestamp
    );

    event SystemUnpaused(
        address indexed unpausedBy,
        uint256 timestamp
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );

    event VoterRegistryUpdated(
        address indexed oldRegistry,
        address indexed newRegistry,
        address indexed updatedBy,
        uint256 timestamp
    );

    event VotingTokenUpdated(
        address indexed oldToken,
        address indexed newToken,
        address indexed updatedBy,
        uint256 timestamp
    );

    address public owner;
    address public voterRegistry;
    address public votingToken;
    
    bool public isPaused; // System-wide pause
    mapping(address => bool) public creators; // Election creators
    mapping(uint256 => ElectionInfo) public elections;
    mapping(address => uint256[]) public electionsByCreator; // creator => electionIds
    mapping(address => bool) public isElection;
    
    address[] public electionAddresses;
    address[] public creatorAddresses;
    uint256 public totalElections;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyCreator() {
        require(creators[msg.sender], "Only creators can perform this action");
        _;
    }

    modifier whenNotPaused() {
        require(!isPaused, "System is paused");
        _;
    }

    constructor(address _voterRegistry, address _votingToken) {
        require(_voterRegistry != address(0), "Invalid voter registry");
        require(_votingToken != address(0), "Invalid voting token");
        
        owner = msg.sender;
        creators[msg.sender] = true; // Owner is also a creator by default
        voterRegistry = _voterRegistry;
        votingToken = _votingToken;
        totalElections = 0;
        isPaused = false;
    }

    /**
     * @notice Create a new election (only creators)
     * @param _title Election title
     * @param _description Election description
     * @param _electionType Type of election (PRESIDENTIAL, PARLIAMENTARY, LOCAL, REFERENDUM)
     * @param _startTime Start timestamp
     * @param _endTime End timestamp
     * @param _allowRealtimeResults Whether to allow realtime results
     * @param _ipfsCid IPFS CID for election metadata
     * @return electionAddress Address of deployed election contract
     */
    function createElection(
        string memory _title,
        string memory _description,
        string memory _electionType,
        uint256 _startTime,
        uint256 _endTime,
        bool _allowRealtimeResults,
        string memory _ipfsCid
    ) external onlyCreator whenNotPaused returns (address) {
        require(_endTime > _startTime, "End time must be after start time");
        require(_startTime > block.timestamp, "Start time must be in future");
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_ipfsCid).length > 0, "IPFS CID cannot be empty");
        
        uint256 electionId = totalElections + 1;

        // Deploy new Election contract
        Election newElection = new Election(
            electionId,
            _title,
            _description,
            _electionType,
            voterRegistry,
            votingToken,
            _startTime,
            _endTime,
            _allowRealtimeResults,
            _ipfsCid
        );

        address electionAddress = address(newElection);
        require(electionAddress != address(0), "Failed to deploy election contract");

        // Transfer chairperson to the creator
        newElection.transferChairperson(msg.sender);
        
        ElectionInfo memory electionInfo = ElectionInfo({
            electionAddress: electionAddress,
            electionId: electionId,
            title: _title,
            creator: msg.sender,
            creationTime: block.timestamp,
            isActive: true,
            ipfsCid: _ipfsCid
        });
        
        elections[electionId] = electionInfo;
        electionAddresses.push(electionAddress);
        electionsByCreator[msg.sender].push(electionId);
        isElection[electionAddress] = true;
        totalElections++;
        
        emit ElectionCreated(electionId, electionAddress, _title, _ipfsCid, msg.sender, block.timestamp);
        
        return electionAddress;
    }

    /**
     * @notice Owner: Add a new election creator
     */
    function addCreator(address _creator) external onlyOwner {
        require(_creator != address(0), "Invalid creator address");
        require(!creators[_creator], "Already a creator");
        
        creators[_creator] = true;
        creatorAddresses.push(_creator);
        
        emit CreatorAdded(_creator, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Remove an election creator
     */
    function removeCreator(address _creator) external onlyOwner {
        require(creators[_creator], "Not a creator");
        require(_creator != owner, "Cannot remove owner");
        
        creators[_creator] = false;
        
        emit CreatorRemoved(_creator, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Pause the entire system (emergency)
     */
    function pause() external onlyOwner {
        require(!isPaused, "System already paused");
        isPaused = true;
        emit SystemPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Unpause the system
     */
    function unpause() external onlyOwner {
        require(isPaused, "System not paused");
        isPaused = false;
        emit SystemUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Deactivate an election
     */
    function deactivateElection(uint256 _electionId) external onlyOwner {
        require(_electionId > 0 && _electionId <= totalElections, "Invalid election ID");
        require(elections[_electionId].isActive, "Election already inactive");
        
        elections[_electionId].isActive = false;
        address electionAddress = elections[_electionId].electionAddress;
        
        emit ElectionDeactivated(_electionId, electionAddress, msg.sender, block.timestamp);
    }

    /**
     * @notice Check if address is owner
     */
    function isOwner(address _address) external view returns (bool) {
        return _address == owner;
    }

    /**
     * @notice Check if address is creator
     */
    function isCreator(address _address) external view returns (bool) {
        return creators[_address];
    }

    /**
     * @notice Get election info
     */
    function getElection(uint256 _electionId) external view returns (ElectionInfo memory) {
        require(_electionId > 0 && _electionId <= totalElections, "Invalid election ID");
        return elections[_electionId];
    }

    /**
     * @notice Get all elections
     */
    function getAllElections() external view returns (ElectionInfo[] memory) {
        ElectionInfo[] memory result = new ElectionInfo[](totalElections);
        for (uint256 i = 1; i <= totalElections; i++) {
            result[i - 1] = elections[i];
        }
        return result;
    }

    /**
     * @notice Get active elections
     */
    function getActiveElections() external view returns (ElectionInfo[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= totalElections; i++) {
            if (elections[i].isActive) {
                activeCount++;
            }
        }
        
        ElectionInfo[] memory result = new ElectionInfo[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= totalElections; i++) {
            if (elections[i].isActive) {
                result[index] = elections[i];
                index++;
            }
        }
        return result;
    }

    /**
     * @notice Get elections by creator
     */
    function getElectionsByCreator(address _creator) external view returns (ElectionInfo[] memory) {
        uint256[] memory creatorElectionIds = electionsByCreator[_creator];
        ElectionInfo[] memory result = new ElectionInfo[](creatorElectionIds.length);
        
        for (uint256 i = 0; i < creatorElectionIds.length; i++) {
            result[i] = elections[creatorElectionIds[i]];
        }
        return result;
    }

    /**
     * @notice Check if address is an election contract
     */
    function isElectionContract(address _address) external view returns (bool) {
        return isElection[_address];
    }

    /**
     * @notice Owner: Update voter registry
     */
    function updateVoterRegistry(address _newRegistry) external onlyOwner {
        require(_newRegistry != address(0), "Invalid address");
        
        address oldRegistry = voterRegistry;
        voterRegistry = _newRegistry;
        
        emit VoterRegistryUpdated(oldRegistry, _newRegistry, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Update voting token
     */
    function updateVotingToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Invalid address");
        
        address oldToken = votingToken;
        votingToken = _newToken;
        
        emit VotingTokenUpdated(oldToken, _newToken, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Transfer ownership
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        
        address oldOwner = owner;
        owner = _newOwner;
        
        emit OwnershipTransferred(oldOwner, _newOwner, block.timestamp);
    }

    /**
     * @notice Get all creator addresses
     */
    function getAllCreators() external view returns (address[] memory) {
        return creatorAddresses;
    }
}
