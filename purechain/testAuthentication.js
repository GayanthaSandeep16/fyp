require('dotenv').config();

const { PINATA_API_KEY, PINATA_API_SECRET } = process.env;
const pinataSDK = require('@pinata/sdk');
const pinata = new pinataSDK(PINATA_API_KEY, PINATA_API_SECRET);