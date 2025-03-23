/**
 * data.controller.test.js
 *
 * Demonstrates testing the submitData() function in data.controller.js, ensuring that
 * we return the same mock object from new ConvexHttpClient(...) that we configure in the test.
 */

import { submitData } from '../controllers/data.controller.js';
import { ConvexHttpClient } from 'convex/browser';
import fs from 'fs/promises';
import { successResponse, errorResponse } from '../utils/responseHandler.js';
import {
  generateUniqueId,
  saveFileToTemp,
  validateData,
} from '../services/file.service.js';
import {
  uploadFileToPinata,
} from '../../pinata/fileUpload.js';
import {
  penalizeUser,
  submitDataToContract,
  getReputationService,
} from '../services/blockchain.service.js';
import Web3 from 'web3';

// -----------------------------------------------------------------------
// 1) Mock the convex/browser module so we can control new ConvexHttpClient()
// -----------------------------------------------------------------------
jest.mock('convex/browser', () => {
  const original = jest.requireActual('convex/browser');
  return {
    ...original,
    ConvexHttpClient: jest.fn(), 
  };
});

// -----------------------------------------------------------------------
// 2) Mock other dependencies
// -----------------------------------------------------------------------

// file.service
jest.mock('../services/file.service.js', () => ({
  generateUniqueId: jest.fn(),
  saveFileToTemp: jest.fn(),
  validateData: jest.fn(),
}));

// pinata/fileUpload
jest.mock('../../pinata/fileUpload.js', () => ({
  uploadFileToPinata: jest.fn(),
}));

// blockchain.service
jest.mock('../services/blockchain.service.js', () => ({
  penalizeUser: jest.fn(),
  submitDataToContract: jest.fn(),
  getReputationService: jest.fn(),
}));

// responseHandler
jest.mock('../utils/responseHandler.js', () => ({
  successResponse: jest.fn(),
  errorResponse: jest.fn(),
}));

// We'll also mock the "api" references, if they're used by data.controller.js
jest.mock('../../convex/_generated/api.js', () => ({
  api: {
    users: {
      getUserByClerkId: 'users:getUserByClerkId',
    },
    submissions: {
      submitData: 'submissions:submitData',
    },
  },
}));

// Finally, mock Web3 so we can control getTransactionReceipt
jest.mock('web3', () => {
  // Return a class that yields a mock object with .eth
  return jest.fn().mockImplementation(() => ({
    eth: {
      getTransactionReceipt: jest.fn(),
    },
  }));
});

// -----------------------------------------------------------------------
// 3) Setup references for the mocks (we need real references to check calls)
// -----------------------------------------------------------------------
describe('data.controller -> submitData', () => {
  let mockReq, mockRes;
  let mockConvexClient; // The single mock object we return from new ConvexHttpClient()
  let mockWeb3;

  beforeEach(() => {
    jest.clearAllMocks();
   
    // We create a single mock object for the "ConvexHttpClient" instance:
    mockConvexClient = {
      query: jest.fn(),     // .query() stub
      mutation: jest.fn(),  // .mutation() stub
    };

    // Make "new ConvexHttpClient()" always return our mockConvexClient
    ConvexHttpClient.mockReturnValue(mockConvexClient);

    // Also create a single mock web3 instance
    mockWeb3 = {
      eth: {
        getTransactionReceipt: jest.fn(),
      },
    };
    // So "new Web3()" returns mockWeb3
    Web3.mockReturnValue(mockWeb3);

    // Minimal mock for req/res
    mockReq = {
      body: {},
      files: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // For success/error responses:
    successResponse.mockImplementation((resObj, data) => {
      resObj.status(200).json(data);
    });
    errorResponse.mockImplementation((resObj, message, code) => {
      resObj.status(code).json({ message });
    });

    // We'll spy on fs.unlink so it doesn't really delete any file
    jest.spyOn(fs, 'unlink').mockResolvedValue();
  });

  test('400 if clerkUserId or walletAddress is missing', async () => {
    // No clerkUserId or walletAddress
    mockReq.body = {};

    await submitData(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'clerkUserId and walletAddress are required',
    });
  });

  test('400 if no file is uploaded', async () => {
    mockReq.body = { clerkUserId: 'abc', walletAddress: '0x123' };
    mockReq.files = {}; // no file

    await submitData(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'No file uploaded',
    });
  });

  test('400 if invalid file type', async () => {
    mockReq.body = { clerkUserId: 'abc', walletAddress: '0x123' };
    mockReq.files = {
      files: { name: 'data.exe', size: 1000 }, // .exe not allowed
    };

    await submitData(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Invalid file type. Only CSV, JSON, and TXT are allowed.',
    });
  });

  test('400 if file size too large', async () => {
    mockReq.body = { clerkUserId: 'abc', walletAddress: '0x123' };
    mockReq.files = {
      files: { name: 'data.csv', size: 20 * 1024 * 1024 }, // 20MB
    };

    await submitData(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'File size exceeds 10MB limit.',
    });
  });

  test('404 if user not found in Convex', async () => {
    mockReq.body = { clerkUserId: 'abc', walletAddress: '0x123' };
    mockReq.files = {
      files: { name: 'data.csv', size: 1000 },
    };

    // mockConvexClient.query => returns null => user not found
    mockConvexClient.query.mockResolvedValue(null);

    await submitData(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  test('handles invalid data => penalize + 400', async () => {
    mockReq.body = { clerkUserId: 'abc', walletAddress: '0x123' };
    mockReq.files = {
      files: { name: 'data.csv', size: 1234 },
    };

    // user found
    mockConvexClient.query.mockResolvedValue({
      _id: 'user123',
      name: 'TestUser',
      organization: 'TestOrg',
      sector: 'Healthcare',
    });

    generateUniqueId.mockReturnValue('unique-submission-id');
    saveFileToTemp.mockResolvedValue('/tmp/fake.csv');
    validateData.mockResolvedValue({
      quality: 'INVALID',
      issues: ['Missing columns'],
      stats: { rowCount: 10 },
    });
    penalizeUser.mockResolvedValue({ transactionHash: '0xpenalty123' });

    await submitData(mockReq, mockRes);

    // Expect a 400 for invalid data
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      message: 'Data validation failed',
      issues: ['Missing columns'],
      stats: { rowCount: 10 },
    });

    // Check that penalizeUser was called
    expect(penalizeUser).toHaveBeenCalledWith('unique-submission-id', '0x123');

    // Check we logged the submission with INVALID
    expect(mockConvexClient.mutation).toHaveBeenCalledWith(
      'submissions:submitData',
      expect.objectContaining({
        userId: 'user123',
        validationStatus: 'INVALID',
        validationIssues: 'Missing columns',
      })
    );
  });


//     mockReq.body = { clerkUserId: 'abc', walletAddress: '0x123' };
    
//     mockReq.files = {
//       files: { name: 'data.csv', size: 1234 },
//     };

//     // user found
//     mockConvexClient.query.mockResolvedValue({
//       _id: 'user123',
//       name: 'TestUser',
//       organization: 'TestOrg',
//       sector: 'Healthcare',
//     });

//     generateUniqueId.mockReturnValue('unique-submission-id');
//     saveFileToTemp.mockResolvedValue('/tmp/fake.csv');
//     validateData.mockResolvedValue({
//       quality: 'VALID',
//       issues: [],
//       stats: { rowCount: 10 },
//     });

//     uploadFileToPinata.mockResolvedValue('QmHash123');
//     submitDataToContract.mockResolvedValue({ transactionHash: '0xcontract123' });
//     mockWeb3.eth.getTransactionReceipt.mockResolvedValue({status: true});
//     getReputationService.mockResolvedValue({ reputation: 42 });
//     console.log('Mock Web3 getTransactionReceipt:', mockWeb3.eth.getTransactionReceipt.mock.calls);
//     await submitData(mockReq, mockRes);

//     console.log('Status called with:', mockRes.status.mock.calls);
//     console.log('JSON called with:', mockRes.json.mock.calls);
//     // Should be 200
//     expect(mockRes.status).toHaveBeenCalledWith(200);
//     expect(mockRes.json).toHaveBeenCalledWith({
//       message: 'Data submitted successfully',
//       ipfsHash: 'QmHash123',
//       transactionHash: '0xcontract123',
//       walletAddress: '0x123',
//       reputation: 42,
//     });

//     // No penalizeUser call
//     expect(penalizeUser).not.toHaveBeenCalled();

//     // Insert with "VALID"
//     expect(mockConvexClient.mutation).toHaveBeenCalledWith(
//       'submissions:submitData',
//       expect.objectContaining({
//         userId: 'user123',
//         dataHash: 'QmHash123',
//         validationStatus: 'VALID',
//         transactionHash: '0xcontract123',
//       })
//     );

//     // Also check we cleaned up the temp file
//     expect(fs.unlink).toHaveBeenCalledWith('/tmp/fake.csv');
//   });
});
