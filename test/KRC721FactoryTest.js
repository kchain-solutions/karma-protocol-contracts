const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils } = ethers;

let KRC721Factory, KRC721, factoryInstance, krc721Instance, owner, authorizedMember, unauthorizedMember, authorizedCreator, unauthorizedCreator, beneficiary, krc20Address;


describe("KRC721Factory", () => {

  beforeEach(async () => {
    KRC721Factory = await ethers.getContractFactory("KRC721Factory");
    KRC721 = await ethers.getContractFactory("KRC721");
    [owner, authorizedMember, unauthorizedMember, authorizedCreator, unauthorizedCreator, beneficiary] = await ethers.getSigners();

    const GLDKRC20 = await ethers.getContractFactory("GLDKRC20");
    const gldkrc20 = await GLDKRC20.deploy(owner.address, 900, owner.address, 100);
    await gldkrc20.deployed();

    // Deploy an ERC20 token for testing
    const TestERC20 = await ethers.getContractFactory("TestToken");
    const testERC20 = await TestERC20.deploy(owner.address, 100);
    await testERC20.deployed();

    const InvestorVault = await ethers.getContractFactory("InvestorVault");
    const investorVault = await InvestorVault.deploy(gldkrc20.address, testERC20.address, 2, owner.address);
    await investorVault.deployed();

    const name = "Karma";
    const symbol = "KRC";
    const quorum = 30;
    const KRC20 = await ethers.getContractFactory("KRC20");
    const krc20 = await KRC20.deploy(name, symbol, quorum, investorVault.address);
    await krc20.deployed();
    krc20Address = krc20.address;

    factoryInstance = await KRC721Factory.deploy(krc20Address);
    await factoryInstance.deployed();
    await factoryInstance.addAuthorizedMember(authorizedMember.address);
    await factoryInstance.addAuthorizedCreator(authorizedCreator.address);
  });

  it("Should deploy the KRC721Factory contract", async () => {
    expect(factoryInstance.address).to.not.be.null;
  });

  it("Should add and remove authorized members", async () => {
    expect(await factoryInstance.isAuthorizedMember(authorizedMember.address)).to.be.true;

    await factoryInstance.addAuthorizedMember(unauthorizedMember.address);
    expect(await factoryInstance.isAuthorizedMember(unauthorizedMember.address)).to.be.true;

    await factoryInstance.removeAuthorizedMember(unauthorizedMember.address);
    expect(await factoryInstance.isAuthorizedMember(unauthorizedMember.address)).to.be.false;
  });

  it("Should add and remove authorized creators", async () => {
    await factoryInstance.connect(authorizedMember).addAuthorizedCreator(unauthorizedCreator.address);
    expect(await factoryInstance.isAuthorizedCreator(unauthorizedCreator.address)).to.be.true;

    await factoryInstance.connect(authorizedMember).removeAuthorizedCreator(unauthorizedCreator.address);
    expect(await factoryInstance.isAuthorizedCreator(unauthorizedCreator.address)).to.be.false;
  });

  it("Should create a new KRC721 contract", async () => {
    const name = "KarmaCharity721";
    const symbol = "KRC";
    const maxCollectionSupply = 1000;
    const saleCommissionPercentage = 10;
    const krmCommissionPercentage = 1;
    const artistCommissionPercentage = 5;

    await expect(factoryInstance.connect(authorizedCreator).createKRC721(authorizedCreator.address, name, symbol, maxCollectionSupply, saleCommissionPercentage, krmCommissionPercentage, artistCommissionPercentage, beneficiary.address, false))
      .to.emit(factoryInstance, "NewKRC721");
  });
});
