require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

module.exports = {
    solidity: "0.8.24",
    networks: {
        localhost: {
            url: process.env.LOCALHOST_RPC_URL || "http://127.0.0.1:8545",
            chainId: 31337
        }
    }
};
