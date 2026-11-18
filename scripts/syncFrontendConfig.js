const fs = require("fs");
const path = require("path");
require("dotenv").config();

const rootDir = path.resolve(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const deploymentsDir = path.join(rootDir, "deployments");
const deploymentPath = path.join(deploymentsDir, "localhost.json");
const frontendConfigPath = path.join(frontendDir, "config.js");

function readJson(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getAbi(contractName) {
    const artifactPath = path.join(
        rootDir,
        "artifacts",
        "contracts",
        `${contractName}.sol`,
        `${contractName}.json`
    );
    const artifact = readJson(artifactPath);
    return artifact?.abi ?? [];
}

function main() {
    fs.mkdirSync(frontendDir, { recursive: true });

    const deployment = readJson(deploymentPath) || {};

    const config = {
        fileStorageAddress: deployment.fileStorageAddress || "",
        accessControlAddress: deployment.accessControlAddress || "",
        fileStorageAbi: getAbi("FileStorage"),
        accessControlAbi: getAbi("AccessControl"),
        versionVaultAddress: deployment.versionVaultAddress || "",
        versionVaultAbi: getAbi("VersionVault"),
        versionVaultStartBlock: deployment.versionVaultStartBlock ?? 0,
        pinataGateway:
            process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs/",
        localhostRpcUrl:
            process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
        chainId: 31337
    };

    const output = `window.BLOCKCHAIN_DRIVE_CONFIG = ${JSON.stringify(
        config,
        null,
        2
    )};\n`;

    fs.writeFileSync(frontendConfigPath, output);
    console.log(`Frontend config updated at ${frontendConfigPath}`);
}

main();
