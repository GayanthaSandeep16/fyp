const TestContract = artifacts.require("TestContract");

module.exports = async function(deployer) {
  try {
    await deployer.deploy(TestContract);
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
};