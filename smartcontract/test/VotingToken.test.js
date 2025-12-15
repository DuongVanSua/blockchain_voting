const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingToken Contract", function () {
  let votingToken;
  let owner;
  let minter;
  let recipient;
  let nonMinter;

  beforeEach(async function () {
    [owner, minter, recipient, nonMinter] = await ethers.getSigners();

    const VotingToken = await ethers.getContractFactory("VotingToken");
    votingToken = await VotingToken.deploy("Voting Token", "VOTE");
    await votingToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await votingToken.name()).to.equal("Voting Token");
      expect(await votingToken.symbol()).to.equal("VOTE");
    });

    it("Should set decimals to 18", async function () {
      expect(await votingToken.decimals()).to.equal(18);
    });

    it("Should set initial total supply to 0", async function () {
      expect(await votingToken.totalSupply()).to.equal(0);
    });

    it("Should set owner as minter", async function () {
      expect(await votingToken.minters(owner.address)).to.be.true;
    });

    it("Should set owner correctly", async function () {
      expect(await votingToken.owner()).to.equal(owner.address);
    });

    it("Should set isTransferable to false", async function () {
      expect(await votingToken.isTransferable()).to.be.false;
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const amount = ethers.parseEther("100");
      const tx = await votingToken.mint(recipient.address, amount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "Mint")
        .withArgs(recipient.address, amount);

      await expect(tx)
        .to.emit(votingToken, "Transfer")
        .withArgs(ethers.ZeroAddress, recipient.address, amount);

      const balance = await votingToken.balanceOf(recipient.address);
      expect(balance).to.equal(amount);
      expect(await votingToken.totalSupply()).to.equal(amount);
    });

    it("Should not allow non-minter to mint", async function () {
      const amount = ethers.parseEther("100");
      await expect(
        votingToken.connect(nonMinter).mint(recipient.address, amount)
      ).to.be.revertedWith("Only minters can perform this action");
    });

    it("Should not allow minting to zero address", async function () {
      const amount = ethers.parseEther("100");
      await expect(
        votingToken.mint(ethers.ZeroAddress, amount)
      ).to.be.revertedWith("Cannot mint to zero address");
    });

    it("Should not allow minting zero amount", async function () {
      await expect(
        votingToken.mint(recipient.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should accumulate total supply correctly", async function () {
      await votingToken.mint(recipient.address, ethers.parseEther("100"));
      await votingToken.mint(recipient.address, ethers.parseEther("50"));

      expect(await votingToken.totalSupply()).to.equal(ethers.parseEther("150"));
      expect(await votingToken.balanceOf(recipient.address)).to.equal(ethers.parseEther("150"));
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const amount = ethers.parseEther("100");
      await votingToken.mint(recipient.address, amount);
    });

    it("Should allow minter to burn tokens", async function () {
      const amount = ethers.parseEther("50");
      const tx = await votingToken.burn(recipient.address, amount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "Burn")
        .withArgs(recipient.address, amount);

      await expect(tx)
        .to.emit(votingToken, "Transfer")
        .withArgs(recipient.address, ethers.ZeroAddress, amount);

      const balance = await votingToken.balanceOf(recipient.address);
      expect(balance).to.equal(ethers.parseEther("50"));
      expect(await votingToken.totalSupply()).to.equal(ethers.parseEther("50"));
    });

    it("Should not allow non-minter to burn", async function () {
      const amount = ethers.parseEther("50");
      await expect(
        votingToken.connect(nonMinter).burn(recipient.address, amount)
      ).to.be.revertedWith("Only minters can perform this action");
    });

    it("Should not allow burning zero amount", async function () {
      await expect(
        votingToken.burn(recipient.address, 0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should not allow burning more than balance", async function () {
      const amount = ethers.parseEther("150");
      await expect(
        votingToken.burn(recipient.address, amount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should reduce total supply when burning", async function () {
      await votingToken.burn(recipient.address, ethers.parseEther("30"));
      expect(await votingToken.totalSupply()).to.equal(ethers.parseEther("70"));
    });
  });

  describe("Minter Management", function () {
    it("Should allow owner to add minter", async function () {
      const tx = await votingToken.addMinter(minter.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "MinterAdded")
        .withArgs(minter.address, owner.address);

      expect(await votingToken.minters(minter.address)).to.be.true;
      expect(await votingToken.isMinter(minter.address)).to.be.true;
    });

    it("Should not allow non-owner to add minter", async function () {
      await expect(
        votingToken.connect(nonMinter).addMinter(minter.address)
      ).to.be.revertedWith("Only owner can perform this action");
    });

    it("Should not allow adding zero address as minter", async function () {
      await expect(
        votingToken.addMinter(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid minter address");
    });

    it("Should not allow adding existing minter", async function () {
      await votingToken.addMinter(minter.address);

      await expect(
        votingToken.addMinter(minter.address)
      ).to.be.revertedWith("Already a minter");
    });

    it("Should allow owner to remove minter", async function () {
      await votingToken.addMinter(minter.address);
      
      const tx = await votingToken.removeMinter(minter.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "MinterRemoved")
        .withArgs(minter.address, owner.address);

      expect(await votingToken.minters(minter.address)).to.be.false;
    });

    it("Should not allow removing owner as minter", async function () {
      await expect(
        votingToken.removeMinter(owner.address)
      ).to.be.revertedWith("Cannot remove owner as minter");
    });

    it("Should check if address is minter", async function () {
      expect(await votingToken.isMinter(owner.address)).to.be.true;
      expect(await votingToken.isMinter(nonMinter.address)).to.be.false;

      await votingToken.addMinter(minter.address);
      expect(await votingToken.isMinter(minter.address)).to.be.true;
    });
  });

  describe("Non-Transferable", function () {
    beforeEach(async function () {
      await votingToken.mint(recipient.address, ethers.parseEther("100"));
    });

    it("Should not allow transfer", async function () {
      await expect(
        votingToken.connect(recipient).transfer(minter.address, ethers.parseEther("10"))
      ).to.be.revertedWith("Voting tokens are non-transferable");
    });

    it("Should not allow transferFrom", async function () {
      await expect(
        votingToken.connect(minter).transferFrom(recipient.address, minter.address, ethers.parseEther("10"))
      ).to.be.revertedWith("Voting tokens are non-transferable");
    });

    it("Should not allow approve", async function () {
      await expect(
        votingToken.connect(recipient).approve(minter.address, ethers.parseEther("10"))
      ).to.be.revertedWith("Approval not allowed for non-transferable tokens");
    });

    it("Should return zero allowance", async function () {
      const allowance = await votingToken.allowance(recipient.address, minter.address);
      expect(allowance).to.equal(0);
    });
  });

  describe("Transferable Mode", function () {
    let spender;

    beforeEach(async function () {
      [owner, minter, recipient, nonMinter, spender] = await ethers.getSigners();
      await votingToken.mint(recipient.address, ethers.parseEther("100"));
      await votingToken.setTransferable(true);
    });

    it("Should allow owner to enable transfers", async function () {
      const tx = await votingToken.setTransferable(true);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "TransferabilityChanged")
        .withArgs(true, owner.address);

      expect(await votingToken.isTransferable()).to.be.true;
    });

    it("Should allow owner to disable transfers", async function () {
      await votingToken.setTransferable(true);
      const tx = await votingToken.setTransferable(false);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "TransferabilityChanged")
        .withArgs(false, owner.address);

      expect(await votingToken.isTransferable()).to.be.false;
    });

    it("Should not allow non-owner to set transferable", async function () {
      await expect(
        votingToken.connect(nonMinter).setTransferable(true)
      ).to.be.revertedWith("Only owner can perform this action");
    });

    it("Should allow transfer when transferable", async function () {
      const amount = ethers.parseEther("50");
      const tx = await votingToken.connect(recipient).transfer(minter.address, amount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "Transfer")
        .withArgs(recipient.address, minter.address, amount);

      expect(await votingToken.balanceOf(recipient.address)).to.equal(ethers.parseEther("50"));
      expect(await votingToken.balanceOf(minter.address)).to.equal(amount);
    });

    it("Should not allow transfer to zero address", async function () {
      await expect(
        votingToken.connect(recipient).transfer(ethers.ZeroAddress, ethers.parseEther("10"))
      ).to.be.revertedWith("Cannot transfer to zero address");
    });

    it("Should not allow transfer with insufficient balance", async function () {
      await expect(
        votingToken.connect(recipient).transfer(minter.address, ethers.parseEther("150"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should allow approve when transferable", async function () {
      const amount = ethers.parseEther("30");
      const tx = await votingToken.connect(recipient).approve(spender.address, amount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "Approval")
        .withArgs(recipient.address, spender.address, amount);

      expect(await votingToken.allowance(recipient.address, spender.address)).to.equal(amount);
    });

    it("Should not allow approve to zero address", async function () {
      await expect(
        votingToken.connect(recipient).approve(ethers.ZeroAddress, ethers.parseEther("10"))
      ).to.be.revertedWith("Cannot approve zero address");
    });

    it("Should return correct allowance", async function () {
      const amount = ethers.parseEther("25");
      await votingToken.connect(recipient).approve(spender.address, amount);
      
      expect(await votingToken.allowance(recipient.address, spender.address)).to.equal(amount);
      expect(await votingToken.allowance(recipient.address, minter.address)).to.equal(0);
    });

    it("Should allow transferFrom when transferable and approved", async function () {
      const amount = ethers.parseEther("40");
      await votingToken.connect(recipient).approve(spender.address, amount);

      const tx = await votingToken.connect(spender).transferFrom(recipient.address, minter.address, amount);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "Transfer")
        .withArgs(recipient.address, minter.address, amount);

      expect(await votingToken.balanceOf(recipient.address)).to.equal(ethers.parseEther("60"));
      expect(await votingToken.balanceOf(minter.address)).to.equal(amount);
      expect(await votingToken.allowance(recipient.address, spender.address)).to.equal(0);
    });

    it("Should not allow transferFrom with insufficient allowance", async function () {
      await votingToken.connect(recipient).approve(spender.address, ethers.parseEther("30"));

      await expect(
        votingToken.connect(spender).transferFrom(recipient.address, minter.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Insufficient allowance");
    });

    it("Should not allow transferFrom with insufficient balance", async function () {
      await votingToken.connect(recipient).approve(spender.address, ethers.parseEther("150"));

      await expect(
        votingToken.connect(spender).transferFrom(recipient.address, minter.address, ethers.parseEther("150"))
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should not allow transferFrom from zero address", async function () {
      await expect(
        votingToken.connect(spender).transferFrom(ethers.ZeroAddress, minter.address, ethers.parseEther("10"))
      ).to.be.revertedWith("Cannot transfer from zero address");
    });

    it("Should not allow transferFrom to zero address", async function () {
      await votingToken.connect(recipient).approve(spender.address, ethers.parseEther("30"));

      await expect(
        votingToken.connect(spender).transferFrom(recipient.address, ethers.ZeroAddress, ethers.parseEther("10"))
      ).to.be.revertedWith("Cannot transfer to zero address");
    });

    it("Should reduce allowance after transferFrom", async function () {
      const approveAmount = ethers.parseEther("50");
      const transferAmount = ethers.parseEther("20");
      await votingToken.connect(recipient).approve(spender.address, approveAmount);

      await votingToken.connect(spender).transferFrom(recipient.address, minter.address, transferAmount);

      const remainingAllowance = await votingToken.allowance(recipient.address, spender.address);
      expect(remainingAllowance).to.equal(ethers.parseEther("30"));
    });
  });

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      const tx = await votingToken.transferOwnership(recipient.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(votingToken, "OwnershipTransferred")
        .withArgs(owner.address, recipient.address);

      expect(await votingToken.owner()).to.equal(recipient.address);
      expect(await votingToken.minters(recipient.address)).to.be.true;
    });

    it("Should not allow transferring to zero address", async function () {
      await expect(
        votingToken.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid new owner address");
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        votingToken.connect(nonMinter).transferOwnership(recipient.address)
      ).to.be.revertedWith("Only owner can perform this action");
    });
  });
});
