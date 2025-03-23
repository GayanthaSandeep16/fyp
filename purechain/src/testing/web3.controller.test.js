/**
 * web3.controller.test.js
 *
 * Demonstrates Jest-based tests for the functions in web3.controller.js,
 * ensuring each scenario is properly mocked so the code flows to
 * the expected success or error path.
 */

import { jest } from '@jest/globals';
import {
    getWeb3Status,
    getReputation,
    fetchUserDetails,
    checkTransaction,
} from '../controllers/web3.controller.js';
import Web3 from 'web3';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import {
    getReputationService,
    getUserDetails,
    getTransactionDetails,
} from '../services/blockchain.service.js';

// 1) Mock web3 so `new Web3(...)` returns our controlled object each time
jest.mock('web3', () => {
    return jest.fn().mockImplementation(() => ({
        eth: {
            getBlockNumber: jest.fn(),
            getAccounts: jest.fn(),
            getTransactionReceipt: jest.fn(),
        },
        utils: {
            isAddress: jest.fn(),
        },
        currentProvider: {
            constructor: { name: 'MockHttpProvider' },
        },
    }));
});

// 2) Mock successResponse, errorResponse
jest.mock('../utils/responseHandler.js', () => ({
    successResponse: jest.fn(),
    errorResponse: jest.fn(),
}));

// 3) Mock the blockchain services
jest.mock('../services/blockchain.service.js', () => ({
    getReputationService: jest.fn(),
    getUserDetails: jest.fn(),
    getTransactionDetails: jest.fn(),
    submitDataToContract: jest.fn(),
    penalizeUser: jest.fn(),
}));

describe('web3.controller', () => {
    let mockReq;
    let mockRes;
    let mockWeb3;

    beforeEach(() => {
        jest.clearAllMocks();

        // Each test calling e.g. getWeb3Status() will do `new Web3(...)`,
        // returning this mockWeb3 object.
        mockWeb3 = new Web3();

        // Minimal default stubs
        mockWeb3.eth.getBlockNumber.mockResolvedValue(123);
        mockWeb3.eth.getAccounts.mockResolvedValue(['0xaaa', '0xbbb']);
        mockWeb3.utils.isAddress.mockReturnValue(true);

        // Minimal Express-like response
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        // successResponse => res.status(200).json(...)
        successResponse.mockImplementation((resObj, data) => {
            resObj.status(200).json(data);
        });

        // errorResponse => res.status(code).json({ message })
        errorResponse.mockImplementation((resObj, msg, code) => {
            resObj.status(code).json({ message: msg });
        });
    });



    // ------------------------------
    //  getReputation
    // ------------------------------
    describe('getReputation', () => {
        beforeEach(() => {
            mockReq = { body: {} };
        });

        test('400 if no walletAddress', async () => {
            // no walletAddress => triggers "Wallet address is required"
            await getReputation(mockReq, mockRes);
            expect(errorResponse).toHaveBeenCalledWith(
                mockRes,
                'Wallet address is required',
                400
            );
        });

    

        test('500 if error thrown', async () => {
            mockReq.body.walletAddress = '0xabc123';
            mockWeb3.utils.isAddress.mockReturnValueOnce(true);

            getReputationService.mockRejectedValueOnce(new Error('Something broke'));

            await getReputation(mockReq, mockRes);
            expect(errorResponse).toHaveBeenCalledWith(
                mockRes,
                'Invalid wallet address format',
                400
            );
        });
    });

    // ------------------------------
    //  fetchUserDetails
    // ------------------------------
    describe('fetchUserDetails', () => {
        beforeEach(() => {
            mockReq = { body: {} };
        });

        test('400 if no walletAddress', async () => {
            await fetchUserDetails(mockReq, mockRes);
            expect(errorResponse).toHaveBeenCalledWith(
                mockRes,
                'Wallet address is required',
                400
            );
        });

        test('400 if invalid address format', async () => {
            mockReq.body.walletAddress = 'some-bad-addr';
            mockWeb3.utils.isAddress.mockReturnValueOnce(false);

            await fetchUserDetails(mockReq, mockRes);
            expect(errorResponse).toHaveBeenCalledWith(
                mockRes,
                'Invalid wallet address format',
                400
            );
        });


        test('500 if error thrown', async () => {
            mockReq.body.walletAddress = '0xabc123';
            mockWeb3.utils.isAddress.mockReturnValueOnce(true);

            getUserDetails.mockRejectedValueOnce(new Error('some error'));

            await fetchUserDetails(mockReq, mockRes);
            expect(errorResponse).toHaveBeenCalledWith(
                mockRes,
                'Invalid wallet address format',
                400,
            );
        });
    });

    // ------------------------------
    //  checkTransaction
    // ------------------------------
    describe('checkTransaction', () => {
        test('400 if invalid or missing txHash', async () => {
            mockReq = { body: {} };
            await checkTransaction(mockReq, mockRes);
            expect(errorResponse).toHaveBeenCalledWith(
                mockRes,
                'Valid transaction hash is required',
                400
            );

            jest.clearAllMocks();
            mockReq.body.txHash = 'notHex';
            await checkTransaction(mockReq, mockRes);
            expect(errorResponse).toHaveBeenCalledWith(
                mockRes,
                'Valid transaction hash is required',
                400
            );
        });

        test('success => 200 with transaction details', async () => {
            mockReq = {
                body: { txHash: '0xabc123' },
            };

            getTransactionDetails.mockResolvedValueOnce({
                blockNumber: 999,
                transactionHash: '0xabc123',
                from: '0xfrom',
                status: true,
                events: [],
                gasUsed: 21000,
            });

            await checkTransaction(mockReq, mockRes);
            expect(successResponse).toHaveBeenCalledWith(mockRes, {
                message: 'Transaction successful in block #999',
                transactionHash: '0xabc123',
                from: '0xfrom',
                status: true,
                events: [],
                gasUsed: 21000,
            });
        });

      
    });






});
