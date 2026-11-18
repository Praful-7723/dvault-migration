// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice An append-only registry for encrypted payloads. All stored values and
/// events are public. The client must encrypt both bytes and private metadata.
contract VersionVault {
    struct Version {
        string cid;
        bytes32 digest;
        uint64 timestamp;
    }

    struct Document {
        address owner;
        bytes sealedLabel;
        Version[] versions;
    }

    struct Summary {
        bytes32 id;
        bytes sealedLabel;
        uint256 versionCount;
        uint64 updatedAt;
    }

    mapping(bytes32 => Document) private documents;
    mapping(address => bytes32[]) private idsByOwner;

    error DocumentExists();
    error NotOwner();
    error InvalidProof();
    error RevisionChanged(uint256 current);
    error InvalidPage();

    event VersionRecorded(
        address indexed owner,
        bytes32 indexed documentId,
        uint256 indexed revision,
        string cid,
        bytes32 digest
    );

    function createDocument(
        bytes32 id,
        bytes calldata sealedLabel,
        string calldata cid,
        bytes32 digest
    ) external {
        Document storage doc = documents[id];
        if (doc.owner != address(0)) revert DocumentExists();
        // 12-byte IV, 128-byte fixed-size label, 16-byte AES-GCM tag.
        if (id == bytes32(0) || sealedLabel.length != 156) revert InvalidProof();
        doc.owner = msg.sender;
        doc.sealedLabel = sealedLabel;
        idsByOwner[msg.sender].push(id);
        _append(doc, id, cid, digest);
    }

    function appendVersion(
        bytes32 id,
        uint256 expectedRevision,
        string calldata cid,
        bytes32 digest
    ) external {
        Document storage doc = documents[id];
        if (doc.owner != msg.sender) revert NotOwner();
        if (doc.versions.length != expectedRevision) revert RevisionChanged(doc.versions.length);
        _append(doc, id, cid, digest);
    }

    function _append(Document storage doc, bytes32 id, string calldata cid, bytes32 digest) private {
        uint256 length = bytes(cid).length;
        if (length < 46 || length > 100 || digest == bytes32(0)) revert InvalidProof();
        doc.versions.push(Version(cid, digest, uint64(block.timestamp)));
        emit VersionRecorded(msg.sender, id, doc.versions.length, cid, digest);
    }

    function getDocument(bytes32 id) external view returns (address owner, bytes memory sealedLabel, uint256 count) {
        Document storage doc = documents[id];
        return (doc.owner, doc.sealedLabel, doc.versions.length);
    }

    function listDocuments(address owner, uint256 offset, uint256 limit)
        external view returns (Summary[] memory page, uint256 total)
    {
        bytes32[] storage ids = idsByOwner[owner];
        total = ids.length;
        uint256 length = _pageLength(total, offset, limit);
        page = new Summary[](length);
        for (uint256 i; i < length; ++i) {
            bytes32 id = ids[total - offset - i - 1];
            Document storage doc = documents[id];
            uint256 count = doc.versions.length;
            page[i] = Summary(id, doc.sealedLabel, count, doc.versions[count - 1].timestamp);
        }
    }

    function getVersion(bytes32 id, uint256 revision) external view returns (Version memory) {
        return documents[id].versions[revision - 1];
    }

    function listVersions(bytes32 id, uint256 offset, uint256 limit)
        external view returns (Version[] memory page, uint256 total)
    {
        Version[] storage versions = documents[id].versions;
        total = versions.length;
        uint256 length = _pageLength(total, offset, limit);
        page = new Version[](length);
        for (uint256 i; i < length; ++i) {
            page[i] = versions[total - offset - i - 1];
        }
    }

    function _pageLength(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256) {
        if (limit == 0 || limit > 50) revert InvalidPage();
        if (offset >= total) return 0;
        uint256 remaining = total - offset;
        return remaining < limit ? remaining : limit;
    }
}
