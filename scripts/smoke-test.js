const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");

    if (!fs.existsSync(deploymentPath)) {
        throw new Error("Missing deployments/localhost.json. Deploy the contracts first.");
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const [, invitedUser] = await hre.ethers.getSigners();
    const fileStorage = await hre.ethers.getContractAt(
        "FileStorage",
        deployment.fileStorageAddress
    );
    const accessControl = await hre.ethers.getContractAt(
        "AccessControl",
        deployment.accessControlAddress
    );

    const uploadTx = await fileStorage.uploadFile("demoCID", "test.txt");
    await uploadTx.wait();

    const files = await fileStorage.getFiles();

    const grantTx = await accessControl.grantAccess(await invitedUser.getAddress());
    await grantTx.wait();
    const accessAfterGrant = await accessControl.checkAccess(
        files[0].owner,
        await invitedUser.getAddress()
    );

    const revokeTx = await accessControl.revokeAccess(await invitedUser.getAddress());
    await revokeTx.wait();
    const accessAfterRevoke = await accessControl.checkAccess(
        files[0].owner,
        await invitedUser.getAddress()
    );

    console.log(
        JSON.stringify(
            {
                files: files.map((file) => ({
                    cid: file.cid,
                    fileName: file.fileName,
                    owner: file.owner,
                    timestamp: file.timestamp.toString()
                })),
                invitedUser: await invitedUser.getAddress(),
                accessAfterGrant,
                accessAfterRevoke
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
