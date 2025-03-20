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

/**
 * getWeb3Status
 * Checks the status of the Web3 connection.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the Web3 connection status.
 */
export const getWeb3Status = async (req, res) => {
  try {
    const block = await web3.eth.getBlockNumber();
    const accounts = await web3.eth.getAccounts();

    successResponse(res, {
      connected: true,
      blockNumber: block,
      accountCount: accounts.length,
      currentProvider: web3.currentProvider.constructor.name,
    });
  } catch (error) {
    errorResponse(res, `Web3 connection failed: ${error.message}`, 500);
  }
};

/**
 * getReputation
 * Retrieves the reputation score of a user from the blockchain.
 * Requires authentication.
 * @param {Object} req - Express request object.
 * @param {string} req.body.walletAddress - Wallet address of the user.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the user's reputation.
 */
export const getReputation = async (req, res) => {
  const { walletAddress } = req.body;

  try {
    if (!walletAddress) {
      return errorResponse(res, 'Wallet address is required', 400);
    }

    if (!web3.utils.isAddress(walletAddress)) {
      return errorResponse(res, 'Invalid wallet address format', 400);
    }

    console.log('Calling contract at:', process.env.CONTRACT_ADDRESS);
    console.log('Using provider:', process.env.WEB3_PROVIDER);
    console.log('Wallet address:', walletAddress);

    const reputation = await getReputationService(walletAddress);
    
    console.log('Reputation result:', reputation);
    
    successResponse(res, {
      walletAddress: reputation.walletAddress,
      reputation: reputation.reputation.toString(),
    });
  } catch (error) {
    console.error('Reputation error details:', error);
    errorResponse(res, `Failed to fetch reputation: ${error.message}`, 500);
  }
};

/**
 * fetchUserDetails
 * Retrieves user details from the blockchain using their wallet address.
 * Requires authentication.
 * @param {Object} req - Express request object.
 * @param {string} req.body.walletAddress - Wallet address of the user.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the user's details.
 */
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

/**
 * checkTransaction
 * Checks the status of a blockchain transaction using its transaction hash.
 * Requires authentication.
 * @param {Object} req - Express request object.
 * @param {string} req.body.txHash - Transaction hash to check.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the transaction details.
 */
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
      gasUsed: details.gasUsed,
    });
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

/**
 * checkBlacklistStatus
 * Checks if a user is blacklisted on the blockchain using their wallet address.
 * Requires authentication.
 * @param {Object} req - Express request object.
 * @param {string} req.body.walletAddress - Wallet address of the user.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the blacklist status.
 */
export const checkBlacklistStatus = async (req, res) => {
  const { walletAddress } = req.body;

  try {
    if (!walletAddress) {
      return errorResponse(res, 'Wallet address is required', 400);
    }

    if (!web3.utils.isAddress(walletAddress)) {
      return errorResponse(res, 'Invalid wallet address format', 400);
    }

    const userDetails = await getUserDetails(walletAddress);
    const isBlacklisted = userDetails.isBlacklisted;

    successResponse(res, {
      walletAddress,
      isBlacklisted,
    });
  } catch (error) {
    errorResponse(res, `Failed to check blacklist status: ${error.message}`, 500);
  }
};