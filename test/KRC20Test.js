const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const { utils } = ethers;

describe("KRC-20 testing", function () {
    let KRC20, krc20, investorVault, gldkrc20, testERC20, owner, member1, member2, investor, fundReceiver;

    beforeEach(async () => {
        KRC20 = await ethers.getContractFactory("KRC20");
        [owner, member1, member2, investor, fundReceiver] = await ethers.getSigners();

        const GLDKRC20 = await ethers.getContractFactory("GLDKRC20");
        gldkrc20 = await GLDKRC20.deploy(owner.address, 900, member1.address, 100);
        await gldkrc20.deployed();

        // Deploy an ERC20 token for testing
        const TestERC20 = await ethers.getContractFactory("TestToken");
        testERC20 = await TestERC20.deploy(investor.address, 100);
        await testERC20.deployed();

        const InvestorVault = await ethers.getContractFactory("InvestorVault");
        investorVault = await InvestorVault.deploy(gldkrc20.address, testERC20.address, 2, fundReceiver.address);
        await investorVault.deployed();

        const name = "Karma";
        const symbol = "KRC";
        const quorum = 30;
        krc20 = await KRC20.deploy(name, symbol, quorum, investorVault.address);
        await krc20.deployed();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await krc20.owner()).to.equal(owner.address);
        });

        it("Should assign the total supply of tokens to the owner", async function () {
            expect(await krc20.totalSupply()).to.equal(BigInt(0));
        });
    });

    describe("Transactions", function () {
        it("Should burn supply during transaction", async function () {

        });
    });

    describe("Proposals, voting and claiming", function () {
        it("Should add a new contract proposal event", async function () {
            const contractAddr = ethers.constants.AddressZero;
            const proposalCount = await krc20.proposalCount();
            await expect(krc20.addContractProposal(contractAddr, "Prop name", "uri", await getDeadline(350)))
                .to.emit(krc20, "NewProposal");
            await expect(krc20.voteProposal(proposalCount, true))
                .to.emit(krc20, "Vote");
            //await advanceTime(400);
            await expect(krc20.claimProposal(0)).to.emit(krc20, "ApprovedProposal");
            expect(await krc20.isAuthorizedContract(contractAddr)).to.be.true;
            expect(await krc20.proposalCount()).to.equal(ethers.BigNumber.from(1));
        });

        it("Should change minting threshold", async function () {
            const newThreshold = 33;
            await expect(krc20.changeThresholdProposal(newThreshold, "Prop name", await getDeadline(1000)))
                .to.emit(krc20, "NewProposal");
            await expect(krc20.voteProposal(0, true))
                .to.emit(krc20, "Vote");
            await advanceTime(400);
            await expect(krc20.claimProposal(0)).to.emit(krc20, "ApprovedProposal");
            expect(await krc20.mintingThreshold()).to.equal(BigInt(newThreshold));
        });
    });

    describe("Rewards", function () {
        it("Should claim reward", async function () {
            const amountToSend = ethers.utils.parseEther("1");
            const WAIT_8_DAYS = 60 * 60 * 24 * 8;
            await krc20.donation({ value: amountToSend });
            const ownerInitBalance = await ethers.provider.getBalance(owner.address);
            const member1InitBalance = await ethers.provider.getBalance(member1.address);
            const member2InitBalance = await ethers.provider.getBalance(member2.address);
            const deadline = await getDeadline(10000000);
            const block = await ethers.provider.getBlock("latest");
            const timestamp = block.timestamp;

            await krc20.addMemberProposal(member1.address, "prop1", "prop1.uri", deadline);
            await krc20.voteProposal(0, true);
            await krc20.claimProposal(0);

            await krc20.addMemberProposal(member2.address, "prop2", "prop2.uri", deadline);
            await krc20.voteProposal(1, true);
            await krc20.connect(member1).voteProposal(1, true);
            await krc20.claimProposal(1);
            await advanceTime(WAIT_8_DAYS);
            await krc20.claimRewards();

            const ownerFinalBalance = await ethers.provider.getBalance(owner.address);
            const member1FinalBalance = await ethers.provider.getBalance(member1.address);
            const member2FinalBalance = await ethers.provider.getBalance(member2.address);

            expect(ownerFinalBalance - ownerInitBalance).to.above(((amountToSend / 3.5) * 2) * 58 / 100);
            expect(member1FinalBalance - member1InitBalance).to.above((amountToSend / 3.5) * 58 / 100);

            expect(await ethers.provider.getBalance(investorVault.address)).to.above(BigInt(amountToSend * 38 / 100));
        });
    });
});

async function advanceTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
}

async function setTimestamp(timestamp) {
    await ethers.provider.send("evm_mine", [timestamp]);
}

async function getDeadline(offsetSecond) {
    const block = await ethers.provider.getBlock("latest");
    const timestamp = block.timestamp;
    return timestamp + offsetSecond;
}

