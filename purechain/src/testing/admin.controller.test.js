/**
 * admin.controller.test.js
 * Demonstrates testing with ESM + Jest, assuming the environment is set
 * in a jest.setup.js file before this test is loaded.
 */

import fs from 'fs/promises';
import { spawn } from 'child_process';
// NO import { jest } from '@jest/globals'; -> remove this

// We'll dynamically import the modules later if desired, or directly import if you've
// already solved the environment variable issue via the setup file:
import adminController from '../controllers/admin.controller.js';
import * as adminService from '../services/admin.service.js';

// Mock dependencies:
jest.mock('../services/admin.service.js', () => ({
  fetchAllValidData: jest.fn(),
  dataToCsvString: jest.fn(),
  sendNotifications: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  unlink: jest.fn(),
  rename: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

/** Helper to create mock req/res for Express-like testing */
function createMockRequestResponse() {
  return {
    req: {},
    res: {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    },
  };
}

describe('admin.controller -> trainModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should train model successfully and return 200 response', async () => {
    // Mock "valid data"
    adminService.fetchAllValidData.mockResolvedValue([
      { gender: 'M', age: 30, bmi: 25, hba1c: 6.2, glucose: 120, target: 1 },
      { gender: 'F', age: 45, bmi: 28, hba1c: 6.5, glucose: 130, target: 0 },
    ]);

    // Mock CSV conversion
    adminService.dataToCsvString.mockResolvedValue(
      'gender,age,bmi,hba1c,glucose,target\nM,30,25,6.2,120,1'
    );

    fs.writeFile.mockResolvedValue();

    // Simulate Python metrics
    const mockPythonProcess = {
      stdout: {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            callback('Accuracy: 0.85\nF1 Score: 0.80\nPrecision: 0.78\nRecall: 0.82\n');
          }
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          callback(0); // success
        }
      }),
    };
    spawn.mockReturnValue(mockPythonProcess);

    fs.rename.mockResolvedValue();
    adminService.sendNotifications.mockResolvedValue([]);

    // Exercise controller
    const { req, res } = createMockRequestResponse();
    await adminController.trainModel(req, res);

    // Assertions
    expect(adminService.fetchAllValidData).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'RandomForest model trained successfully',
        accuracy: 0.85,
        f1Score: 0.8,
        precision: 0.78,
        recall: 0.82,
      })
    );
  });

  test('should return 400 if no valid data found', async () => {
    adminService.fetchAllValidData.mockResolvedValue([]);

    const { req, res } = createMockRequestResponse();
    await adminController.trainModel(req, res);

    expect(adminService.fetchAllValidData).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No valid data found to train on',
    });
  });

  test('should handle Python script failure gracefully', async () => {
    adminService.fetchAllValidData.mockResolvedValue([
      { gender: 'M', age: 30, bmi: 25, hba1c: 6.2, glucose: 120, target: 1 },
    ]);
    adminService.dataToCsvString.mockResolvedValue(
      'gender,age,bmi,hba1c,glucose,target\nM,30,25,6.2,120,1'
    );
    fs.writeFile.mockResolvedValue();

    // Simulate Python exit code 1
    const mockPythonProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'close') {
          callback(1);
        }
      }),
    };
    spawn.mockReturnValue(mockPythonProcess);

    const { req, res } = createMockRequestResponse();
    await adminController.trainModel(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Failed to train model',
        details: expect.stringContaining('Python script failed with code 1'),
      })
    );
  });
});
