// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVoterRegistry {
    function isVoterEligible(address _voter) external view returns (bool);
}

interface IVotingToken {
    function balanceOf(address _owner) external view returns (uint256);
    function mint(address _to, uint256 _amount) external;
    function burn(address _from, uint256 _amount) external;
}

// EIP-712 Domain Separator for signature verification
library EIP712 {
    bytes32 public constant VOTE_TYPEHASH = keccak256(
        "VoteIntent(uint256 electionId,uint256 candidateId,address voterAddress,uint256 nonce,uint256 deadline,uint256 chainId,address contractAddress)"
    );

    function getDomainSeparator(address contractAddress, uint256 chainId) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("Election"),
                keccak256("1"),
                chainId,
                contractAddress
            )
        );
    }

    function hashVoteIntent(
        uint256 electionId,
        uint256 candidateId,
        address voterAddress,
        uint256 nonce,
        uint256 deadline,
        uint256 chainId,
        address contractAddress
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                VOTE_TYPEHASH,
                electionId,
                candidateId,
                voterAddress,
                nonce,
                deadline,
                chainId,
                contractAddress
            )
        );
    }
}

contract Election {
    enum ElectionState {
        CREATED,
        ONGOING,
        PAUSED,
        ENDED,
        FINALIZED
    }

    struct Candidate {
        uint256 candidateId;
        string name;
        string party;
        uint256 age;
        string manifesto;
        bytes32 imageHash;
        uint256 voteCount;
        bool isActive;
    }

    struct Vote {
        address voter;
        uint256 candidateId;
        uint256 timestamp;
        bytes32 voteHash;
        bool isValid;
    }

    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        address indexed creator,
        uint256 timestamp
    );

    event ElectionStarted(
        uint256 indexed electionId,
        uint256 startTime
    );

    event ElectionPaused(
        uint256 indexed electionId,
        address indexed pausedBy,
        uint256 timestamp
    );

    event ElectionResumed(
        uint256 indexed electionId,
        address indexed resumedBy,
        uint256 timestamp
    );

    event ElectionEnded(
        uint256 indexed electionId,
        uint256 endTime
    );

    event ElectionFinalized(
        uint256 indexed electionId,
        uint256 winnerId,
        uint256 totalVotes,
        uint256 timestamp
    );

    event CandidateAdded(
        uint256 indexed candidateId,
        string name,
        string party,
        address indexed addedBy
    );

    event CandidateRemoved(
        uint256 indexed candidateId,
        string name,
        address indexed removedBy
    );

    event VoteCast(
        address indexed voter,
        uint256 indexed candidateId,
        uint256 timestamp,
        bytes32 voteHash
    );

    event VoteVerified(
        address indexed voter,
        bytes32 voteHash,
        bool isValid
    );

    event ChairpersonTransferred(
        address indexed previousChairperson,
        address indexed newChairperson,
        uint256 timestamp
    );

    event TokenRequirementUpdated(
        bool requireToken,
        uint256 tokenAmount,
        address indexed updatedBy,
        uint256 timestamp
    );

    event VoterRegistered(
        address indexed voter,
        address indexed registeredBy,
        uint256 timestamp
    );

    event VoterRemoved(
        address indexed voter,
        address indexed removedBy,
        uint256 timestamp
    );

    event ElectionConfigUpdated(
        address indexed updatedBy,
        uint256 timestamp
    );

    uint256 public electionId;
    string public title;
    string public description;
    string public electionType;
    string public ipfsCid; // IPFS CID for election metadata

    address public chairperson;
    address public voterRegistry;
    address public votingToken;

    uint256 public startTime;
    uint256 public endTime;
    ElectionState public state;

    bool public isPublic; // true = public (anyone can register), false = private (creator adds voters)
    mapping(address => bool) public isVoter; // Registered voters (for private elections)
    mapping(uint256 => Candidate) public candidates;
    uint256[] public candidateIds;
    uint256 public totalCandidates;

    mapping(address => Vote) public votes;
    mapping(address => bool) public hasVoted;
    mapping(address => uint256) public nonces; // Nonce for each voter to prevent replay attacks
    uint256 public totalVotes;

    uint256 public winnerId;
    uint256 public winnerVoteCount;

    bool public allowRealtimeResults;
    bool public requireToken;
    uint256 public votingTokenAmount;

    modifier onlyChairperson() {
        require(msg.sender == chairperson, "Only chairperson can perform this action");
        _;
    }

    modifier onlyElectionCreator() {
        require(msg.sender == chairperson, "Only election creator can perform this action");
        _;
    }

    constructor(
        uint256 _electionId,
        string memory _title,
        string memory _description,
        string memory _electionType,
        address _voterRegistry,
        address _votingToken,
        uint256 _startTime,
        uint256 _endTime,
        bool _allowRealtimeResults,
        string memory _ipfsCid
    ) {
        require(_endTime > _startTime, "End time must be after start time");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_voterRegistry != address(0), "Invalid voter registry address");
        require(_votingToken != address(0), "Invalid voting token address");
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_ipfsCid).length > 0, "IPFS CID cannot be empty");
        
        electionId = _electionId;
        title = _title;
        description = _description;
        electionType = _electionType;
        ipfsCid = _ipfsCid;
        chairperson = msg.sender;
        voterRegistry = _voterRegistry;
        votingToken = _votingToken;
        startTime = _startTime;
        endTime = _endTime;
        state = ElectionState.CREATED;
        totalCandidates = 0;
        totalVotes = 0;
        allowRealtimeResults = _allowRealtimeResults;
        requireToken = true;
        votingTokenAmount = 1 ether;
        winnerId = 0;
        winnerVoteCount = 0;
        isPublic = true; // Default to public election
        
        emit ElectionCreated(_electionId, _title, msg.sender, block.timestamp);
    }

    function addCandidate(
        string memory _name,
        string memory _party,
        uint256 _age,
        string memory _manifesto,
        bytes32 _imageHash
    ) external onlyChairperson {
        require(state == ElectionState.CREATED, "Can only add candidates before election starts");
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        require(_age >= 18, "Candidate must be at least 18 years old");
        
        uint256 candidateId = totalCandidates + 1;
        
        candidates[candidateId] = Candidate({
            candidateId: candidateId,
            name: _name,
            party: _party,
            age: _age,
            manifesto: _manifesto,
            imageHash: _imageHash,
            voteCount: 0,
            isActive: true
        });
        
        candidateIds.push(candidateId);
        totalCandidates++;
        
        emit CandidateAdded(candidateId, _name, _party, msg.sender);
    }

    function removeCandidate(uint256 _candidateId) external onlyChairperson {
        require(state == ElectionState.CREATED, "Can only remove candidates before election starts");
        require(_candidateId > 0 && _candidateId <= totalCandidates, "Invalid candidate ID");
        require(candidates[_candidateId].isActive, "Candidate already removed");
        
        candidates[_candidateId].isActive = false;
        
        emit CandidateRemoved(_candidateId, candidates[_candidateId].name, msg.sender);
    }

    /**
     * @notice Manually start election (OPTIONAL - election will auto-start at startTime)
     * @dev This function is optional. Election will automatically start when startTime is reached.
     * Creator can call this to start early if needed, but it's not required.
     * When a voter tries to vote and startTime has been reached, election will auto-start.
     */
    function startElection() external onlyChairperson {
        require(state == ElectionState.CREATED, "Election already started");
        require(block.timestamp >= startTime, "Cannot start before scheduled time");
        require(totalCandidates >= 2, "Need at least 2 candidates");
        
        uint256 activeCount = 0;
        for (uint256 i = 0; i < candidateIds.length; i++) {
            if (candidates[candidateIds[i]].isActive) {
                activeCount++;
            }
        }
        
        require(activeCount >= 2, "Need at least 2 active candidates");
        
        state = ElectionState.ONGOING;
        
        emit ElectionStarted(electionId, block.timestamp);
    }

    function pauseElection() external onlyChairperson {
        require(state == ElectionState.ONGOING, "Election not ongoing");
        
        state = ElectionState.PAUSED;
        
        emit ElectionPaused(electionId, msg.sender, block.timestamp);
    }

    function resumeElection() external onlyChairperson {
        require(state == ElectionState.PAUSED, "Election not paused");
        require(block.timestamp < endTime, "Election time has ended");
        
        state = ElectionState.ONGOING;
        
        emit ElectionResumed(electionId, msg.sender, block.timestamp);
    }

    function endElection() external {
        require(
            msg.sender == chairperson || block.timestamp >= endTime,
            "Cannot end election yet"
        );
        require(
            state == ElectionState.ONGOING || state == ElectionState.PAUSED,
            "Election not active"
        );
        
        state = ElectionState.ENDED;
        
        emit ElectionEnded(electionId, block.timestamp);
    }

    /**
     * @notice Check and auto-start/end election based on time
     * @dev Can be called by anyone to update election state based on current time
     * Auto-starts election when startTime is reached (if still in CREATED state)
     * Auto-ends election when endTime is reached
     */
    function checkAndEndElection() external {
        // Auto-start if startTime reached and still in CREATED state
        if (state == ElectionState.CREATED && block.timestamp >= startTime) {
            require(totalCandidates >= 2, "Need at least 2 candidates");
            
            uint256 activeCount = 0;
            for (uint256 i = 0; i < candidateIds.length; i++) {
                if (candidates[candidateIds[i]].isActive) {
                    activeCount++;
                }
            }
            require(activeCount >= 2, "Need at least 2 active candidates");
            
            state = ElectionState.ONGOING;
            emit ElectionStarted(electionId, block.timestamp);
        }
        
        // Auto-end if endTime reached
        if (block.timestamp >= endTime) {
            if (state == ElectionState.ONGOING || state == ElectionState.PAUSED) {
                state = ElectionState.ENDED;
                emit ElectionEnded(electionId, block.timestamp);
            }
        }
    }

    function vote(uint256 _candidateId, bytes32 _voteHash) external {
        // Auto-start election if startTime has been reached
        if (state == ElectionState.CREATED && block.timestamp >= startTime) {
            require(totalCandidates >= 2, "Need at least 2 candidates");
            
            uint256 activeCount = 0;
            for (uint256 i = 0; i < candidateIds.length; i++) {
                if (candidates[candidateIds[i]].isActive) {
                    activeCount++;
                }
            }
            require(activeCount >= 2, "Need at least 2 active candidates");
            
            state = ElectionState.ONGOING;
            emit ElectionStarted(electionId, block.timestamp);
        }
        
        // Auto-end election if endTime has been reached
        if (block.timestamp >= endTime && (state == ElectionState.ONGOING || state == ElectionState.PAUSED)) {
            state = ElectionState.ENDED;
            emit ElectionEnded(electionId, block.timestamp);
        }
        
        require(state == ElectionState.ONGOING, "Election not ongoing");
        require(block.timestamp >= startTime, "Election not started");
        require(block.timestamp < endTime, "Election ended");
        require(!hasVoted[msg.sender], "Already voted");
        require(_candidateId > 0 && _candidateId <= totalCandidates, "Invalid candidate ID");
        require(candidates[_candidateId].isActive, "Candidate not active");
        require(_voteHash != bytes32(0), "Vote hash cannot be empty");
        
        // Check eligibility: public elections use voter registry, private elections check isVoter
        if (isPublic) {
            bool isEligible = IVoterRegistry(voterRegistry).isVoterEligible(msg.sender);
            require(isEligible, "Voter not eligible");
        } else {
            require(isVoter[msg.sender], "Voter not registered for this private election");
        }
        
        if (requireToken) {
            uint256 tokenBalance = IVotingToken(votingToken).balanceOf(msg.sender);
            require(tokenBalance >= votingTokenAmount, "Insufficient voting tokens");
            
            IVotingToken(votingToken).burn(msg.sender, votingTokenAmount);
        }
        
        votes[msg.sender] = Vote({
            voter: msg.sender,
            candidateId: _candidateId,
            timestamp: block.timestamp,
            voteHash: _voteHash,
            isValid: true
        });
        
        hasVoted[msg.sender] = true;
        candidates[_candidateId].voteCount++;
        totalVotes++;
        
        emit VoteCast(msg.sender, _candidateId, block.timestamp, _voteHash);
    }

    // Gasless voting via relayer with EIP-712 signature verification
    function relayVote(
        uint256 _candidateId,
        address _voterAddress,
        uint256 _nonce,
        uint256 _deadline,
        bytes32 _voteHash,
        bytes memory _signature
    ) external {
        // Auto-start election if startTime has been reached
        if (state == ElectionState.CREATED && block.timestamp >= startTime) {
            require(totalCandidates >= 2, "Need at least 2 candidates");
            
            uint256 activeCount = 0;
            for (uint256 i = 0; i < candidateIds.length; i++) {
                if (candidates[candidateIds[i]].isActive) {
                    activeCount++;
                }
            }
            require(activeCount >= 2, "Need at least 2 active candidates");
            
            state = ElectionState.ONGOING;
            emit ElectionStarted(electionId, block.timestamp);
        }
        
        // Auto-end election if endTime has been reached
        if (block.timestamp >= endTime && (state == ElectionState.ONGOING || state == ElectionState.PAUSED)) {
            state = ElectionState.ENDED;
            emit ElectionEnded(electionId, block.timestamp);
        }
        
        require(state == ElectionState.ONGOING, "Election not ongoing");
        require(block.timestamp >= startTime, "Election not started");
        require(block.timestamp < endTime, "Election ended");
        require(block.timestamp <= _deadline, "Signature expired");
        require(!hasVoted[_voterAddress], "Already voted");
        require(_candidateId > 0 && _candidateId <= totalCandidates, "Invalid candidate ID");
        require(candidates[_candidateId].isActive, "Candidate not active");
        require(_voteHash != bytes32(0), "Vote hash cannot be empty");
        require(nonces[_voterAddress] == _nonce, "Invalid nonce");
        
        // Check eligibility: public elections use voter registry, private elections check isVoter
        if (isPublic) {
            bool isEligible = IVoterRegistry(voterRegistry).isVoterEligible(_voterAddress);
            require(isEligible, "Voter not eligible");
        } else {
            require(isVoter[_voterAddress], "Voter not registered for this private election");
        }
        
        // Verify EIP-712 signature
        uint256 chainId = block.chainid;
        bytes32 domainSeparator = EIP712.getDomainSeparator(address(this), chainId);
        bytes32 structHash = EIP712.hashVoteIntent(
            electionId,
            _candidateId,
            _voterAddress,
            _nonce,
            _deadline,
            chainId,
            address(this)
        );
        bytes32 hash = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        
        address signer = recoverSigner(hash, _signature);
        require(signer == _voterAddress, "Invalid signature");
        
        // Increment nonce to prevent replay
        nonces[_voterAddress]++;
        
        if (requireToken) {
            uint256 tokenBalance = IVotingToken(votingToken).balanceOf(_voterAddress);
            require(tokenBalance >= votingTokenAmount, "Insufficient voting tokens");
            
            IVotingToken(votingToken).burn(_voterAddress, votingTokenAmount);
        }
        
        votes[_voterAddress] = Vote({
            voter: _voterAddress,
            candidateId: _candidateId,
            timestamp: block.timestamp,
            voteHash: _voteHash,
            isValid: true
        });
        
        hasVoted[_voterAddress] = true;
        candidates[_candidateId].voteCount++;
        totalVotes++;
        
        emit VoteCast(_voterAddress, _candidateId, block.timestamp, _voteHash);
    }

    // Helper function to recover signer from signature
    function recoverSigner(bytes32 _hash, bytes memory _signature) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature v value");
        
        return ecrecover(_hash, v, r, s);
    }

    function finalizeElection() external onlyChairperson {
        require(state == ElectionState.ENDED, "Election must be ended first");
        
        uint256 maxVotes = 0;
        uint256 winner = 0;
        
        for (uint256 i = 0; i < candidateIds.length; i++) {
            uint256 id = candidateIds[i];
            if (candidates[id].isActive) {
                if (candidates[id].voteCount > maxVotes) {
                    maxVotes = candidates[id].voteCount;
                    winner = id;
                }
            }
        }
        
        winnerId = winner;
        winnerVoteCount = maxVotes;
        state = ElectionState.FINALIZED;
        
        emit ElectionFinalized(electionId, winner, totalVotes, block.timestamp);
    }

    function getCandidate(uint256 _candidateId) external view returns (Candidate memory) {
        require(_candidateId > 0 && _candidateId <= totalCandidates, "Invalid candidate ID");
        return candidates[_candidateId];
    }

    function getAllCandidates() external view returns (Candidate[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < candidateIds.length; i++) {
            if (candidates[candidateIds[i]].isActive) {
                activeCount++;
            }
        }
        
        Candidate[] memory result = new Candidate[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < candidateIds.length; i++) {
            if (candidates[candidateIds[i]].isActive) {
                result[index] = candidates[candidateIds[i]];
                index++;
            }
        }
        return result;
    }

    function getResults() external view returns (Candidate[] memory) {
        if (!allowRealtimeResults) {
            require(
                state == ElectionState.ENDED || state == ElectionState.FINALIZED,
                "Results not available yet"
            );
        }
        
        uint256 activeCount = 0;
        for (uint256 i = 0; i < candidateIds.length; i++) {
            if (candidates[candidateIds[i]].isActive) {
                activeCount++;
            }
        }
        
        Candidate[] memory result = new Candidate[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < candidateIds.length; i++) {
            if (candidates[candidateIds[i]].isActive) {
                result[index] = candidates[candidateIds[i]];
                index++;
            }
        }
        return result;
    }

    function getWinner() external view returns (Candidate memory) {
        require(state == ElectionState.FINALIZED, "Election not finalized");
        require(winnerId > 0, "No winner determined");
        return candidates[winnerId];
    }

    function hasVoterVoted(address _voter) external view returns (bool) {
        return hasVoted[_voter];
    }

    function getVoteReceipt(address _voter) external view returns (Vote memory) {
        require(hasVoted[_voter], "Voter has not voted");
        return votes[_voter];
    }

    function verifyVote(address _voter, bytes32 _voteHash) external view returns (bool) {
        require(hasVoted[_voter], "Voter has not voted");
        Vote memory voteData = votes[_voter];
        return voteData.voteHash == _voteHash && voteData.isValid;
    }

    function getElectionInfo() external view returns (
        uint256,
        string memory,
        string memory,
        string memory,
        uint256,
        uint256,
        ElectionState,
        uint256,
        uint256
    ) {
        return (
            electionId,
            title,
            description,
            electionType,
            startTime,
            endTime,
            state,
            totalCandidates,
            totalVotes
        );
    }

    function updateElectionTimes(uint256 _startTime, uint256 _endTime) external onlyChairperson {
        require(state == ElectionState.CREATED, "Can only update before election starts");
        require(_endTime > _startTime, "End time must be after start time");
        require(_startTime > block.timestamp, "Start time must be in future");
        
        startTime = _startTime;
        endTime = _endTime;
    }

    function configureTokenRequirement(bool _requireToken, uint256 _tokenAmount) external onlyChairperson {
        require(state == ElectionState.CREATED, "Can only configure before start");
        if (_requireToken) {
            require(_tokenAmount > 0, "Token amount must be greater than 0");
        }
        
        requireToken = _requireToken;
        votingTokenAmount = _tokenAmount;
        
        emit TokenRequirementUpdated(_requireToken, _tokenAmount, msg.sender, block.timestamp);
    }

    function transferChairperson(address _newChairperson) external onlyChairperson {
        require(_newChairperson != address(0), "Invalid address");
        
        address oldChairperson = chairperson;
        chairperson = _newChairperson;
        
        emit ChairpersonTransferred(oldChairperson, _newChairperson, block.timestamp);
    }

    /**
     * @notice Creator: Update election configuration (only before start)
     */
    function updateElectionConfig(
        bool _isPublic,
        bool _requireToken,
        uint256 _tokenAmount
    ) external onlyElectionCreator {
        require(state == ElectionState.CREATED, "Can only update before election starts");
        
        isPublic = _isPublic;
        requireToken = _requireToken;
        if (_requireToken) {
            require(_tokenAmount > 0, "Token amount must be greater than 0");
            votingTokenAmount = _tokenAmount;
        }
        
        emit ElectionConfigUpdated(msg.sender, block.timestamp);
    }

    /**
     * @notice Initialize election with config and candidates in one transaction
     * @param _isPublic Whether election is public
     * @param _requireToken Whether token is required to vote
     * @param _tokenAmount Token amount required (if requireToken is true)
     * @param _candidateNames Array of candidate names
     * @param _candidateParties Array of candidate parties
     * @param _candidateAges Array of candidate ages
     * @param _candidateManifestos Array of candidate manifestos
     * @param _candidateImageHashes Array of candidate image hashes
     */
    function initializeElectionWithCandidates(
        bool _isPublic,
        bool _requireToken,
        uint256 _tokenAmount,
        string[] memory _candidateNames,
        string[] memory _candidateParties,
        uint256[] memory _candidateAges,
        string[] memory _candidateManifestos,
        bytes32[] memory _candidateImageHashes
    ) external onlyElectionCreator {
        require(state == ElectionState.CREATED, "Can only initialize before election starts");
        require(_candidateNames.length == _candidateParties.length, "Arrays length mismatch");
        require(_candidateNames.length == _candidateAges.length, "Arrays length mismatch");
        require(_candidateNames.length == _candidateManifestos.length, "Arrays length mismatch");
        require(_candidateNames.length == _candidateImageHashes.length, "Arrays length mismatch");
        require(_candidateNames.length >= 2, "Need at least 2 candidates");
        
        // Update election config
        isPublic = _isPublic;
        requireToken = _requireToken;
        if (_requireToken) {
            require(_tokenAmount > 0, "Token amount must be greater than 0");
            votingTokenAmount = _tokenAmount;
        }
        
        // Add all candidates
        for (uint256 i = 0; i < _candidateNames.length; i++) {
            require(bytes(_candidateNames[i]).length > 0, "Candidate name cannot be empty");
            require(_candidateAges[i] >= 18, "Candidate must be at least 18 years old");
            
            uint256 candidateId = totalCandidates + 1;
            
            candidates[candidateId] = Candidate({
                candidateId: candidateId,
                name: _candidateNames[i],
                party: _candidateParties[i],
                age: _candidateAges[i],
                manifesto: _candidateManifestos[i],
                imageHash: _candidateImageHashes[i],
                voteCount: 0,
                isActive: true
            });
            
            candidateIds.push(candidateId);
            totalCandidates++;
            
            emit CandidateAdded(candidateId, _candidateNames[i], _candidateParties[i], msg.sender);
        }
        
        emit ElectionConfigUpdated(msg.sender, block.timestamp);
    }

    /**
     * @notice Creator: Add voter to private election
     */
    function addVoter(address _voter) external onlyElectionCreator {
        require(state == ElectionState.CREATED, "Can only add voters before election starts");
        require(_voter != address(0), "Invalid voter address");
        require(!isVoter[_voter], "Voter already registered");
        
        isVoter[_voter] = true;
        emit VoterRegistered(_voter, msg.sender, block.timestamp);
    }

    /**
     * @notice Creator: Remove voter from private election
     */
    function removeVoter(address _voter) external onlyElectionCreator {
        require(state == ElectionState.CREATED, "Can only remove voters before election starts");
        require(isVoter[_voter], "Voter not registered");
        require(!hasVoted[_voter], "Cannot remove voter who already voted");
        
        isVoter[_voter] = false;
        emit VoterRemoved(_voter, msg.sender, block.timestamp);
    }

    /**
     * @notice Voter: Register for public election
     */
    function registerPublic() external {
        require(isPublic, "Election is private");
        require(state == ElectionState.CREATED || state == ElectionState.ONGOING, "Election not open for registration");
        require(!isVoter[msg.sender], "Already registered");
        
        // Check eligibility from voter registry
        bool isEligible = IVoterRegistry(voterRegistry).isVoterEligible(msg.sender);
        require(isEligible, "Voter not eligible");
        
        isVoter[msg.sender] = true;
        emit VoterRegistered(msg.sender, msg.sender, block.timestamp);
    }

    /**
     * @notice Check if address can vote (public or registered in private)
     */
    function canVote(address _voter) external view returns (bool) {
        if (isPublic) {
            // Public: check voter registry eligibility
            return IVoterRegistry(voterRegistry).isVoterEligible(_voter);
        } else {
            // Private: must be registered
            return isVoter[_voter];
        }
    }

    /**
     * @notice Get result for a specific candidate (only after election ended)
     */
    function getResult(uint256 _candidateId) external view returns (uint256) {
        require(state == ElectionState.ENDED || state == ElectionState.FINALIZED, "Election not ended");
        require(_candidateId > 0 && _candidateId <= totalCandidates, "Invalid candidate ID");
        return candidates[_candidateId].voteCount;
    }
}

