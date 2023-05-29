const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = ethers.utils;

describe("KRC721", function () {
    let KRC721, krc721, krc721NA, KRC20, krc20, investorVault, testERC20, gldkrc20, owner, addr1, addr2, beneficiary, investor, fundReceiver;

    beforeEach(async () => {
        [owner, addr1, addr2, beneficiary, investor, fundReceiver] = await ethers.getSigners();

        const GLDKRC20 = await ethers.getContractFactory("GLDKRC20");
        gldkrc20 = await GLDKRC20.deploy(owner.address, 900, addr1.address, 100);
        await gldkrc20.deployed();

        // Deploy an ERC20 token for testing
        const TestERC20 = await ethers.getContractFactory("TestToken");
        testERC20 = await TestERC20.deploy(investor.address, 100);
        await testERC20.deployed();


        const InvestorVault = await ethers.getContractFactory("InvestorVault");
        investorVault = await InvestorVault.deploy(gldkrc20.address, testERC20.address, 2, fundReceiver.address);
        await investorVault.deployed();

        KRC20 = await ethers.getContractFactory("KRC20");
        krc20 = await KRC20.deploy("Karma", "KRC", 30, investorVault.address);
        await krc20.deployed();
        KRC721 = await ethers.getContractFactory("KRC721");
        krc721 = await KRC721.deploy(owner.address, "TestToken", "TT", 100, 10, 5, 5, beneficiary.address, krc20.address, true);
        krc721NA = await KRC721.deploy(owner.address, "TestToken", "TT", 100, 10, 1, 5, beneficiary.address, ethers.constants.AddressZero, false);
        await krc721.deployed();
    });

    describe("mintWithTokenURI", () => {
        it("Should mint a new token with the specified tokenURI", async () => {
            await expect(krc20.addContractProposal(krc721.address, "Prop name", "uri", await getDeadline(1500)))
                .to.emit(krc20, "NewProposal");
            await expect(krc20.voteProposal(0, true))
                .to.emit(krc20, "Vote");
            await expect(krc20.claimProposal(0)).to.emit(krc20, "ApprovedProposal");
            expect(await krc20.isAuthorizedContract(krc721.address)).to.be.true;

            const tokenURI = "ipfs://testURI";
            await krc721.mintWithTokenURI(addr1.address, tokenURI);

            const ownerOfToken = await krc721.ownerOf(1);
            const tokenUriOfToken = await krc721.tokenURI(1);

            expect(ownerOfToken).to.equal(addr1.address);
            expect(tokenUriOfToken).to.equal(tokenURI);
        });

        it("Should revert if max supply is reached", async () => {
            await expect(krc20.addContractProposal(krc721.address, "Prop name", "uri", await getDeadline(2000)))
                .to.emit(krc20, "NewProposal");
            await expect(krc20.voteProposal(0, true))
                .to.emit(krc20, "Vote");
            await expect(krc20.claimProposal(0)).to.emit(krc20, "ApprovedProposal");
            expect(await krc20.isAuthorizedContract(krc721.address)).to.be.true;
            const tokenURI = "ipfs://testURI";
            const maxSupply = 100;
            for (let i = 1; i < maxSupply; i++) {
                await krc721.mintWithTokenURI(addr1.address, tokenURI);
            }
            await expect(krc721.mintWithTokenURI(addr1.address, tokenURI)).to.be.revertedWith(
                "Collection supply reached"
            );
        });

        it("Should burn token when they are transfered", async () => {
            expect(await krc20.isAuthorizedContract(krc721.address)).to.be.false;
            await expect(krc20.addContractProposal(krc721.address, "Prop name", "uri", await getDeadline(2000)))
                .to.emit(krc20, "NewProposal");
            await expect(krc20.voteProposal(0, true))
                .to.emit(krc20, "Vote");
            await expect(krc20.claimProposal(0)).to.emit(krc20, "ApprovedProposal");
            expect(await krc20.isAuthorizedContract(krc721.address)).to.be.true;
            const tokenURI = "ipfs://testURI";
            const toMint = 10;
            for (let i = 0; i < toMint; i++) {
                await krc721.connect(owner).mintWithTokenURI(owner.address, tokenURI);
                await krc721.connect(owner).setSalePrice(i + 1, ethers.BigNumber.from(BigInt(10 ** 15)));
                await krc721.connect(addr1).buy(i + 1, { value: ethers.BigNumber.from(BigInt(10 ** 15)) });
            }
            let amount = await krc20.balanceOf(addr1.address);
            amount = ethers.BigNumber.from(amount);
            await krc20.connect(addr1).transfer(addr2.address, amount);
            expect(await krc20.balanceOf(addr2.address)).to.equal(BigInt(2 * 10 ** 18));
            expect(await krc20.balanceOf(owner.address)).to.equal(BigInt(10 * 10 ** 18));
        });

        it("Should update gallery", async () => {
            const tokenURI = "ipfs://testURI";
            await krc721.mintWithTokenURI(addr1.address, tokenURI);
            await expect(krc721.collectionGalleryUpdate("1", "GalleryUpdate")).to.emit(krc721, "CollectionGalleryUpdate");
            await expect(krc721.collectionGalleryUpdate(1, "GalleryUpdate2")).to.emit(krc721, "CollectionGalleryUpdate");
            const response = await krc721.getCollectionGallery(1);
            expect(response.includes("GalleryUpdate")).to.equal(true);
            expect(response.length).to.equal(2);
        });

        it("Should return unauthorized value", async () => {
            expect(await krc20.isAuthorizedContract(krc721.address)).to.be.false;
        });

        it("Should buy collection", async () => {
            expect(await krc721.owner()).to.not.equal(addr1.address);
            await krc721.setCollectionPrice(10000);
            await krc721.connect(addr1).buyCollection({ value: 10000 });
            expect(await krc721.owner()).to.equal(addr1.address);
        });

        it("Should not buy collection (insufficient amount)", async () => {
            expect(await krc721.owner()).to.not.equal(addr1.address);
            await krc721.setCollectionPrice(10000);
            await expect(krc721.connect(addr1).buyCollection({ value: 1000 })).to.be.revertedWith("Insufficient funds");
        });

        it("Should not buy collection (not for sale)", async () => {
            await expect(krc721.connect(addr1).buyCollection({ value: 1000 })).to.be.revertedWith("Not for sale");
        });

    });

    async function getDeadline(offsetSecond) {
        const block = await ethers.provider.getBlock("latest");
        const timestamp = block.timestamp;
        return timestamp + offsetSecond;
    }

    async function advanceTime(seconds) {
        await ethers.provider.send("evm_increaseTime", [seconds]);
        await ethers.provider.send("evm_mine");
    }
});
