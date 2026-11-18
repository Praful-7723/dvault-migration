const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const deployDir = path.join(__dirname, "..", "deployments");
    const deployPath = path.join(deployDir, "localhost.json");
    const previous = fs.existsSync(deployPath)
        ? JSON.parse(fs.readFileSync(deployPath, "utf8"))
        : {};

    async function getOrDeploy(name, address) {
        if (hre.ethers.isAddress(address)) {
            const artifact = await hre.artifacts.readArtifact(name);
            const deployedCode = await hre.ethers.provider.getCode(address);
            if (deployedCode === artifact.deployedBytecode) {
                console.log(`${name} already deployed at ${address}`);
                return { address };
            }
            if (deployedCode !== "0x") {
                throw new Error(`The saved ${name} address contains different code. Keep the old deployment record before moving to a new registry.`);
            }
        }
        const factory = await hre.ethers.getContractFactory(name, deployer);
        const instance = await factory.deploy();
        const receipt = await instance.deploymentTransaction().wait();
        const deployed = await instance.getAddress();
        console.log(`${name} deployed at ${deployed}`);
        return { address: deployed, block: receipt.blockNumber };
    }

    const files = await getOrDeploy("FileStorage", previous.fileStorageAddress);
    const access = await getOrDeploy("AccessControl", previous.accessControlAddress);
    const vault = await getOrDeploy("VersionVault", previous.versionVaultAddress);

    fs.mkdirSync(deployDir, { recursive: true });
    fs.writeFileSync(deployPath, JSON.stringify({
        network: "localhost",
        deployer: deployer.address,
        fileStorageAddress: files.address,
        accessControlAddress: access.address,
        versionVaultAddress: vault.address,
        versionVaultStartBlock: vault.block ?? previous.versionVaultStartBlock ?? 0,
        deployedAt: new Date().toISOString()
    }, null, 2));
    require("./syncFrontendConfig");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
