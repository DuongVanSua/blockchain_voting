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
    // Custom errors to save gas and reduce contract size
    error OnlyOwner();
    error OnlyCreator();
    error SystemIsPaused();
    error InvalidAddress();
    error InvalidTimeRange();
    error StartTimeNotInFuture();
    error EmptyTitle();
    error EmptyIpfsCid();
    error FailedToDeployElection();
    error AlreadyCreator();
    error NotCreator();
    error AlreadyPaused();
    error NotPaused();
    error InvalidElectionId();
    
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
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyCreator() {
        if (!creators[msg.sender]) revert OnlyCreator();
        _;
    }

    modifier whenNotPaused() {
        if (isPaused) revert SystemIsPaused();
        _;
    }

    constructor(address _voterRegistry, address _votingToken) {
        if (_voterRegistry == address(0)) revert InvalidAddress();
        if (_votingToken == address(0)) revert InvalidAddress();
        
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
        if (_endTime <= _startTime) revert InvalidTimeRange();
        if (_startTime <= block.timestamp) revert StartTimeNotInFuture();
        if (bytes(_title).length == 0) revert EmptyTitle();
        if (bytes(_ipfsCid).length == 0) revert EmptyIpfsCid();
        
        uint256 electionId = totalElections + 1;

        // Generate unique salt for CREATE2 deployment
        // Salt = keccak256(electionId, creator address, timestamp, ipfsCid)
        // This ensures each election gets a unique address even if nonce resets
        bytes32 salt = keccak256(
            abi.encodePacked(
                electionId,
                msg.sender,
                block.timestamp,
                block.prevrandao, // Add block randomness for extra uniqueness
                _ipfsCid
            )
        );

        // Deploy new Election contract using CREATE2 for deterministic but unique addresses
        // CREATE2 formula: address = keccak256(0xff ++ deployer ++ salt ++ keccak256(init_code))[12:]
        bytes memory bytecode = type(Election).creationCode;
        bytes memory constructorArgs = abi.encode(
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
        bytes memory initCode = abi.encodePacked(bytecode, constructorArgs);
        
        // Deploy using CREATE2 via inline assembly
        address electionAddress;
        assembly {
            let ptr := add(initCode, 0x20)
            let length := mload(initCode)
            electionAddress := create2(0, ptr, length, salt)
        }
        
        if (electionAddress == address(0)) revert FailedToDeployElection();
        
        Election newElection = Election(electionAddress);

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
        if (_creator == address(0)) revert InvalidAddress();
        if (creators[_creator]) revert AlreadyCreator();
        
        creators[_creator] = true;
        creatorAddresses.push(_creator);
        
        emit CreatorAdded(_creator, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Remove an election creator
     */
    function removeCreator(address _creator) external onlyOwner {
        if (!creators[_creator]) revert NotCreator();
        if (_creator == owner) revert InvalidAddress(); // Cannot remove owner
        
        creators[_creator] = false;
        
        emit CreatorRemoved(_creator, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Pause the entire system (emergency)
     */
    function pause() external onlyOwner {
        if (isPaused) revert AlreadyPaused();
        isPaused = true;
        emit SystemPaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Unpause the system
     */
    function unpause() external onlyOwner {
        if (!isPaused) revert NotPaused();
        isPaused = false;
        emit SystemUnpaused(msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Deactivate an election
     */
    function deactivateElection(uint256 _electionId) external onlyOwner {
        if (_electionId == 0 || _electionId > totalElections) revert InvalidElectionId();
        if (!elections[_electionId].isActive) revert InvalidElectionId(); // Election already inactive
        
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
        if (_electionId == 0 || _electionId > totalElections) revert InvalidElectionId();
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
        if (_newRegistry == address(0)) revert InvalidAddress();
        
        address oldRegistry = voterRegistry;
        voterRegistry = _newRegistry;
        
        emit VoterRegistryUpdated(oldRegistry, _newRegistry, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Update voting token
     */
    function updateVotingToken(address _newToken) external onlyOwner {
        if (_newToken == address(0)) revert InvalidAddress();
        
        address oldToken = votingToken;
        votingToken = _newToken;
        
        emit VotingTokenUpdated(oldToken, _newToken, msg.sender, block.timestamp);
    }

    /**
     * @notice Owner: Transfer ownership
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidAddress();
        
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
