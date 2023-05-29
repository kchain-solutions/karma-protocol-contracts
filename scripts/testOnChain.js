const hre = require("hardhat");
const { ethers } = hre
const fs = require('fs');

const KRC20_ADDR = "0x211696c0F6e8Bfb95ecdbf91AF6656E68518056E"
const KRC721_FACTORY_ADDR = "0x2Cf301A50B774C81730b54DBFa488C6BB0534FAD"
const KRC20_ABI = JSON.parse(fs.readFileSync("./abis/KRC20.json", 'utf8'))
const KRC721_FACTORY_ABI = JSON.parse(fs.readFileSync("./abis/KRC721Factory.json", 'utf8'))
const KRC721_ABI = JSON.parse(fs.readFileSync("./abis/KRC721.json", 'utf8'))
const provider = ethers.provider;

async function main() {
    const [owner, user] = await ethers.getSigners();
    console.log("Owner address with the account:", owner.address);
    console.log("Owner account balance: ", (await owner.getBalance()).toString());
    console.log("User address with the account:", user.address);
    console.log("User account balance: ", (await user.getBalance()).toString());

    const krc721Factory = new ethers.Contract(KRC721_FACTORY_ADDR, KRC721_FACTORY_ABI, owner);
    const krc20 = new ethers.Contract(KRC20_ADDR, KRC20_ABI, owner);

    console.log("\n\nDeploying NFT KRC721...");
    await krc721Factory.addAuthorizedCreator(owner.address);
    await sleep(5000);
    await krc721Factory.createKRC721(owner.address, "KarmaNFT", "KRM", 10, 40, 5, KRC20_ADDR);
    const event = await readEvent(krc721Factory, "KRC721Created");
    const krc721Addr = event.args[0];
    console.log("  krc721Addr ", krc721Addr);

    console.log("\n\nManaging KRC20 proposal to authorize nft to mint erc20...");
    await krc20.addContractProposal(krc721Addr, "Proposal name", "prop.uri", Math.floor(Date.now() / 1000) + 2000);
    const proposalEvent = await readEvent(krc20, "NewProposal");
    const proposalId = proposalEvent.args[0].toNumber();
    console.log("  proposalId ", proposalId);
    console.log("  Waiting for voting and approving 60 secs...")
    await sleep(20000);
    await krc20.voteProposal(proposalId, true);
    console.log("  Proposal created...")
    await sleep(40000);
    await krc20.claimProposal(proposalId);
    console.log("  Proposal approved...")

    console.log("\n\nMinting, selling and buying KRC721");
    const krc721Owner = new ethers.Contract(krc721Addr, KRC721_ABI, owner);
    const krc721user = new ethers.Contract(krc721Addr, KRC721_ABI, user);
    console.log(krc721Owner.address, krc721user.address)
    console.log("  Minting token...")
    await krc721Owner.mintWithTokenURI(owner.address, "token.uri");
    await sleep(20000);
    const tokenId = 1
    console.log("  tokenId minted", tokenId);
    console.log("  waiting for selling and buying ...")
    const tokenPrice = 10000;
    console.log("  Setting sale price of the token 10 secs...")
    await sleep(10000);
    await krc721Owner.setSalePrice(tokenId, tokenPrice);
    console.log("  Buying the token wait 40 secs...")
    await sleep(40000);
    await krc721user.buy(tokenId, { value: tokenPrice });
}

async function readEvent(contract, eventName, fromBlock = 0, toBlock = 'latest') {
    try {
        const eventFilter = contract.filters[eventName](); // Replace eventName with the name of the event you want to query
        eventFilter.fromBlock = fromBlock;
        eventFilter.toBlock = toBlock;
        const events = await provider.getLogs(eventFilter);
        const parsedEvents = events.map((event) => contract.interface.parseLog(event));
        const parsedEvent = parsedEvents[0];
        console.log("EVENT: ", eventName, "\n", parsedEvent)
        return parsedEvent;
    } catch (error) {
        console.error('Error:', error);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
