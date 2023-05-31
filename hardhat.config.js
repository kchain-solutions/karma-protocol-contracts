require("@nomicfoundation/hardhat-toolbox");
//const { utils } = require('ethers');
require('dotenv').config();

const MNEMONIC = process.env.MNEMONIC;
const SEPOLIA_ENDPOINT = process.env.SEPOLIA_ENDPOINT;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const KRC20_ADDRESS = process.env.KRC20_ADDRESS;

function accounts() {
  return { mnemonic: MNEMONIC };
}

task("vote-proposal", "Calls the voteProposal and claimProposal functions")
  .addParam("proposalid", "The ID of the proposal to vote and claim")
  .addParam("approve", " Boolean to approve or disapprove the vote")
  .setAction(async taskArgs => {
    console.log("Please wait...")
    const proposalId = BigInt(taskArgs.proposalid);
    const approve = taskArgs.approve;
    const KRC20 = await ethers.getContractFactory("KRC20");
    const instance = KRC20.attach(KRC20_ADDRESS);
    const voteTx = await instance.voteProposal(proposalId, approve);
    await voteTx.wait();
    console.log(`Voted on proposal ${Number(proposalId)} with approval status ${approve}`);
    const claimTx = await instance.claimProposal(proposalId);
    await claimTx.wait();
    console.log(`Claimed proposal ${Number(proposalId)}`);
  });

task("get-proposal", "Calls the voteProposal and claimProposal functions")
  .addParam("proposalid", "The ID of the proposal to vote and claim")
  .setAction(async taskArgs => {
    console.log("Please wait...")
    const proposalId = BigInt(taskArgs.proposalid);
    const KRC20 = await ethers.getContractFactory("KRC20");
    const instance = KRC20.attach(KRC20_ADDRESS);
    const response = await instance.proposals(proposalId);
    console.log(`Proposal:\n\n ${response}`);
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  networks: {
    sepolia: {
      gas: "auto",
      gasPrice: "auto",
      url: SEPOLIA_ENDPOINT,
      accounts: accounts()
    }
  },
  mocha: {
    quiet: true
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    }
  }
};