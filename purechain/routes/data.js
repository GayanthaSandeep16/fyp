const express = require('express');
const router = express.Router();
const IPFS = require('ipfs-http-client');
const Web3 = require('web3');

const ipfs = IPFS.create({ url: process.env.IPFS_URL });
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.GANACHE_RPC_URL));
const contract = new web3.eth.Contract(require('../contracts/Contract.json').abi, process.env.CONTRACT_ADDRESS);

// 1. Data Submission Endpoint
router.post('/submit-data', async (req, res) => {
  const { data } = req.body;
  if (!validateData(data)) {
    return res.status(400).json({ message: 'Data validation failed' });
  }
  try {
    const ipfsResult = await ipfs.add(JSON.stringify(data));
    const ipfsHash = ipfsResult.path;
    const tx = await contract.methods.submitData(ipfsHash, true).send({
      from: process.env.ACCOUNT_ADDRESS,
      gas: 3000000
    });
    res.json({ message: 'Data submitted successfully', ipfsHash, transactionHash: tx.transactionHash });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. Health Check Endpoint
router.get('/health', async (req, res) => {
  try {
    const ipfsHealth = await ipfs.id();
    const ganacheHealth = await web3.eth.net.isListening();
    res.json({
      status: 'healthy',
      ipfs: ipfsHealth ? 'connected' : 'not connected',
      ganache: ganacheHealth ? 'connected' : 'not connected'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'unhealthy', error: 'Connection issues detected' });
  }
});

// 3. Retrieve Data Result Endpoint
router.get('/result/:ipfsHash', async (req, res) => {
  const { ipfsHash } = req.params;
  try {
    const data = await ipfs.cat(ipfsHash);
    const events = await contract.getPastEvents('DataSubmitted', {
      filter: { ipfsHash },
      fromBlock: 0,
      toBlock: 'latest'
    });
    if (events.length === 0) {
      return res.status(404).json({ message: 'No transaction found for given IPFS hash' });
    }
    res.json({
      data: JSON.parse(data.toString()),
      transactionHash: events[0].transactionHash
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Could not retrieve data result' });
  }
});

// Validation function for data
function validateData(data) {
  // Implement your data validation logic here
  return data && typeof data === 'object';
}

module.exports = router;
