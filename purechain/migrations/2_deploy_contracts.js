const TestContract = artifacts.require("TestContract");

module.exports = async function (deployer) {
  try {
    console.log("Deploying TestContract...");
    await deployer.deploy(TestContract);
    console.log("TestContract deployed!");
  } catch (error) {
    console.error("Error during deployment:", error);
  }
};
