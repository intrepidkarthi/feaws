require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-gas-reporter");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: process.env.FORK_MAINNET === 'true' ? {
        url: process.env.MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
        blockNumber: 18500000, // Pin to specific block for consistency
      } : undefined,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: 20000000000, // 20 gwei
    },
    etherlink: {
      url: process.env.ETHERLINK_RPC_URL || "https://node.ghostnet.etherlink.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 128123,
      gasPrice: 1000000000, // 1 gwei
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      etherlink: process.env.ETHERLINK_API_KEY || "",
    },
    customChains: [
      {
        network: "etherlink",
        chainId: 128123,
        urls: {
          apiURL: "https://explorer.ghostnet.etherlink.com/api",
          browserURL: "https://explorer.ghostnet.etherlink.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20,
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
