const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ElectionFactory Contract", function () {
  let factory;
  let voterRegistry;
  let votingToken;
  let owner;
  let creator1;
  let creator2;
  let nonOwner;

  beforeEach(async function () {
    [owner, creator1, creator2, nonOwner] = await ethers.getSigners();

    // Deploy VotingToken
    const VotingToken = await ethers.getContractFactory("VotingToken");
    votingToken = await VotingToken.deploy("Voting Token", "VOTE");
    await votingToken.waitForDeployment();

    // Deploy VoterRegistry
    const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
    voterRegistry = await VoterRegistry.deploy(18);
    await voterRegistry.waitForDeployment();

    // Deploy ElectionFactory
    const ElectionFactory = await ethers.getContractFactory("ElectionFactory");
    factory = await ElectionFactory.deploy(
      await voterRegistry.getAddress(),
      await votingToken.getAddress()
    );
    await factory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should set the correct voter registry", async function () {
      expect(await factory.voterRegistry()).to.equal(await voterRegistry.getAddress());
    });

    it("Should set the correct voting token", async function () {
      expect(await factory.votingToken()).to.equal(await votingToken.getAddress());
    });

    it("Should initialize totalElections to 0", async function () {
      expect(await factory.totalElections()).to.equal(0);
    });

    it("Should revert if voter registry is zero address", async function () {
      const ElectionFactory = await ethers.getContractFactory("ElectionFactory");
      await expect(
        ElectionFactory.deploy(ethers.ZeroAddress, await votingToken.getAddress())
      ).to.be.revertedWith("Invalid voter registry");
    });

    it("Should revert if voting token is zero address", async function () {
      const ElectionFactory = await ethers.getContractFactory("ElectionFactory");
      await expect(
        ElectionFactory.deploy(await voterRegistry.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid voting token");
    });
  });

  describe("Create Election", function () {
    it("Should create election", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      const ipfsCid = "QmTestIPFSCID123456789";
      const tx = await factory.createElection(
        "Test Election",
        "Test Description",
        "LOCAL",
        startTime,
        endTime,
        true,
        ipfsCid
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(factory, "ElectionCreated")
        .withArgs(1, await factory.getElection(1).then(e => e.electionAddress), "Test Election", ipfsCid, owner.address, block.timestamp);

      expect(await factory.totalElections()).to.equal(1);
      
      const electionInfo = await factory.getElection(1);
      expect(electionInfo.electionId).to.equal(1);
      expect(electionInfo.title).to.equal("Test Election");
      expect(electionInfo.creator).to.equal(owner.address);
      expect(electionInfo.isActive).to.be.true;
      expect(electionInfo.electionAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should transfer chairperson to creator", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      await factory.createElection(
        "Test Election",
        "Test Description",
        "LOCAL",
        startTime,
        endTime,
        true,
        "QmTestIPFSCID"
      );

      const electionInfo = await factory.getElection(1);
      const Election = await ethers.getContractFactory("Election");
      const election = Election.attach(electionInfo.electionAddress);
      
      expect(await election.chairperson()).to.equal(owner.address);
    });

    it("Should not allow non-creator to create election", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      await expect(
        factory.connect(nonOwner).createElection(
          "Test Election",
          "Test Description",
          "LOCAL",
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("Only creators can perform this action");
    });

    it("Should not allow creating election with end time before start time", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime - 100;

      await expect(
        factory.createElection(
          "Test Election",
          "Test Description",
          "LOCAL",
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("End time must be after start time");
    });

    it("Should not allow creating election with start time in the past", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime - 100;
      const endTime = startTime + 86400;

      await expect(
        factory.createElection(
          "Test Election",
          "Test Description",
          "LOCAL",
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("Start time must be in future");
    });

    it("Should not allow creating election with empty title", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      await expect(
        factory.createElection(
          "",
          "Test Description",
          "LOCAL",
          startTime,
          endTime,
          true,
          "QmTestIPFSCID"
        )
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("Should increment totalElections for each new election", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      await factory.createElection("Election 1", "Description", "LOCAL", startTime, endTime, true, "QmTestIPFSCID1");
      expect(await factory.totalElections()).to.equal(1);

      const startTime2 = currentTime + 7200;
      const endTime2 = startTime2 + 86400;
      await factory.createElection("Election 2", "Description", "LOCAL", startTime2, endTime2, true, "QmTestIPFSCID2");
      expect(await factory.totalElections()).to.equal(2);
    });

    it("Should mark election address as valid election", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;

      await factory.createElection("Test Election", "Description", "LOCAL", startTime, endTime, true, "QmTestIPFSCID");
      
      const electionInfo = await factory.getElection(1);
      expect(await factory.isElectionContract(electionInfo.electionAddress)).to.be.true;
      expect(await factory.isElectionContract(owner.address)).to.be.false;
    });
  });

  describe("Get Elections", function () {
    beforeEach(async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      
      await factory.createElection(
        "Election 1",
        "Description 1",
        "LOCAL",
        currentTime + 3600,
        currentTime + 86400,
        true,
        "QmTestIPFSCID1"
      );
      
      await factory.createElection(
        "Election 2",
        "Description 2",
        "PRESIDENTIAL",
        currentTime + 7200,
        currentTime + 172800,
        false,
        "QmTestIPFSCID2"
      );
    });

    it("Should get election by ID", async function () {
      const election1 = await factory.getElection(1);
      expect(election1.title).to.equal("Election 1");
      expect(election1.electionId).to.equal(1);

      const election2 = await factory.getElection(2);
      expect(election2.title).to.equal("Election 2");
      expect(election2.electionId).to.equal(2);
    });

    it("Should revert when getting invalid election ID", async function () {
      await expect(
        factory.getElection(999)
      ).to.be.revertedWith("Invalid election ID");
    });

    it("Should get all elections", async function () {
      const elections = await factory.getAllElections();
      expect(elections.length).to.equal(2);
      expect(elections[0].title).to.equal("Election 1");
      expect(elections[1].title).to.equal("Election 2");
    });

    it("Should get active elections", async function () {
      const activeElections = await factory.getActiveElections();
      expect(activeElections.length).to.equal(2);

      await factory.deactivateElection(1);
      const activeElectionsAfter = await factory.getActiveElections();
      expect(activeElectionsAfter.length).to.equal(1);
      expect(activeElectionsAfter[0].title).to.equal("Election 2");
    });

    it("Should get elections by creator", async function () {
      // Add creator1 as creator first
      await factory.addCreator(creator1.address);
      
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      await factory.connect(creator1).createElection(
        "Election 3",
        "Description 3",
        "LOCAL",
        currentTime + 10800,
        currentTime + 259200,
        true,
        "QmTestIPFSCID3"
      );

      const creator1Elections = await factory.getElectionsByCreator(creator1.address);
      expect(creator1Elections.length).to.equal(1);
      expect(creator1Elections[0].title).to.equal("Election 3");
    });
  });

  describe("Deactivate Election", function () {
    beforeEach(async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock.timestamp;
      await factory.createElection(
        "Test Election",
        "Description",
        "LOCAL",
        currentTime + 3600,
        currentTime + 86400,
        true,
        "QmTestIPFSCID"
      );
    });

    it("Should deactivate election", async function () {
      const electionInfoBefore = await factory.getElection(1);
      expect(electionInfoBefore.isActive).to.be.true;

      const tx = await factory.deactivateElection(1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(factory, "ElectionDeactivated")
        .withArgs(1, electionInfoBefore.electionAddress, owner.address, block.timestamp);

      const electionInfoAfter = await factory.getElection(1);
      expect(electionInfoAfter.isActive).to.be.false;
    });

    it("Should not allow non-owner to deactivate", async function () {
      await expect(
        factory.connect(nonOwner).deactivateElection(1)
      ).to.be.revertedWith("Only owner can perform this action");
    });

    it("Should not allow deactivating invalid election ID", async function () {
      await expect(
        factory.deactivateElection(999)
      ).to.be.revertedWith("Invalid election ID");
    });

    it("Should not allow deactivating already inactive election", async function () {
      await factory.deactivateElection(1);

      await expect(
        factory.deactivateElection(1)
      ).to.be.revertedWith("Election already inactive");
    });
  });

  describe("Configuration", function () {
    it("Should update voter registry", async function () {
      const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
      const newRegistry = await VoterRegistry.deploy(18);
      await newRegistry.waitForDeployment();

      const tx = await factory.updateVoterRegistry(await newRegistry.getAddress());
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(factory, "VoterRegistryUpdated")
        .withArgs(await voterRegistry.getAddress(), await newRegistry.getAddress(), owner.address, block.timestamp);

      expect(await factory.voterRegistry()).to.equal(await newRegistry.getAddress());
    });

    it("Should update voting token", async function () {
      const VotingToken = await ethers.getContractFactory("VotingToken");
      const newToken = await VotingToken.deploy("New Token", "NEW");
      await newToken.waitForDeployment();

      const tx = await factory.updateVotingToken(await newToken.getAddress());
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(factory, "VotingTokenUpdated")
        .withArgs(await votingToken.getAddress(), await newToken.getAddress(), owner.address, block.timestamp);

      expect(await factory.votingToken()).to.equal(await newToken.getAddress());
    });

    it("Should not allow updating to zero address", async function () {
      await expect(
        factory.updateVoterRegistry(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");

      await expect(
        factory.updateVotingToken(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      const tx = await factory.transferOwnership(creator1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(factory, "OwnershipTransferred")
        .withArgs(owner.address, creator1.address, block.timestamp);

      expect(await factory.owner()).to.equal(creator1.address);
    });

    it("Should not allow transferring to zero address", async function () {
      await expect(
        factory.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        factory.connect(nonOwner).transferOwnership(creator1.address)
      ).to.be.revertedWith("Only owner can perform this action");
    });
  });
});

