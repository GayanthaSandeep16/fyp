const Web3 = require('web3');
const DataQualityArtifact = require('../../build/contracts/DataQuality.json');
const web3 = new Web3(process.env.WEB3_PROVIDER || 'HTTP://127.0.0.1:7545');

const contract = new web3.eth.Contract(
  DataQualityArtifact.abi,
  process.env.CONTRACT_ADDRESS,
  { from: process.env.ACCOUNT_ADDRESS }
);

exports.submitDataToContract = (name, organization, uniqueId, ipfsHash) => {
  return contract.methods
    .submitData(name, organization, uniqueId, ipfsHash)
    .send({
      from: process.env.CONTRACT_ADDRESS,
      gas: 3000000,
    });
};

exports.penalizeUser = (uniqueId) => {
  return contract.methods
    .penalizeUser(uniqueId)
    .send({
      from: process.env.ACCOUNT_ADDRESS,
      gas: 3000000,
    });
};