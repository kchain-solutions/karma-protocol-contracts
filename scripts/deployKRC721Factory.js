const hre = require("hardhat");
const KRC20_ADDRESS = "0xD36E4bcc2CC27CC006CDF69bDf95e4ca3EF3E436"

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("--- > WARNING <---\nRemember to update the KRC_20 ADDRESS Variable!!!")
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance: ", (await deployer.getBalance()).toString());

  console.log("\n\n--- KRC721 DEPLOYING ---\n")
  const KRC721Factory = await ethers.getContractFactory("KRC721Factory");
  const krc721Factory = await KRC721Factory.deploy(KRC20_ADDRESS);


  const WAIT_BLOCK_CONFIRMATIONS = 6;
  console.log("\nWaiting for", WAIT_BLOCK_CONFIRMATIONS, " confimations...");
  const receipt = await krc721Factory.deployTransaction.wait(WAIT_BLOCK_CONFIRMATIONS);

  console.log(`Contract deployed to ${krc721Factory.address} on ${network.name}`);
  console.log(`Contract deployed at block number: ${receipt.blockNumber}`);

  console.log(`\nVerifying contract on Etherscan...`);
  await run(`verify:verify`, {
    address: krc721Factory.address,
    constructorArguments: [KRC20_ADDRESS]
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});