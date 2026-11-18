// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AccessControl {
    mapping(address => mapping(address => bool)) private accessPermissions;

    event AccessGranted(address indexed owner, address indexed user);
    event AccessRevoked(address indexed owner, address indexed user);

    function grantAccess(address user) external {
        require(user != address(0), "Invalid user");
        require(user != msg.sender, "Self access is implicit");

        accessPermissions[msg.sender][user] = true;
        emit AccessGranted(msg.sender, user);
    }

    function revokeAccess(address user) external {
        require(user != address(0), "Invalid user");

        accessPermissions[msg.sender][user] = false;
        emit AccessRevoked(msg.sender, user);
    }

    function checkAccess(
        address owner,
        address user
    ) external view returns (bool) {
        if (owner == user) {
            return true;
        }

        return accessPermissions[owner][user];
    }
}
