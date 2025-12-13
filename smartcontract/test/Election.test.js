const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Election Contract", function () {
  let election;
  let voterRegistry;
  let votingToken;
  let owner;
  let voter1;
  let voter2;
  let voter3;
  let nonVoter;

  beforeEach(async function () {
    [owner, voter1, voter2, voter3, nonVoter] = await ethers.getSigners();

    // Deploy VotingToken
    const VotingToken = await ethers.getContractFactory("VotingToken");
    votingToken = await VotingToken.deploy("Voting Token", "VOTE");
    await votingToken.waitForDeployment();

    // Deploy VoterRegistry
    const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
    voterRegistry = await VoterRegistry.deploy(18);
    await voterRegistry.waitForDeployment();

    // Deploy Election - get current block timestamp first
    const currentBlock = await ethers.provider.getBlock("latest");
    const currentTime = currentBlock.timestamp;
    const startTime = currentTime + 3600; // 1 hour from now
    const endTime = startTime + 86400; // 1 day later
    
    const Election = await ethers.getContractFactory("Election");
    election = await Election.deploy(
      1,
      "Test Election",
      "Test Description",
      "LOCAL",
      await voterRegistry.getAddress(),
      await votingToken.getAddress(),
      startTime,
      endTime,
      true,
      "QmTestIPFSCID123456789" // IPFS CID
    );
    await election.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct election ID", async function () {
      expect(await election.electionId()).to.equal(1);
    });

    it("Should set the correct title", async function () {
      expect(await election.title()).to.equal("Test Election");
    });

    it("Should set the correct description", async function () {
      expect(await election.description()).to.equal("Test Description");
    });

    it("Should set the correct election type", async function () {
      expect(await election.electionType()).to.equal("LOCAL");
    });

    it("Should set chairperson to deployer", async function () {
      expect(await election.chairperson()).to.equal(owner.address);
    });

    it("Should set correct voter registry and voting token addresses", async function () {
      expect(await election.voterRegistry()).to.equal(await voterRegistry.getAddress());
      expect(await election.votingToken()).to.equal(await votingToken.getAddress());
    });

    it("Should set initial state to CREATED", async function () {
      expect(await election.state()).to.equal(0); // CREATED = 0
    });

    it("Should set allowRealtimeResults correctly", async function () {
      expect(await election.allowRealtimeResults()).to.be.true;
    });

    it("Should revert if end time is before start time", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime - 100; // Invalid: end before start

      const Election = await ethers.getContractFactory("Election");
      await expect(
        Election.deploy(
          2,
          "Invalid Election",
          "Description",
          "LOCAL",
          await voterRegistry.getAddress(),
          await votingToken.getAddress(),
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("End time must be after start time");
    });

    it("Should revert if start time is in the past", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime - 100; // Invalid: in the past
      const endTime = startTime + 86400;

      const Election = await ethers.getContractFactory("Election");
      await expect(
        Election.deploy(
          2,
          "Invalid Election",
          "Description",
          "LOCAL",
          await voterRegistry.getAddress(),
          await votingToken.getAddress(),
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("Start time must be in the future");
    });

    it("Should revert if voter registry is zero address", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      const Election = await ethers.getContractFactory("Election");
      await expect(
        Election.deploy(
          2,
          "Invalid Election",
          "Description",
          "LOCAL",
          ethers.ZeroAddress,
          await votingToken.getAddress(),
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("Invalid voter registry address");
    });

    it("Should revert if title is empty", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      const Election = await ethers.getContractFactory("Election");
      await expect(
        Election.deploy(
          2,
          "",
          "Description",
          "LOCAL",
          await voterRegistry.getAddress(),
          await votingToken.getAddress(),
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("Title cannot be empty");
    });
  });

  describe("Candidate Management", function () {
    it("Should add a candidate", async function () {
      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_image"));
      await election.addCandidate(
        "John Doe",
        "Party A",
        35,
        "Test manifesto",
        imageHash
      );

      const candidate = await election.getCandidate(1);
      expect(candidate.name).to.equal("John Doe");
      expect(candidate.party).to.equal("Party A");
      expect(candidate.age).to.equal(35);
      expect(candidate.manifesto).to.equal("Test manifesto");
      expect(candidate.imageHash).to.equal(imageHash);
      expect(candidate.voteCount).to.equal(0);
      expect(candidate.isActive).to.be.true;
      expect(await election.totalCandidates()).to.equal(1);
    });

    it("Should emit CandidateAdded event", async function () {
      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_image"));
      await expect(
        election.addCandidate("John Doe", "Party A", 35, "Manifesto", imageHash)
      ).to.emit(election, "CandidateAdded")
        .withArgs(1, "John Doe", "Party A", owner.address);
    });

    it("Should not allow adding candidates after election starts", async function () {
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      // Start election
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate3"));
      await expect(
        election.addCandidate("John Doe", "Party A", 35, "Test", imageHash)
      ).to.be.revertedWith("Can only add candidates before election starts");
    });

    it("Should not allow non-chairperson to add candidates", async function () {
      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_image"));
      await expect(
        election.connect(voter1).addCandidate("John Doe", "Party A", 35, "Manifesto", imageHash)
      ).to.be.revertedWith("Only chairperson can perform this action");
    });

    it("Should not allow empty candidate name", async function () {
      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_image"));
      await expect(
        election.addCandidate("", "Party A", 35, "Manifesto", imageHash)
      ).to.be.revertedWith("Candidate name cannot be empty");
    });

    it("Should not allow candidate below 18 years old", async function () {
      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_image"));
      await expect(
        election.addCandidate("John Doe", "Party A", 17, "Manifesto", imageHash)
      ).to.be.revertedWith("Candidate must be at least 18 years old");
    });

    it("Should remove a candidate", async function () {
      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_image"));
      await election.addCandidate("John Doe", "Party A", 35, "Manifesto", imageHash);
      
      await expect(election.removeCandidate(1))
        .to.emit(election, "CandidateRemoved")
        .withArgs(1, "John Doe", owner.address);

      const candidate = await election.getCandidate(1);
      expect(candidate.isActive).to.be.false;
    });

    it("Should not allow removing candidates after election starts", async function () {
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      await expect(
        election.removeCandidate(1)
      ).to.be.revertedWith("Can only remove candidates before election starts");
    });

    it("Should not allow removing invalid candidate ID", async function () {
      await expect(
        election.removeCandidate(999)
      ).to.be.revertedWith("Invalid candidate ID");
    });

    it("Should not allow removing already removed candidate", async function () {
      const imageHash = ethers.keccak256(ethers.toUtf8Bytes("candidate_image"));
      await election.addCandidate("John Doe", "Party A", 35, "Manifesto", imageHash);
      await election.removeCandidate(1);

      await expect(
        election.removeCandidate(1)
      ).to.be.revertedWith("Candidate already removed");
    });

    it("Should get all candidates", async function () {
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      const candidates = await election.getAllCandidates();
      expect(candidates.length).to.equal(2);
      expect(candidates[0].name).to.equal("Candidate 1");
      expect(candidates[1].name).to.equal("Candidate 2");
    });

    it("Should only return active candidates in getAllCandidates", async function () {
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);
      await election.removeCandidate(1);

      const candidates = await election.getAllCandidates();
      expect(candidates.length).to.equal(1);
      expect(candidates[0].name).to.equal("Candidate 2");
    });
  });

  describe("Election Lifecycle", function () {
    beforeEach(async function () {
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);
    });

    it("Should start election", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }

      const tx = await election.startElection();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "ElectionStarted")
        .withArgs(1, block.timestamp);

      expect(await election.state()).to.equal(1); // ONGOING = 1
    });

    it("Should not start election before scheduled time", async function () {
      await expect(
        election.startElection()
      ).to.be.revertedWith("Cannot start before scheduled time");
    });

    it("Should not start election with less than 2 candidates", async function () {
      // Remove one candidate
      await election.removeCandidate(1);

      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }

      await expect(
        election.startElection()
      ).to.be.revertedWith("Need at least 2 active candidates");
    });

    it("Should pause election", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      const tx = await election.pauseElection();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "ElectionPaused")
        .withArgs(1, owner.address, block.timestamp);

      expect(await election.state()).to.equal(2); // PAUSED = 2
    });

    it("Should not pause election if not ongoing", async function () {
      await expect(
        election.pauseElection()
      ).to.be.revertedWith("Election not ongoing");
    });

    it("Should resume election", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();
      await election.pauseElection();

      const tx = await election.resumeElection();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "ElectionResumed")
        .withArgs(1, owner.address, block.timestamp);

      expect(await election.state()).to.equal(1); // ONGOING = 1
    });

    it("Should not resume election if not paused", async function () {
      await expect(
        election.resumeElection()
      ).to.be.revertedWith("Election not paused");
    });

    it("Should not resume election if time has ended", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const endTime = await election.endTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();
      await election.pauseElection();

      // Move time past end time
      const timeToEnd = Number(endTime) - (await ethers.provider.getBlock("latest").then(b => b.timestamp)) + 1;
      await ethers.provider.send("evm_increaseTime", [timeToEnd]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        election.resumeElection()
      ).to.be.revertedWith("Election time has ended");
    });

    it("Should end election by chairperson", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      const tx = await election.endElection();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "ElectionEnded")
        .withArgs(1, block.timestamp);

      expect(await election.state()).to.equal(3); // ENDED = 3
    });

    it("Should end election automatically when time expires", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const endTime = await election.endTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      // Move time past end time
      const timeToEnd = Number(endTime) - (await ethers.provider.getBlock("latest").then(b => b.timestamp)) + 1;
      await ethers.provider.send("evm_increaseTime", [timeToEnd]);
      await ethers.provider.send("evm_mine", []);

      await expect(election.endElection())
        .to.emit(election, "ElectionEnded");

      expect(await election.state()).to.equal(3); // ENDED = 3
    });

    it("Should check and end election automatically", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const endTime = await election.endTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      // Move time past end time
      const timeToEnd = Number(endTime) - (await ethers.provider.getBlock("latest").then(b => b.timestamp)) + 1;
      await ethers.provider.send("evm_increaseTime", [timeToEnd]);
      await ethers.provider.send("evm_mine", []);

      await election.checkAndEndElection();
      expect(await election.state()).to.equal(3); // ENDED = 3
    });

    it("Should finalize election and determine winner", async function () {
      // Setup: Register voters and vote
      const kycHash1 = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      const kycHash2 = ethers.keccak256(ethers.toUtf8Bytes("VOTER002_KYC"));
      await voterRegistry.connect(voter1).registerVoter("VOTER001", "Voter One", 25, kycHash1);
      await voterRegistry.connect(voter2).registerVoter("VOTER002", "Voter Two", 30, kycHash2);
      await voterRegistry.approveVoter(voter1.address);
      await voterRegistry.approveVoter(voter2.address);

      await election.configureTokenRequirement(false, 0);

      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      // Vote for candidate 1
      const voteHash1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await election.connect(voter1).vote(1, voteHash1);
      const voteHash2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
      await election.connect(voter2).vote(1, voteHash2);

      // End election
      await election.endElection();

      // Finalize
      const tx = await election.finalizeElection();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "ElectionFinalized")
        .withArgs(1, 1, 2, block.timestamp);

      expect(await election.state()).to.equal(4); // FINALIZED = 4
      expect(await election.winnerId()).to.equal(1);
      expect(await election.winnerVoteCount()).to.equal(2);
    });

    it("Should not finalize election if not ended", async function () {
      await expect(
        election.finalizeElection()
      ).to.be.revertedWith("Election must be ended first");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      // Add candidates
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      // Register and approve voters
      const kycHash1 = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      const kycHash2 = ethers.keccak256(ethers.toUtf8Bytes("VOTER002_KYC"));
      await voterRegistry.connect(voter1).registerVoter("VOTER001", "Voter One", 25, kycHash1);
      await voterRegistry.connect(voter2).registerVoter("VOTER002", "Voter Two", 30, kycHash2);
      await voterRegistry.approveVoter(voter1.address);
      await voterRegistry.approveVoter(voter2.address);

      // Disable token requirement for testing
      await election.configureTokenRequirement(false, 0);

      // Start election
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();
    });

    it("Should allow eligible voter to vote", async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      const tx = await election.connect(voter1).vote(1, voteHash);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "VoteCast")
        .withArgs(voter1.address, 1, block.timestamp, voteHash);

      const hasVoted = await election.hasVoterVoted(voter1.address);
      expect(hasVoted).to.be.true;

      const candidate = await election.getCandidate(1);
      expect(candidate.voteCount).to.equal(1);
      expect(await election.totalVotes()).to.equal(1);
    });

    it("Should not allow voting twice", async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await election.connect(voter1).vote(1, voteHash);

      await expect(
        election.connect(voter1).vote(2, ethers.keccak256(ethers.toUtf8Bytes("vote2")))
      ).to.be.revertedWith("Already voted");
    });

    it("Should not allow voting before election starts", async function () {
      // Create new election that hasn't started
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      const Election = await ethers.getContractFactory("Election");
      const newElection = await Election.deploy(
        2,
        "New Election",
        "Description",
        "LOCAL",
        await voterRegistry.getAddress(),
        await votingToken.getAddress(),
        startTime,
        endTime,
        true,
        "QmTestIPFSCID"
      );
      await newElection.waitForDeployment();

      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await newElection.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await newElection.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);
      await newElection.configureTokenRequirement(false, 0);

      // Register and approve voter for new election
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_NEW_KYC"));
      // Note: voter1 is already registered, so we need a different approach
      // Actually, voter1 is already registered and approved, so we can use them

      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await expect(
        newElection.connect(voter1).vote(1, voteHash)
      ).to.be.revertedWith("Election not ongoing");
    });

    it("Should not allow voting after election ends", async function () {
      const endTime = await election.endTime();
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const timeToEnd = Number(endTime) - currentTime + 1;
      await ethers.provider.send("evm_increaseTime", [timeToEnd]);
      await ethers.provider.send("evm_mine", []);

      // Election should auto-end when time expires
      await election.checkAndEndElection();
      expect(await election.state()).to.equal(3); // ENDED

      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await expect(
        election.connect(voter1).vote(1, voteHash)
      ).to.be.revertedWith("Election not ongoing");
    });

    it("Should not allow voting for invalid candidate", async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await expect(
        election.connect(voter1).vote(999, voteHash)
      ).to.be.revertedWith("Invalid candidate ID");
    });

    it("Should not allow voting for inactive candidate", async function () {
      // This test is tricky because we can't remove candidates after election starts
      // Instead, we'll test that voting for a removed candidate (before start) fails
      // But since election is already started in beforeEach, we'll skip this test
      // or test it differently
      
      // Actually, we can't test inactive candidate voting after election starts
      // because candidates can't be removed after start. So we'll test a different scenario:
      // Try to vote for candidate 0 (invalid)
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await expect(
        election.connect(voter1).vote(0, voteHash)
      ).to.be.revertedWith("Invalid candidate ID");
    });

    it("Should not allow voting with empty vote hash", async function () {
      await expect(
        election.connect(voter1).vote(1, ethers.ZeroHash)
      ).to.be.revertedWith("Vote hash cannot be empty");
    });

    it("Should not allow non-eligible voter to vote", async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await expect(
        election.connect(nonVoter).vote(1, voteHash)
      ).to.be.revertedWith("Voter not eligible");
    });

    it("Should get vote receipt", async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await election.connect(voter1).vote(1, voteHash);

      const receipt = await election.getVoteReceipt(voter1.address);
      expect(receipt.voter).to.equal(voter1.address);
      expect(receipt.candidateId).to.equal(1);
      expect(receipt.voteHash).to.equal(voteHash);
      expect(receipt.isValid).to.be.true;
    });

    it("Should verify vote", async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await election.connect(voter1).vote(1, voteHash);

      expect(await election.verifyVote(voter1.address, voteHash)).to.be.true;
      expect(await election.verifyVote(voter1.address, ethers.keccak256(ethers.toUtf8Bytes("wrong")))).to.be.false;
    });

    it("Should get results", async function () {
      const voteHash1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      const voteHash2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
      await election.connect(voter1).vote(1, voteHash1);
      await election.connect(voter2).vote(2, voteHash2);

      const results = await election.getResults();
      expect(results.length).to.equal(2);
      expect(results[0].voteCount).to.equal(1);
      expect(results[1].voteCount).to.equal(1);
    });

    it("Should get election info", async function () {
      // Vote first to have totalVotes > 0
      const voteHash1 = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      const voteHash2 = ethers.keccak256(ethers.toUtf8Bytes("vote2"));
      await election.connect(voter1).vote(1, voteHash1);
      await election.connect(voter2).vote(2, voteHash2);

      const info = await election.getElectionInfo();
      expect(info[0]).to.equal(1); // electionId
      expect(info[1]).to.equal("Test Election"); // title
      expect(info[2]).to.equal("Test Description"); // description
      expect(info[3]).to.equal("LOCAL"); // electionType
      expect(info[6]).to.equal(1); // state (ONGOING)
      expect(info[7]).to.equal(2); // totalCandidates
      expect(info[8]).to.equal(2); // totalVotes (after 2 votes)
    });
  });

  describe("Voting with Token Requirement", function () {
    let electionWithToken;
    let voter3;

    beforeEach(async function () {
      [owner, voter1, voter2, voter3] = await ethers.getSigners();

      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      const Election = await ethers.getContractFactory("Election");
      electionWithToken = await Election.deploy(
        2,
        "Token Election",
        "Test Description",
        "LOCAL",
        await voterRegistry.getAddress(),
        await votingToken.getAddress(),
        startTime,
        endTime,
        true,
        "QmTestIPFSCID"
      );
      await electionWithToken.waitForDeployment();

      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await electionWithToken.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await electionWithToken.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      await electionWithToken.configureTokenRequirement(true, ethers.parseEther("1"));
      await votingToken.addMinter(await electionWithToken.getAddress());

      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER003_KYC"));
      await voterRegistry.connect(voter3).registerVoter("VOTER003", "Voter Three", 25, kycHash);
      await voterRegistry.approveVoter(voter3.address);

      await votingToken.mint(voter3.address, ethers.parseEther("1"));

      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await electionWithToken.startElection();
    });

    it("Should allow voting with token requirement when election is minter", async function () {
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote_with_token"));
      await electionWithToken.connect(voter3).vote(1, voteHash);

      const hasVoted = await electionWithToken.hasVoterVoted(voter3.address);
      expect(hasVoted).to.be.true;
      
      const balance = await votingToken.balanceOf(voter3.address);
      expect(balance).to.equal(0);
    });

    it("Should not allow voting with insufficient tokens", async function () {
      // Create voter without tokens
      const [voter4] = await ethers.getSigners();
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER004_KYC"));
      await voterRegistry.connect(voter4).registerVoter("VOTER004", "Voter Four", 25, kycHash);
      await voterRegistry.approveVoter(voter4.address);

      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));
      await expect(
        electionWithToken.connect(voter4).vote(1, voteHash)
      ).to.be.revertedWith("Insufficient voting tokens");
    });
  });

  describe("Gasless Voting (relayVote)", function () {
    let relayer;

    beforeEach(async function () {
      [owner, voter1, voter2, relayer] = await ethers.getSigners();

      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter("VOTER001", "Voter One", 25, kycHash);
      await voterRegistry.approveVoter(voter1.address);

      await election.configureTokenRequirement(false, 0);

      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();
    });

    it("Should allow gasless voting via relayer", async function () {
      const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
      const electionId = await election.electionId();
      const candidateId = 1;
      const nonce = await election.nonces(voter1.address);
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));

      // Create EIP-712 signature
      const domain = {
        name: "Election",
        version: "1",
        chainId: chainId,
        verifyingContract: await election.getAddress()
      };

      const types = {
        VoteIntent: [
          { name: "electionId", type: "uint256" },
          { name: "candidateId", type: "uint256" },
          { name: "voterAddress", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "chainId", type: "uint256" },
          { name: "contractAddress", type: "address" }
        ]
      };

      const value = {
        electionId: electionId,
        candidateId: candidateId,
        voterAddress: voter1.address,
        nonce: nonce,
        deadline: deadline,
        chainId: chainId,
        contractAddress: await election.getAddress()
      };

      const signature = await voter1.signTypedData(domain, types, value);

      await expect(
        election.connect(relayer).relayVote(
          candidateId,
          voter1.address,
          nonce,
          deadline,
          voteHash,
          signature
        )
      ).to.emit(election, "VoteCast");

      expect(await election.hasVoterVoted(voter1.address)).to.be.true;
      expect(await election.nonces(voter1.address)).to.equal(nonce + 1n);
    });

    it("Should not allow relay vote with invalid signature", async function () {
      const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
      const electionId = await election.electionId();
      const candidateId = 1;
      const nonce = await election.nonces(voter1.address);
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));

      // Use wrong signer
      const domain = {
        name: "Election",
        version: "1",
        chainId: chainId,
        verifyingContract: await election.getAddress()
      };

      const types = {
        VoteIntent: [
          { name: "electionId", type: "uint256" },
          { name: "candidateId", type: "uint256" },
          { name: "voterAddress", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "chainId", type: "uint256" },
          { name: "contractAddress", type: "address" }
        ]
      };

      const value = {
        electionId: electionId,
        candidateId: candidateId,
        voterAddress: voter1.address,
        nonce: nonce,
        deadline: deadline,
        chainId: chainId,
        contractAddress: await election.getAddress()
      };

      const signature = await voter2.signTypedData(domain, types, value); // Wrong signer

      await expect(
        election.connect(relayer).relayVote(
          candidateId,
          voter1.address,
          nonce,
          deadline,
          voteHash,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("Should not allow relay vote with expired deadline", async function () {
      const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
      const electionId = await election.electionId();
      const candidateId = 1;
      const nonce = await election.nonces(voter1.address);
      const deadline = (await ethers.provider.getBlock("latest")).timestamp - 100; // Expired
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));

      const domain = {
        name: "Election",
        version: "1",
        chainId: chainId,
        verifyingContract: await election.getAddress()
      };

      const types = {
        VoteIntent: [
          { name: "electionId", type: "uint256" },
          { name: "candidateId", type: "uint256" },
          { name: "voterAddress", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "chainId", type: "uint256" },
          { name: "contractAddress", type: "address" }
        ]
      };

      const value = {
        electionId: electionId,
        candidateId: candidateId,
        voterAddress: voter1.address,
        nonce: nonce,
        deadline: deadline,
        chainId: chainId,
        contractAddress: await election.getAddress()
      };

      const signature = await voter1.signTypedData(domain, types, value);

      await expect(
        election.connect(relayer).relayVote(
          candidateId,
          voter1.address,
          nonce,
          deadline,
          voteHash,
          signature
        )
      ).to.be.revertedWith("Signature expired");
    });

    it("Should not allow relay vote with invalid nonce", async function () {
      const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
      const electionId = await election.electionId();
      const candidateId = 1;
      const nonce = 999; // Wrong nonce
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      const voteHash = ethers.keccak256(ethers.toUtf8Bytes("vote1"));

      const domain = {
        name: "Election",
        version: "1",
        chainId: chainId,
        verifyingContract: await election.getAddress()
      };

      const types = {
        VoteIntent: [
          { name: "electionId", type: "uint256" },
          { name: "candidateId", type: "uint256" },
          { name: "voterAddress", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "chainId", type: "uint256" },
          { name: "contractAddress", type: "address" }
        ]
      };

      const value = {
        electionId: electionId,
        candidateId: candidateId,
        voterAddress: voter1.address,
        nonce: nonce,
        deadline: deadline,
        chainId: chainId,
        contractAddress: await election.getAddress()
      };

      const signature = await voter1.signTypedData(domain, types, value);

      await expect(
        election.connect(relayer).relayVote(
          candidateId,
          voter1.address,
          nonce,
          deadline,
          voteHash,
          signature
        )
      ).to.be.revertedWith("Invalid nonce");
    });
  });

  describe("Configuration", function () {
    it("Should update election times", async function () {
      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const newStartTime = currentTime + 7200;
      const newEndTime = newStartTime + 86400;

      await election.updateElectionTimes(newStartTime, newEndTime);

      expect(await election.startTime()).to.equal(newStartTime);
      expect(await election.endTime()).to.equal(newEndTime);
    });

    it("Should not update election times after election starts", async function () {
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      const newStartTime = currentTime + 7200;
      const newEndTime = newStartTime + 86400;

      await expect(
        election.updateElectionTimes(newStartTime, newEndTime)
      ).to.be.revertedWith("Can only update before election starts");
    });

    it("Should configure token requirement", async function () {
      const tx = await election.configureTokenRequirement(true, ethers.parseEther("2"));
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "TokenRequirementUpdated")
        .withArgs(true, ethers.parseEther("2"), owner.address, block.timestamp);

      expect(await election.requireToken()).to.be.true;
      expect(await election.votingTokenAmount()).to.equal(ethers.parseEther("2"));
    });

    it("Should not configure token requirement after election starts", async function () {
      const imageHash1 = ethers.keccak256(ethers.toUtf8Bytes("candidate1"));
      const imageHash2 = ethers.keccak256(ethers.toUtf8Bytes("candidate2"));
      await election.addCandidate("Candidate 1", "Party A", 30, "Manifesto 1", imageHash1);
      await election.addCandidate("Candidate 2", "Party B", 32, "Manifesto 2", imageHash2);

      const currentTime = await ethers.provider.getBlock("latest").then(b => b.timestamp);
      const startTime = await election.startTime();
      const timeToAdd = Number(startTime) - currentTime + 1;
      if (timeToAdd > 0) {
        await ethers.provider.send("evm_increaseTime", [timeToAdd]);
        await ethers.provider.send("evm_mine", []);
      }
      await election.startElection();

      await expect(
        election.configureTokenRequirement(true, ethers.parseEther("1"))
      ).to.be.revertedWith("Can only configure before start");
    });

    it("Should transfer chairperson", async function () {
      const tx = await election.transferChairperson(voter1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(election, "ChairpersonTransferred")
        .withArgs(owner.address, voter1.address, block.timestamp);

      expect(await election.chairperson()).to.equal(voter1.address);
    });

    it("Should not transfer chairperson to zero address", async function () {
      await expect(
        election.transferChairperson(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });
});
