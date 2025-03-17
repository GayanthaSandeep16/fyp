import Web3 from 'web3';
import { successResponse, errorResponse } from '../utils/responseHandler.js';

const web3 = new Web3(process.env.WEB3_PROVIDER || 'HTTP://127.0.0.1:7585');


// Check the status of the Web3 connection
export const getWeb3Status = async (req, res) => {
  try {
    const block = await web3.eth.getBlockNumber();
    const accounts = await web3.eth.getAccounts();

    successResponse(res, {
      connected: true,
      blockNumber: block,
      accountCount: accounts.length,
      currentProvider: web3.currentProvider.constructor.name
    });

  } catch (error) {
    errorResponse(res, 'Web3 connection failed', 500);
  }
};

export default { getWeb3Status };
