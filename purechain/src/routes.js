const express = require('express');
const router = express.Router();
const { authenticate } = require('./utils/auth');
const dataController = require('./controllers/data.controller');
const { auth } = require('./utils/auth');
const {web3Controller} = require('./controllers/web3.controller');
const authController = require('./controllers/auth.controller');

router.post('/submit-data', authenticate, dataController.submitData);

router.post('/signup', authController.signUp);

router.post('/login', authController.login);

router.get('/test', (req, res) => {
    res.send("Hello FYP");
});

//router.get('/web3-status', web3Controller.getWeb3Status ); 

module.exports = router;