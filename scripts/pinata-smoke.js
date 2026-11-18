const fs = require("fs");
const path = require("path");
const axios = require("axios");
const hre = require("hardhat");
require("dotenv").config();

async function uploadSampleToPinata(samplePath) {
    const fileContent = fs.readFileSync(samplePath);
    const authOptions = [];

    if (process.env.PINATA_JWT) {
        authOptions.push({
            Authorization: `Bearer ${process.env.PINATA_JWT}`
        });
    }

    if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY) {
        authOptions.push({
            pinata_api_key: process.env.PINATA_API_KEY,
            pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY
        });
    }

    let lastError;

    for (const headers of authOptions) {
        try {
            const formData = new FormData();
            formData.append(
                "file",
                new Blob([fileContent], { type: "text/plain" }),
                path.basename(samplePath)
            );
            formData.append(
                "pinataMetadata",
                JSON.stringify({
                    name: path.basename(samplePath)
                })
            );

            const response = await axios.post(
                "https://api.pinata.cloud/pinning/pinFileToIPFS",
                formData,
                {
                    headers,
                    maxBodyLength: Infinity
                }
            );

            return response.data.IpfsHash;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Pinata upload failed.");
}

async function main() {
    if (
        !process.env.PINATA_JWT &&
        (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY)
    ) {
        throw new Error("Pinata credentials are missing in .env");
    }

    const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
    if (!fs.existsSync(deploymentPath)) {
        throw new Error("Missing deployments/localhost.json. Deploy the contracts first.");
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const fileStorage = await hre.ethers.getContractAt(
        "FileStorage",
        deployment.fileStorageAddress
    );

    const samplesDir = path.join(__dirname, "..", "samples");
    fs.mkdirSync(samplesDir, { recursive: true });

    const samplePath = path.join(samplesDir, "pinata-demo.txt");
    const sampleBody = [
        "Blockchain Drive live Pinata verification",
        `Generated at: ${new Date().toISOString()}`,
        `Network: ${deployment.network}`,
        `Contract: ${deployment.fileStorageAddress}`
    ].join("\n");
    fs.writeFileSync(samplePath, `${sampleBody}\n`);

    const cid = await uploadSampleToPinata(samplePath);
    const tx = await fileStorage.uploadFile(cid, path.basename(samplePath));
    await tx.wait();

    const files = await fileStorage.getFiles();
    const matchedFile = files.find((file) => file.cid === cid);

    if (!matchedFile) {
        throw new Error("Uploaded CID was not found in the contract storage.");
    }

    console.log(
        JSON.stringify(
            {
                cid,
                fileName: matchedFile.fileName,
                owner: matchedFile.owner,
                timestamp: matchedFile.timestamp.toString(),
                gatewayUrl: `${process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs/"}${cid}`,
                samplePath
            },
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
