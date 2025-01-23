module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      gas: 6721975,
      gasPrice: 20000000000
    },
  },

  compilers: {
    solc: {
      version: "0.8.0", // or "0.8.20", etc.
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        // evmVersion: "istanbul", // or another if needed
      },
    },
  },
};
