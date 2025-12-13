// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VoterRegistry {
    uint256 public constant REGISTERED_FLAG = 1;
    uint256 public constant VERIFIED_FLAG = 2;
    uint256 public constant APPROVED_FLAG = 4;
    uint256 public constant BLOCKED_FLAG = 8;

    struct Voter {
        address voterAddress;
        string voterId;
        string name;
        uint256 age;
        uint256 status;
        uint256 registrationTime;
        uint256 approvalTime;
        bytes32 kycHash;
    }

    event VoterRegistered(
        address indexed voterAddress,
        string indexed voterId,
        uint256 timestamp
    );

    event VoterApproved(
        address indexed voterAddress,
        address indexed approver,
        uint256 timestamp
    );

    event VoterRejected(
        address indexed voterAddress,
        address indexed rejector,
        string reason,
        uint256 timestamp
    );

    event VoterBlocked(
        address indexed voterAddress,
        address indexed blocker,
        string reason,
        uint256 timestamp
    );

    event VoterUnblocked(
        address indexed voterAddress,
        address indexed unblocker,
        uint256 timestamp
    );

    event ChairpersonAdded(
        address indexed chairperson,
        address indexed addedBy,
        uint256 timestamp
    );

    event ChairpersonRemoved(
        address indexed chairperson,
        address indexed removedBy,
        uint256 timestamp
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner,
        uint256 timestamp
    );

    event MinVotingAgeUpdated(
        uint256 oldAge,
        uint256 newAge,
        address indexed updatedBy,
        uint256 timestamp
    );

    address public owner;
    mapping(address => bool) public chairpersons;

    mapping(address => Voter) public voters;
    mapping(string => address) public voterById;
    address[] public voterAddresses;

    uint256 public totalVoters;
    uint256 public totalApprovedVoters;
    uint256 public totalBlockedVoters;

    uint256 public minVotingAge;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyChairperson() {
        require(chairpersons[msg.sender], "Only chairpersons can perform this action");
        _;
    }

    constructor(uint256 _minVotingAge) {
        require(_minVotingAge > 0, "Minimum voting age must be greater than 0");
        
        owner = msg.sender;
        chairpersons[msg.sender] = true;
        minVotingAge = _minVotingAge;
        totalVoters = 0;
        totalApprovedVoters = 0;
        totalBlockedVoters = 0;
    }

    function _hasFlag(uint256 status, uint256 flag) internal pure returns (bool) {
        return (status & flag) == flag;
    }

    function _addFlag(uint256 status, uint256 flag) internal pure returns (uint256) {
        if (!_hasFlag(status, flag)) {
            return status | flag;
        }
        return status;
    }

    function _removeFlag(uint256 status, uint256 flag) internal pure returns (uint256) {
        if (_hasFlag(status, flag)) {
            return status & ~flag;
        }
        return status;
    }

    function addChairperson(address _chairperson) external onlyOwner {
        require(_chairperson != address(0), "Invalid chairperson address");
        require(!chairpersons[_chairperson], "Already a chairperson");
        
        chairpersons[_chairperson] = true;
        emit ChairpersonAdded(_chairperson, msg.sender, block.timestamp);
    }

    function removeChairperson(address _chairperson) external onlyOwner {
        require(_chairperson != owner, "Cannot remove owner");
        require(chairpersons[_chairperson], "Not a chairperson");
        
        chairpersons[_chairperson] = false;
        emit ChairpersonRemoved(_chairperson, msg.sender, block.timestamp);
    }

    function registerVoter(
        string memory _voterId,
        string memory _name,
        uint256 _age,
        bytes32 _kycHash
    ) external {
        require(voters[msg.sender].voterAddress == address(0), "Voter already registered");
        require(voterById[_voterId] == address(0), "Voter ID already exists");
        require(_age >= minVotingAge, "Below minimum voting age");
        require(bytes(_voterId).length > 0, "Voter ID cannot be empty");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_kycHash != bytes32(0), "KYC hash cannot be empty");
        
        Voter memory newVoter = Voter({
            voterAddress: msg.sender,
            voterId: _voterId,
            name: _name,
            age: _age,
            status: REGISTERED_FLAG,
            registrationTime: block.timestamp,
            approvalTime: 0,
            kycHash: _kycHash
        });
        
        voters[msg.sender] = newVoter;
        voterById[_voterId] = msg.sender;
        voterAddresses.push(msg.sender);
        totalVoters++;
        
        emit VoterRegistered(msg.sender, _voterId, block.timestamp);
    }

    function approveVoter(address _voterAddress) external onlyChairperson {
        require(voters[_voterAddress].voterAddress != address(0), "Voter not registered");
        uint256 status = voters[_voterAddress].status;
        require(!_hasFlag(status, APPROVED_FLAG), "Voter already approved");
        require(!_hasFlag(status, BLOCKED_FLAG), "Cannot approve blocked voter");
        
        uint256 updatedStatus = _addFlag(status, VERIFIED_FLAG);
        updatedStatus = _addFlag(updatedStatus, APPROVED_FLAG);
        voters[_voterAddress].status = updatedStatus;
        voters[_voterAddress].approvalTime = block.timestamp;
        totalApprovedVoters++;
        
        emit VoterApproved(_voterAddress, msg.sender, block.timestamp);
    }

    function rejectVoter(address _voterAddress, string memory _reason) external onlyChairperson {
        require(voters[_voterAddress].voterAddress != address(0), "Voter not registered");
        uint256 status = voters[_voterAddress].status;
        require(!_hasFlag(status, APPROVED_FLAG), "Cannot reject approved voter");
        
        emit VoterRejected(_voterAddress, msg.sender, _reason, block.timestamp);
    }

    function blockVoter(address _voterAddress, string memory _reason) external onlyChairperson {
        require(voters[_voterAddress].voterAddress != address(0), "Voter not registered");
        uint256 status = voters[_voterAddress].status;
        require(!_hasFlag(status, BLOCKED_FLAG), "Voter already blocked");
        
        bool wasApproved = _hasFlag(status, APPROVED_FLAG);
        
        voters[_voterAddress].status = _addFlag(status, BLOCKED_FLAG);
        
        if (wasApproved) {
            totalApprovedVoters--;
        }
        
        totalBlockedVoters++;
        
        emit VoterBlocked(_voterAddress, msg.sender, _reason, block.timestamp);
    }

    function unblockVoter(address _voterAddress) external onlyChairperson {
        require(voters[_voterAddress].voterAddress != address(0), "Voter not registered");
        uint256 status = voters[_voterAddress].status;
        require(_hasFlag(status, BLOCKED_FLAG), "Voter not blocked");
        
        voters[_voterAddress].status = _removeFlag(status, BLOCKED_FLAG);
        
        if (_hasFlag(voters[_voterAddress].status, APPROVED_FLAG)) {
            totalApprovedVoters++;
        }
        
        totalBlockedVoters--;
        
        emit VoterUnblocked(_voterAddress, msg.sender, block.timestamp);
    }

    function isVoterEligible(address _voterAddress) external view returns (bool) {
        Voter memory voter = voters[_voterAddress];
        return (
            voter.voterAddress != address(0) &&
            _hasFlag(voter.status, APPROVED_FLAG) &&
            !_hasFlag(voter.status, BLOCKED_FLAG)
        );
    }

    function getVoterInfo(address _voterAddress) external view returns (Voter memory) {
        require(voters[_voterAddress].voterAddress != address(0), "Voter not found");
        return voters[_voterAddress];
    }

    function getVoterByID(string memory _voterId) external view returns (Voter memory) {
        address voterAddr = voterById[_voterId];
        require(voterAddr != address(0), "Voter ID not found");
        return voters[voterAddr];
    }

    function getAllVoters() external view returns (address[] memory) {
        return voterAddresses;
    }

    function isChairperson(address _address) external view returns (bool) {
        return chairpersons[_address];
    }

    function updateMinVotingAge(uint256 _newAge) external onlyOwner {
        require(_newAge > 0, "Age must be greater than 0");
        
        uint256 oldAge = minVotingAge;
        minVotingAge = _newAge;
        
        emit MinVotingAgeUpdated(oldAge, _newAge, msg.sender, block.timestamp);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner address");
        
        address oldOwner = owner;
        owner = _newOwner;
        chairpersons[_newOwner] = true;
        
        emit OwnershipTransferred(oldOwner, _newOwner, block.timestamp);
    }
}

