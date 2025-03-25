import express from 'express';
import { submitData  } from './controllers/data.controller.js';
import { getWeb3Status, getReputation, getSubmissions } from './controllers/web3.controller.js';
import memberController from './controllers/member.controller.js';
import adminController from './controllers/admin.controller.js';
import { requireAuth, isAdmin } from '../middleware/auth.middleware.js'; // Import the middleware

// Initialize Express router for defining API endpoints
const router = express.Router();

/**
 * POST /submit-data
 * Submits data for validation and storage in IPFS if valid.
 * Requires authentication.
 */
router.post('/submit-data', requireAuth, submitData);

/**
 * POST /create-user
 * Creates a new user (member) in the system.
 * Requires authentication.
 */
router.post('/create-user', memberController.createUser);

/**
 * POST /train
 * Triggers the training of the ML model using validated data.
 * Restricted to admin users.
 */
router.post('/train', requireAuth, isAdmin, adminController.trainModel);

/**
 * GET /invalid-submissions
 * Fetches submissions with validationStatus "INVALID" along with user details.
 * Restricted to admin users.
 */
router.get('/invalid-submissions', requireAuth, isAdmin, adminController.getInvalidUser);

/**
 * GET /valid-submissions
 * Fetches submissions with validationStatus "VALID" along with user details.
 * Restricted to admin users.
 */
router.get('/valid-submissions', requireAuth, isAdmin, adminController.getvalidUser);

/**
 * GET /notifications
 * Fetches notifications for admin users (e.g., invalid submissions, system alerts).
 * Restricted to admin users.
 */
router.get('/notifications', requireAuth, isAdmin, adminController.getNotifications);

/**
 * GET /reputation
 * Retrieves the reputation score of a user or agent from the blockchain.
 * Requires authentication.
 */
router.get('/reputation', requireAuth, getReputation);

/**
 * GET /check-transaction
 * Checks the status of a blockchain transaction.
 * Requires authentication.
 */
router.post('/allSubmisson', requireAuth, getSubmissions);


/**
 * GET /test
 * A test endpoint to verify the server is running.
 * No authentication required.
 */
router.get('/test', (req, res) => {
  res.status(200).send("Hello FYP");
});

// Uncomment and use this endpoint if needed for Web3 status checks
// router.get('/web3-status', requireAuth, getWeb3Status);

export default router;