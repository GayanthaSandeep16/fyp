import express from 'express';
import { submitData } from './controllers/data.controller.js';
import web3Controller from './controllers/web3.controller.js';
import memberController from './controllers/member.controller.js';
import adminController from './controllers/admin.controller.js';

const router = express.Router();

router.post('/submit-data', submitData);
router.post('/createUser', memberController.createUser);
router.post ('/train', adminController.trainModel);
router.get('/getInvalidUser', adminController.getInvalidUser);
router.get('/getvalidUser', adminController.getvalidUser);
router.get('/test', (req, res) => {
    res.send("Hello FYP");
});

// router.get('/web3-status', web3Controller.getWeb3Status);

export default router;
