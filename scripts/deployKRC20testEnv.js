const hre = require("hardhat");

function toBigNumber(tokens) {
    return ethers.BigNumber.from(tokens).mul(ethers.BigNumber.from(10).pow(18));
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.clear();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance: ", (await deployer.getBalance()).toString());

    const WAIT_BLOCK_CONFIRMATIONS = 6;

    const name = "KARMA";
    const symbol = "KRM";
    const quorum = 30;

    const rate = 100;

    console.log("Deploying contracts...")
    console.log("\n\n -- USDT CONTRACT -- \n");
    const TestERC20 = await ethers.getContractFactory("TestToken");
    const testERC20 = await TestERC20.deploy(deployer.address, toBigNumber(10000000000));
    await testERC20.deployed();
    console.log(`USDT Contract deployed to ${testERC20.address} on ${network.name}`);

    console.log("\n\n -- GLDKRC20 CONTRACT -- \n");
    const GLDKRC20 = await ethers.getContractFactory("GLDKRC20");
    const gldkrc20 = await GLDKRC20.deploy(deployer.address, toBigNumber(80000000), deployer.address, toBigNumber(20000000));
    await gldkrc20.deployed();
    console.log(`GLDKRC20 Contract deployed to ${gldkrc20.address} on ${network.name}`);

    console.log("\n\n -- Investor Vault CONTRACT-- \n");
    const InvestorVault = await ethers.getContractFactory("InvestorVault");
    const investorVault = await InvestorVault.deploy(gldkrc20.address, testERC20.address, rate, deployer.address);
    console.log("\nWaiting for ", WAIT_BLOCK_CONFIRMATIONS, " confimations...");
    const gldReceipt = await investorVault.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);
    await gldkrc20.connect(deployer).transfer(investorVault.address, toBigNumber(80000000));
    console.log(`InvestorVault Contract deployed to ${investorVault.address} on ${network.name}`);
    console.log(`InvestorVault Contract deployed at block number: ${gldReceipt.blockNumber}`);

    console.log("\n\n -- KRC20 CONTRACT -- \n");
    const KRC20 = await ethers.getContractFactory("KRC20");
    const krc20 = await KRC20.deploy(name, symbol, quorum, investorVault.address);
    console.log("\nWaiting for ", WAIT_BLOCK_CONFIRMATIONS, " confimations...");
    const receipt = await krc20.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);
    console.log(`KRC20 Contract deployed to ${krc20.address} on ${network.name}`);
    console.log(`KRC20 Contract deployed at block number: ${receipt.blockNumber}`);

    console.log(`\n\nVerifying contract on Etherscan...`);
    await run(`verify:verify`, {
        address: gldkrc20.address,
        constructorArguments: [deployer.address, toBigNumber(80000000), deployer.address, toBigNumber(20000000)],
        contract: "contracts/GLDKRC20.sol:GLDKRC20",
    });

    await run(`verify:verify`, {
        address: investorVault.address,
        constructorArguments: [gldkrc20.address, testERC20.address, rate, deployer.address],
    });

    await run(`verify:verify`, {
        address: krc20.address,
        constructorArguments: [name, symbol, quorum, investorVault.address],
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

