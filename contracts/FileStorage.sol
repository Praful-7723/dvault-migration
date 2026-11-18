// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FileStorage {
    struct StoredFile {
        string cid;
        string fileName;
        address owner;
        uint256 timestamp;
    }

    mapping(address => StoredFile[]) private filesByOwner;

    event FileUploaded(
        address indexed owner,
        string cid,
        string fileName,
        uint256 timestamp
    );

    function uploadFile(string memory _cid, string memory _fileName) external {
        require(bytes(_cid).length > 0, "CID is required");
        require(bytes(_fileName).length > 0, "File name is required");

        StoredFile memory newFile = StoredFile({
            cid: _cid,
            fileName: _fileName,
            owner: msg.sender,
            timestamp: block.timestamp
        });

        filesByOwner[msg.sender].push(newFile);

        emit FileUploaded(msg.sender, _cid, _fileName, block.timestamp);
    }

    function getFiles() external view returns (StoredFile[] memory) {
        return filesByOwner[msg.sender];
    }
}
