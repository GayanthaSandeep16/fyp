import Web3 from 'web3';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import { 
  submitDataToContract,
  penalizeUser,
  getTransactionDetails,
  getReputationService,
  getUserDetails 
} from '../services/blockchain.service.js';

const web3 = new Web3(process.env.WEB3_PROVIDER || 'HTTP://127.0.0.1:8545');


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
    errorResponse(res, `Web3 connection failed: ${error.message}`, 500);
  }
};

export const getReputation = async (req, res) => {
  const { walletAddress } = req.body;

  try {
    if (!walletAddress) {
      return errorResponse(res, 'Wallet address is required', 400);
    }

    if (!web3.utils.isAddress(walletAddress)) {
      return errorResponse(res, 'Invalid wallet address format', 400);
    }

    // Debug info
    console.log('Calling contract at:', process.env.CONTRACT_ADDRESS);
    console.log('Using provider:', process.env.WEB3_PROVIDER);
    console.log('Wallet address:', walletAddress);

    const reputation = await getReputationService(walletAddress);
    
    console.log('Reputation result:', reputation);
    
    successResponse(res, {
      walletAddress: reputation.walletAddress,
      reputation: reputation.reputation.toString()
    });
  } catch (error) {
    console.error('Reputation error details:', error);
    errorResponse(res, `Failed to fetch reputation: ${error.message}`, 500);
  }
};

// Get user details
export const fetchUserDetails = async (req, res) => {
  const { walletAddress } = req.body || req.query;

  try {
    if (!walletAddress) {
      return errorResponse(res, 'Wallet address is required', 400);
    }

    if (!web3.utils.isAddress(walletAddress)) {
      return errorResponse(res, 'Invalid wallet address format', 400);
    }

    const userDetails = await getUserDetails(walletAddress);
    successResponse(res, userDetails);
  } catch (error) {
    errorResponse(res, `Failed to fetch user details: ${error.message}`, 500);
  }
};

//check transaction 
export const checkTransaction = async (req, res) => {
  const { txHash } = req.body;

try {
    if (!txHash || typeof txHash !== 'string' || !txHash.startsWith('0x')) {
      return errorResponse(res, 'Valid transaction hash is required', 400);
    }
   
    const details = await getTransactionDetails(txHash);
    
    successResponse(res, {
      message: `Transaction successful in block #${details.blockNumber}`,
      transactionHash: details.transactionHash,
      from: details.from,
      status: details.status,
      events: details.events,
      gasUsed: details.gasUsed
    });
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

  export const checkBlacklistStatus = async (req, res) => {
    const { walletAddress } = req.body;
  
    try {
      if (!web3.utils.isAddress(walletAddress)) {
        return errorResponse(res, 'Valid wallet address is required', 400);
      }
  
      const isBlacklisted = await isUserBlacklisted(walletAddress);
      successResponse(res, {
        walletAddress,
        isBlacklisted
      });
    } catch (error) {
      errorResponse(res, error.message, 500);
    }
  };

