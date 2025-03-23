/**
 * member.controller.test.js
 *
 * Demonstrates Jest-based unit tests for createUser in member.controller.js.
 */

import { jest } from '@jest/globals';
import memberController from '../controllers/member.controller.js';
import { ConvexHttpClient } from 'convex/browser';

// 1) Mock convex/browser so new ConvexHttpClient() is a jest.fn() 
jest.mock('convex/browser', () => {
  const original = jest.requireActual('convex/browser');
  return {
    ...original,
    ConvexHttpClient: jest.fn(),
  };
});

// 2) We'll also mock the "api" references from '../../convex/_generated/api.js', if needed
jest.mock('../../convex/_generated/api.js', () => ({
  api: {
    users: {
      createUser: 'users:createUser',
    },
  },
}));

describe('member.controller -> createUser', () => {
  let mockReq;
  let mockRes;
  let mockConvexClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // A single mock object for the new ConvexHttpClient() calls
    mockConvexClient = {
      query: jest.fn(),     // .query() stub
      mutation: jest.fn(),  // .mutation() stub
    };

    // Make "new ConvexHttpClient()" always return our mockConvexClient
    ConvexHttpClient.mockReturnValue(mockConvexClient);

    // Minimal Express-like req/res
    mockReq = {
      body: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  test('400 if missing required fields', async () => {
    // For instance, no name, email, etc.
    mockReq.body = {
      name: '',
      email: '',
      organization: '',
      sector: '',
      role: '',
      clerkUserId: '',
      walletAddress: '',
    };

    await memberController.createUser(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'All fields are required.' });
  });

  test('400 if invalid email', async () => {
    mockReq.body = {
      name: 'Alice',
      email: 'not-an-email',
      organization: 'Org',
      sector: 'Healthcare',
      role: 'User',
      clerkUserId: 'clerk123',
      walletAddress: '0x123',
    };

    await memberController.createUser(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid email format.' });
  });

  test("400 if role isn't Admin or User", async () => {
    mockReq.body = {
      name: 'Alice',
      email: 'alice@example.com',
      organization: 'Org',
      sector: 'Healthcare',
      role: 'WrongRole',
      clerkUserId: 'clerk123',
      walletAddress: '0x123',
    };

    await memberController.createUser(mockReq, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Role must be either 'Admin' or 'User'.",
    });
  });

  test('201 if valid input => calls createUser in convex', async () => {
    mockReq.body = {
      name: 'Alice',
      email: 'alice@example.com',
      organization: 'Org',
      sector: 'Healthcare',
      role: 'User',
      clerkUserId: 'clerk123',
      walletAddress: '0xabc',
    };

    // Suppose the mutation returns 'some-id' as the user ID
    mockConvexClient.mutation.mockResolvedValue('some-id');

    await memberController.createUser(mockReq, mockRes);

    expect(mockConvexClient.mutation).toHaveBeenCalledWith('users:createUser', {
      name: 'Alice',
      email: 'alice@example.com',
      organization: 'Org',
      sector: 'Healthcare',
      role: 'User',
      clerkUserId: 'clerk123',
      walletAddress: '0xabc',
    });

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      userId: 'some-id',
      message: 'User created successfully!',
    });
  });

  test('500 if convex call throws error', async () => {
    mockReq.body = {
      name: 'Bob',
      email: 'bob@example.com',
      organization: 'Org',
      sector: 'Finance',
      role: 'Admin',
      clerkUserId: 'clerk567',
      walletAddress: '0xabc',
    };

    // Simulate a failure from convex
    mockConvexClient.mutation.mockRejectedValue(new Error('Convex internal error'));

    await memberController.createUser(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Convex internal error',
    });
  });
});
