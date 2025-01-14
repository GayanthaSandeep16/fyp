module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      "gas": 8000000
    },
  },

  compilers: {
    solc: {
      version: "./node_modules/solc", // or "0.8.20", etc.
      settings: {
        optimizer: {
          enabled: false,
          runs: 200,
        },
        // evmVersion: "istanbul", // or another if needed
      },
    },
  },
};
