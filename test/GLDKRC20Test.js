const { expect } = require("chai");
const { ethers } = require("hardhat");

const offset8Days = 8 * 60 * 60 * 24

describe("GLDKRC20 and InvestorVault", function () {

    let owner, addr1, addr2, fundReceiver, investor, rate, gldkrc20, testERC20, investorVault;

    beforeEach(async () => {
        [owner, addr1, addr2, fundReceiver, investor] = await ethers.getSigners();
        rate = 2;
        // Deploy GLDKRC20
        const GLDKRC20 = await ethers.getContractFactory("GLDKRC20");
        gldkrc20 = await GLDKRC20.deploy(owner.address, 900, addr1.address, 100);
        await gldkrc20.deployed();
        await gldkrc20.connect(addr1).transfer(addr2.address, 50);
        expect(await gldkrc20.balanceOf(addr1.address)).to.equal(50);

        // Deploy an ERC20 token for testing
        const TestERC20 = await ethers.getContractFactory("TestToken");
        testERC20 = await TestERC20.deploy(investor.address, 100);
        await testERC20.deployed();
        expect(await testERC20.balanceOf(investor.address)).to.equal(100);

        // Deploy InvestorVault
        const InvestorVault = await ethers.getContractFactory("InvestorVault");
        investorVault = await InvestorVault.deploy(gldkrc20.address, testERC20.address, rate, fundReceiver.address);
        await investorVault.deployed();
    });

    it("Should mint buy gldkrm", async function () {
        await gldkrc20.connect(owner).transfer(investorVault.address, 900);
        expect(await gldkrc20.balanceOf(investorVault.address)).to.equal(900);


        await testERC20.connect(investor).approve(investorVault.address, 10);
        await investorVault.connect(investor).buy(10);
        expect(await testERC20.balanceOf(fundReceiver.address)).to.equal(10);
        expect(await gldkrc20.balanceOf(investor.address)).to.equal(10 * rate);

    });

    it("Should claim reward", async () => {
        let initialAddr1Balance = await ethers.provider.getBalance(addr1.address);
        await investorVault.connect(owner).receiveEther({ value: ethers.utils.parseEther("1.0") });

        await advanceTime(offset8Days);
        await investorVault.connect(owner).receiveEther({ value: ethers.utils.parseEther("1.0") });

        await advanceTime(offset8Days);
        await investorVault.connect(owner).receiveEther({ value: ethers.utils.parseEther("1.0") });

        expect(await investorVault.epochBalances(1)).to.equal(BigInt(10 ** 18));
        expect(await investorVault.epochBalances(2)).to.equal(BigInt(10 ** 18));
        expect(await investorVault.epochBalances(3)).to.equal(BigInt(10 ** 18));
        expect(await investorVault.epochBalances(4)).to.equal(BigInt(0));

        await expect(investorVault.connect(addr1).claim()).to.be.revertedWith("Still not authorized");

        await gldkrc20.connect(addr1).approve(investorVault.address, 50);
        await investorVault.connect(addr1).lock(50);

        expect(await gldkrc20.balanceOf(addr1.address)).to.equal(0);
        expect(await investorVault.whenCanClaim(addr1.address)).to.equal(4);

        await advanceTime(offset8Days);
        await investorVault.connect(owner).receiveEther({ value: ethers.utils.parseEther("1.0") });
        expect(await investorVault.whenCanClaim(addr1.address)).to.equal(3);

        await advanceTime(offset8Days);
        await investorVault.connect(owner).receiveEther({ value: ethers.utils.parseEther("1.0") });
        expect(await investorVault.whenCanClaim(addr1.address)).to.equal(2);

        await advanceTime(offset8Days);
        await investorVault.connect(owner).receiveEther({ value: ethers.utils.parseEther("1.0") });
        expect(await investorVault.whenCanClaim(addr1.address)).to.equal(1);

        await advanceTime(offset8Days);
        await investorVault.connect(owner).receiveEther({ value: ethers.utils.parseEther("1.0") });
        expect(await investorVault.whenCanClaim(addr1.address)).to.equal(0);


        await investorVault.connect(addr1).claim();
        let finalAddr1Balance = await ethers.provider.getBalance(addr1.address);

        expect((finalAddr1Balance - initialAddr1Balance)).to.greaterThan(Number(BigInt((10 ** 18) * 50 / 1000)) * 5.9);
        expect(await investorVault.lastClaimed(addr1.address)).to.equal(6);
        expect(await investorVault.epochBalances(7)).to.equal(BigInt(10 ** 18));
        await investorVault.connect(addr1).unlock(50);
        expect(await gldkrc20.balanceOf(addr1.address)).to.equal(50);
    });

});

async function advanceTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
}

async function setTimestamp(timestamp) {
    await ethers.provider.send("evm_mine", [timestamp]);
}

async function getBlockTimestamp() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return Number(block.timestamp);
}

