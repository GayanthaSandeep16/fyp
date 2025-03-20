import express from 'express';
import { submitData, getModelHistoryDetails } from './controllers/data.controller.js';
import { getWeb3Status, getReputation,checkTransaction,checkBlacklistStatus} from './controllers/web3.controller.js';
import memberController from './controllers/member.controller.js';
import adminController from './controllers/admin.controller.js';

const router = express.Router();

router.post('/submit-data', submitData);
router.post('/createUser', memberController.createUser);
router.post ('/train', adminController.trainModel);
router.get('/getInvalidUsers', adminController.getInvalidUser);
router.get('/getvalidUsers', adminController.getvalidUser);
router.get('/getNotifications', adminController.getNotifications)
router.get('/getReputation', getReputation);
router.get('/checkTransaction', checkTransaction);
router.post('/check-blacklist', checkBlacklistStatus);
router.get('/getModelHistory', getModelHistoryDetails);

router.get('/test', (req, res) => {
    res.send("Hello FYP");
});

// router.get('/web3-status', web3Controller.getWeb3Status);

export default router;
