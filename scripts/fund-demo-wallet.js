const hre = require("hardhat");

async function main() {
    const { ethers, network } = hre;
    if (network.name !== "localhost" || !/^http:\/\/127\.0\.0\.1:8545\/?$/.test(network.config.url)) {
        throw new Error("This helper only funds a local Hardhat demo account at 127.0.0.1:8545.");
    }
    const recipient = process.env.DVAULT_DEMO_WALLET;
    if (!ethers.isAddress(recipient) || recipient === ethers.ZeroAddress) {
        throw new Error("Set DVAULT_DEMO_WALLET to the phone’s public 0x wallet address.");
    }
    if ((await ethers.provider.getNetwork()).chainId !== 31337n) throw new Error("Expected chain 31337.");
    const [funder] = await ethers.getSigners();
    const tx = await funder.sendTransaction({ to: recipient, value: ethers.parseEther("1") });
    await tx.wait();
    console.log(`Sent 1 local test ETH to ${recipient}.`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
