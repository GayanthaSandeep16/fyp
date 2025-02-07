const Web3 = require('web3');
const DataQualityArtifact = require('../../build/contracts/DataQuality.json');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const web3 = new Web3(process.env.WEB3_PROVIDER || 'HTTP://127.0.0.1:7545');


// exports.getWeb3Status = async (req, res) => {
//   try {
//     const block = await web3.eth.getBlockNumber();
//     const accounts = await web3.eth.getAccounts();
    
//     successResponse(res, {
//       connected: true,
//       blockNumber: block,
//       accountCount: accounts.length,
//       currentProvider: web3.currentProvider.constructor.name
//     });
    
//   } catch (error) {
//     errorResponse(res, 'Web3 connection failed', 500);
//   }
// };

export const getWeb3Status = (req, res) => {
    const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_PROVIDER));
    web3.eth.net.isListening()
        .then(() => res.status(200).json({ status: 'Web3 is connected' }))
        .catch(() => res.status(500).json({ status: 'Web3 is not connected' }));
};