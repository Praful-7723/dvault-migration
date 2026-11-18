const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const destination = path.join(root, "demo-artifacts");
fs.mkdirSync(destination, { recursive: true });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const contracts = ["FileStorage", "AccessControl", "VersionVault"].map((name) => {
    const source = `contracts/${name}.sol`;
    const artifact = `${name}.json`;
    const bytes = fs.readFileSync(path.join(root, "artifacts", source, artifact));
    fs.writeFileSync(path.join(destination, artifact), bytes);
    return { source, sourceSha256: hash(fs.readFileSync(path.join(root, source))), artifact, artifactSha256: hash(bytes) };
});
fs.writeFileSync(path.join(destination, "manifest.json"), JSON.stringify({ solidity: "0.8.24", contracts }, null, 2) + "\n");
console.log("Bundled three portable demo artifacts with source and artifact checksums.");
