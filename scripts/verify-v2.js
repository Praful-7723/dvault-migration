const assert = require("node:assert/strict");
const hre = require("hardhat");

async function main() {
    const { ethers, network } = hre;
    const { sealFile, sealLabel, openFile, openLabel, digestEnvelope,
        generateRecoveryKey, importRecoveryKey, randomDocumentId } = await import("../frontend/v2/crypto.mjs");
    const [owner, outsider] = (await ethers.getSigners()).slice(5, 7);
    const live = network.name === "localhost";
    const vault = live
        ? await ethers.getContractAt("VersionVault", require("../deployments/localhost.json").versionVaultAddress, owner)
        : await ethers.deployContract("VersionVault", [], owner);
    await vault.waitForDeployment();
    const address = await vault.getAddress();
    const ownerAddress = await owner.getAddress();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const id = randomDocumentId();
    const scope = (revision) => ({ chainId, contract: address, owner: ownerAddress, documentId: id, revision });
    const privateLabel = "acceptance-private-label.txt";
    const key = await importRecoveryKey(generateRecoveryKey());
    const wrongKey = await importRecoveryKey(generateRecoveryKey());
    const title = await sealLabel(key, scope(1), privateLabel);
    assert.equal(await openLabel(key, scope(1), title), privateLabel);
    await assert.rejects(openLabel(wrongKey, scope(1), title));

    const origin = process.env.DVAULT_VERIFY_ORIGIN || "http://127.0.0.1:4174";
    const samples = ["Acceptance sample revision one", "Acceptance sample revision two"];
    const proofs = [];
    for (const [index, text] of samples.entries()) {
        const revision = index + 1;
        const file = new File([text], privateLabel, { type: "text/plain" });
        const envelope = await sealFile(key, scope(revision), file, "Synthetic acceptance test");
        const another = await sealFile(key, scope(revision), file);
        assert.notDeepEqual(envelope, another);
        assert(!Buffer.from(envelope).includes(privateLabel));
        assert(!Buffer.from(envelope).includes(text));
        const digest = await digestEnvelope(envelope);
        let cid = "bafy" + String(revision).repeat(55);
        if (live) {
            const response = await fetch(origin + "/api/v2/upload", {
                method: "POST", headers: { Origin: origin, "Content-Type": "application/octet-stream" },
                body: envelope, signal: AbortSignal.timeout(60_000)
            });
            assert.equal(response.status, 200, "Pinata upload should succeed");
            ({ cid } = await response.json());
            console.log(`Pinned encrypted sample v${revision}: ${cid}`);
        }
        const tx = revision === 1
            ? await vault.createDocument(id, title, cid, digest)
            : await vault.appendVersion(id, revision - 1, cid, digest);
        assert.equal((await tx.wait()).status, 1);
        proofs.push({ cid, digest, envelope, txHash: tx.hash });
    }

    const [versions, count] = await vault.listVersions(id, 0, 10);
    assert.equal(count, 2n);
    assert.deepEqual(versions.map(({ digest }) => digest), [proofs[1].digest, proofs[0].digest]);
    const [docs] = await vault.listDocuments(ownerAddress, 0, 10);
    assert(docs.some((doc) => doc.id === id && doc.versionCount === 2n));
    await assert.rejects(vault.connect(outsider).appendVersion.staticCall(id, 2, proofs[0].cid, proofs[0].digest), /NotOwner/);
    await assert.rejects(vault.appendVersion.staticCall(id, 1, proofs[0].cid, proofs[0].digest), /RevisionChanged/);
    await assert.rejects(vault.createDocument.staticCall(id, title, proofs[0].cid, proofs[0].digest), /DocumentExists/);

    for (const [index, proof] of proofs.entries()) {
        const revision = index + 1;
        let bytes = proof.envelope;
        if (live) {
            const response = await fetch(origin + "/api/v2/blob/" + proof.cid, { signal: AbortSignal.timeout(50_000) });
            assert.equal(response.status, 200, "IPFS gateway should return the pinned ciphertext");
            bytes = new Uint8Array(await response.arrayBuffer());
            assert.deepEqual(bytes, proof.envelope);
        }
        const result = await openFile(key, scope(revision), bytes, proof.digest);
        assert.equal(await result.blob.text(), samples[index]);
        assert.equal(result.metadata.name, privateLabel);
        assert.equal(result.metadata.note, "Synthetic acceptance test");
        const tampered = bytes.slice();
        tampered[tampered.length - 1] ^= 1;
        await assert.rejects(openFile(key, scope(revision), tampered, proof.digest), /Integrity check failed/);
        await assert.rejects(openFile(wrongKey, scope(revision), bytes, proof.digest), /cannot decrypt/);
        await assert.rejects(openFile(key, scope(revision + 1), bytes, proof.digest), /cannot decrypt/);

        const [event] = await vault.queryFilter(vault.filters.VersionRecorded(ownerAddress, id, revision), 0, "latest");
        assert.equal(event.transactionHash, proof.txHash);
        assert.equal(event.args.cid, proof.cid);
        assert.equal(event.args.digest, proof.digest);
    }
    console.log(`V2 verification passed (${live ? "real Pinata, IPFS gateway, and local node" : "isolated Hardhat chain and Web Crypto"}).`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
