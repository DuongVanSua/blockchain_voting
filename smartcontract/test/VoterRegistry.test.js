const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VoterRegistry Contract", function () {
  let voterRegistry;
  let owner;
  let voter1;
  let voter2;
  let chairperson;
  let nonChairperson;

  beforeEach(async function () {
    [owner, voter1, voter2, chairperson, nonChairperson] = await ethers.getSigners();

    const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
    voterRegistry = await VoterRegistry.deploy(18);
    await voterRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct minimum voting age", async function () {
      expect(await voterRegistry.minVotingAge()).to.equal(18);
    });

    it("Should set owner as chairperson", async function () {
      expect(await voterRegistry.chairpersons(owner.address)).to.be.true;
    });

    it("Should set owner correctly", async function () {
      expect(await voterRegistry.owner()).to.equal(owner.address);
    });

    it("Should initialize counters to zero", async function () {
      expect(await voterRegistry.totalVoters()).to.equal(0);
      expect(await voterRegistry.totalApprovedVoters()).to.equal(0);
      expect(await voterRegistry.totalBlockedVoters()).to.equal(0);
    });

    it("Should revert if minimum voting age is zero", async function () {
      const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
      await expect(
        VoterRegistry.deploy(0)
      ).to.be.revertedWith("Minimum voting age must be greater than 0");
    });
  });

  describe("Voter Registration", function () {
    it("Should allow voter to register", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      const tx = await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "VoterRegistered")
        .withArgs(voter1.address, "VOTER001", block.timestamp);

      const voter = await voterRegistry.getVoterInfo(voter1.address);
      expect(voter.voterId).to.equal("VOTER001");
      expect(voter.name).to.equal("John Doe");
      expect(voter.age).to.equal(25);
      expect(voter.kycHash).to.equal(kycHash);
      expect(voter.status).to.equal(1); // REGISTERED_FLAG = 1
      expect(await voterRegistry.totalVoters()).to.equal(1);
    });

    it("Should not allow duplicate registration", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash
      );

      const kycHash2 = ethers.keccak256(ethers.toUtf8Bytes("VOTER002_KYC"));
      await expect(
        voterRegistry.connect(voter1).registerVoter(
          "VOTER002",
          "Jane Doe",
          30,
          kycHash2
        )
      ).to.be.revertedWith("Voter already registered");
    });

    it("Should not allow duplicate voter ID", async function () {
      const kycHash1 = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash1
      );

      const kycHash2 = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC_2"));
      await expect(
        voterRegistry.connect(voter2).registerVoter(
          "VOTER001",
          "Jane Doe",
          30,
          kycHash2
        )
      ).to.be.revertedWith("Voter ID already exists");
    });

    it("Should not allow registration below minimum voting age", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await expect(
        voterRegistry.connect(voter1).registerVoter(
          "VOTER001",
          "John Doe",
          17,
          kycHash
        )
      ).to.be.revertedWith("Below minimum voting age");
    });

    it("Should not allow empty voter ID", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await expect(
        voterRegistry.connect(voter1).registerVoter(
          "",
          "John Doe",
          25,
          kycHash
        )
      ).to.be.revertedWith("Voter ID cannot be empty");
    });

    it("Should not allow empty name", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await expect(
        voterRegistry.connect(voter1).registerVoter(
          "VOTER001",
          "",
          25,
          kycHash
        )
      ).to.be.revertedWith("Name cannot be empty");
    });

    it("Should not allow empty KYC hash", async function () {
      await expect(
        voterRegistry.connect(voter1).registerVoter(
          "VOTER001",
          "John Doe",
          25,
          ethers.ZeroHash
        )
      ).to.be.revertedWith("KYC hash cannot be empty");
    });

    it("Should get voter by ID", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash
      );

      const voter = await voterRegistry.getVoterByID("VOTER001");
      expect(voter.voterAddress).to.equal(voter1.address);
      expect(voter.voterId).to.equal("VOTER001");
    });

    it("Should get all voters", async function () {
      const kycHash1 = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      const kycHash2 = ethers.keccak256(ethers.toUtf8Bytes("VOTER002_KYC"));
      await voterRegistry.connect(voter1).registerVoter("VOTER001", "John Doe", 25, kycHash1);
      await voterRegistry.connect(voter2).registerVoter("VOTER002", "Jane Doe", 30, kycHash2);

      const voters = await voterRegistry.getAllVoters();
      expect(voters.length).to.equal(2);
      expect(voters[0]).to.equal(voter1.address);
      expect(voters[1]).to.equal(voter2.address);
    });
  });

  describe("Voter Approval", function () {
    beforeEach(async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash
      );
    });

    it("Should allow chairperson to approve voter", async function () {
      const tx = await voterRegistry.approveVoter(voter1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "VoterApproved")
        .withArgs(voter1.address, owner.address, block.timestamp);

      const isEligible = await voterRegistry.isVoterEligible(voter1.address);
      expect(isEligible).to.be.true;
      expect(await voterRegistry.totalApprovedVoters()).to.equal(1);
    });

    it("Should not allow non-chairperson to approve", async function () {
      await expect(
        voterRegistry.connect(voter1).approveVoter(voter1.address)
      ).to.be.revertedWith("Only chairpersons can perform this action");
    });

    it("Should not allow approving unregistered voter", async function () {
      await expect(
        voterRegistry.approveVoter(voter2.address)
      ).to.be.revertedWith("Voter not registered");
    });

    it("Should not allow approving already approved voter", async function () {
      await voterRegistry.approveVoter(voter1.address);

      await expect(
        voterRegistry.approveVoter(voter1.address)
      ).to.be.revertedWith("Voter already approved");
    });

    it("Should not allow approving blocked voter", async function () {
      await voterRegistry.blockVoter(voter1.address, "Test reason");

      await expect(
        voterRegistry.approveVoter(voter1.address)
      ).to.be.revertedWith("Cannot approve blocked voter");
    });
  });

  describe("Voter Rejection", function () {
    beforeEach(async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash
      );
    });

    it("Should allow chairperson to reject voter", async function () {
      const tx = await voterRegistry.rejectVoter(voter1.address, "Invalid KYC");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "VoterRejected")
        .withArgs(voter1.address, owner.address, "Invalid KYC", block.timestamp);
    });

    it("Should not allow rejecting approved voter", async function () {
      await voterRegistry.approveVoter(voter1.address);

      await expect(
        voterRegistry.rejectVoter(voter1.address, "Reason")
      ).to.be.revertedWith("Cannot reject approved voter");
    });
  });

  describe("Voter Blocking", function () {
    beforeEach(async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash
      );
    });

    it("Should allow chairperson to block voter", async function () {
      const tx = await voterRegistry.blockVoter(voter1.address, "Fraud detected");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "VoterBlocked")
        .withArgs(voter1.address, owner.address, "Fraud detected", block.timestamp);

      expect(await voterRegistry.totalBlockedVoters()).to.equal(1);
      const isEligible = await voterRegistry.isVoterEligible(voter1.address);
      expect(isEligible).to.be.false;
    });

    it("Should decrease approved count when blocking approved voter", async function () {
      await voterRegistry.approveVoter(voter1.address);
      expect(await voterRegistry.totalApprovedVoters()).to.equal(1);

      await voterRegistry.blockVoter(voter1.address, "Reason");
      expect(await voterRegistry.totalApprovedVoters()).to.equal(0);
      expect(await voterRegistry.totalBlockedVoters()).to.equal(1);
    });

    it("Should not allow blocking already blocked voter", async function () {
      await voterRegistry.blockVoter(voter1.address, "Reason");

      await expect(
        voterRegistry.blockVoter(voter1.address, "Another reason")
      ).to.be.revertedWith("Voter already blocked");
    });
  });

  describe("Voter Unblocking", function () {
    beforeEach(async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter(
        "VOTER001",
        "John Doe",
        25,
        kycHash
      );
      // Don't approve before blocking for the basic unblock test
      // But approve for the restore approved count test
      await voterRegistry.blockVoter(voter1.address, "Test reason");
    });

    it("Should allow chairperson to unblock voter", async function () {
      const tx = await voterRegistry.unblockVoter(voter1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "VoterUnblocked")
        .withArgs(voter1.address, owner.address, block.timestamp);

      expect(await voterRegistry.totalBlockedVoters()).to.equal(0);
    });

    it("Should restore approved count when unblocking approved voter", async function () {
      // Use a new voter to avoid conflict with beforeEach (voter1 is already blocked)
      const kycHash2 = ethers.keccak256(ethers.toUtf8Bytes("VOTER002_KYC"));
      await voterRegistry.connect(voter2).registerVoter(
        "VOTER002",
        "Jane Doe",
        30,
        kycHash2
      );

      // Approve first, then block
      await voterRegistry.approveVoter(voter2.address);
      expect(await voterRegistry.totalApprovedVoters()).to.equal(1);
      
      await voterRegistry.blockVoter(voter2.address, "Reason");
      expect(await voterRegistry.totalApprovedVoters()).to.equal(0);
      expect(await voterRegistry.totalBlockedVoters()).to.equal(2); // voter1 + voter2

      // Unblock should restore approved count since voter still has APPROVED_FLAG
      await voterRegistry.unblockVoter(voter2.address);
      expect(await voterRegistry.totalApprovedVoters()).to.equal(1);
      expect(await voterRegistry.totalBlockedVoters()).to.equal(1); // Only voter1 remains blocked
      
      // Voter should be eligible again
      expect(await voterRegistry.isVoterEligible(voter2.address)).to.be.true;
    });

    it("Should not allow unblocking non-blocked voter", async function () {
      await voterRegistry.unblockVoter(voter1.address);

      await expect(
        voterRegistry.unblockVoter(voter1.address)
      ).to.be.revertedWith("Voter not blocked");
    });
  });

  describe("Chairperson Management", function () {
    it("Should allow owner to add chairperson", async function () {
      const tx = await voterRegistry.addChairperson(chairperson.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "ChairpersonAdded")
        .withArgs(chairperson.address, owner.address, block.timestamp);

      expect(await voterRegistry.chairpersons(chairperson.address)).to.be.true;
    });

    it("Should not allow non-owner to add chairperson", async function () {
      await expect(
        voterRegistry.connect(voter1).addChairperson(chairperson.address)
      ).to.be.revertedWith("Only owner can perform this action");
    });

    it("Should not allow adding zero address as chairperson", async function () {
      await expect(
        voterRegistry.addChairperson(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid chairperson address");
    });

    it("Should not allow adding existing chairperson", async function () {
      await voterRegistry.addChairperson(chairperson.address);

      await expect(
        voterRegistry.addChairperson(chairperson.address)
      ).to.be.revertedWith("Already a chairperson");
    });

    it("Should allow owner to remove chairperson", async function () {
      await voterRegistry.addChairperson(chairperson.address);
      
      const tx = await voterRegistry.removeChairperson(chairperson.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "ChairpersonRemoved")
        .withArgs(chairperson.address, owner.address, block.timestamp);

      expect(await voterRegistry.chairpersons(chairperson.address)).to.be.false;
    });

    it("Should not allow removing owner as chairperson", async function () {
      await expect(
        voterRegistry.removeChairperson(owner.address)
      ).to.be.revertedWith("Cannot remove owner");
    });

    it("Should check if address is chairperson", async function () {
      expect(await voterRegistry.isChairperson(owner.address)).to.be.true;
      expect(await voterRegistry.isChairperson(voter1.address)).to.be.false;

      await voterRegistry.addChairperson(chairperson.address);
      expect(await voterRegistry.isChairperson(chairperson.address)).to.be.true;
    });
  });

  describe("Eligibility Check", function () {
    it("Should return false for unregistered voter", async function () {
      expect(await voterRegistry.isVoterEligible(voter1.address)).to.be.false;
    });

    it("Should return false for registered but not approved voter", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter("VOTER001", "John Doe", 25, kycHash);

      expect(await voterRegistry.isVoterEligible(voter1.address)).to.be.false;
    });

    it("Should return true for approved voter", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter("VOTER001", "John Doe", 25, kycHash);
      await voterRegistry.approveVoter(voter1.address);

      expect(await voterRegistry.isVoterEligible(voter1.address)).to.be.true;
    });

    it("Should return false for blocked voter", async function () {
      const kycHash = ethers.keccak256(ethers.toUtf8Bytes("VOTER001_KYC"));
      await voterRegistry.connect(voter1).registerVoter("VOTER001", "John Doe", 25, kycHash);
      await voterRegistry.approveVoter(voter1.address);
      await voterRegistry.blockVoter(voter1.address, "Reason");

      expect(await voterRegistry.isVoterEligible(voter1.address)).to.be.false;
    });
  });

  describe("Configuration", function () {
    it("Should update minimum voting age", async function () {
      const tx = await voterRegistry.updateMinVotingAge(21);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "MinVotingAgeUpdated")
        .withArgs(18, 21, owner.address, block.timestamp);

      expect(await voterRegistry.minVotingAge()).to.equal(21);
    });

    it("Should not allow zero minimum voting age", async function () {
      await expect(
        voterRegistry.updateMinVotingAge(0)
      ).to.be.revertedWith("Age must be greater than 0");
    });

    it("Should not allow non-owner to update minimum voting age", async function () {
      await expect(
        voterRegistry.connect(voter1).updateMinVotingAge(21)
      ).to.be.revertedWith("Only owner can perform this action");
    });
  });

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      const tx = await voterRegistry.transferOwnership(voter1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(voterRegistry, "OwnershipTransferred")
        .withArgs(owner.address, voter1.address, block.timestamp);

      expect(await voterRegistry.owner()).to.equal(voter1.address);
      expect(await voterRegistry.chairpersons(voter1.address)).to.be.true;
    });

    it("Should not allow transferring to zero address", async function () {
      await expect(
        voterRegistry.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner address");
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        voterRegistry.connect(voter1).transferOwnership(voter2.address)
      ).to.be.revertedWith("Only owner can perform this action");
    });
  });
});
