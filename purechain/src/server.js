require('dotenv').config();
const express = require('express');
const IPFS = require('ipfs-http-client');
const Web3 = require('web3');
const contractABI = require('../contracts/Contract.json').abi; // Ensure you export the ABI

const app = express();
app.use(express.json());

// Initialize IPFS client
const ipfs = IPFS.create({ url: process.env.IPFS_URL });

// Initialize Web3 and contract
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GANACHE_RPC_URL));
const contract = new web3.eth.Contract(contractABI, process.env.CONTRACT_ADDRESS);

// Middleware to handle routes
app.use('/api', require('../routes/data'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
