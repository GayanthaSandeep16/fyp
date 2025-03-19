// migrations/2_deploy_data_quality.js
const DataQuality = artifacts.require("DataQuality");
const fs = require("fs"); // Node.js file system module
const path = require("path"); // For handling file paths

module.exports = async function(deployer) {
  // Deploy the DataQuality contract
  await deployer.deploy(DataQuality);
  const instance = await DataQuality.deployed();
  const contractAddress = instance.address;

  console.log("DataQuality deployed at:", contractAddress);

  // Path to your .env file (adjust if using a different name like .env.local)
  const envPath = path.resolve(__dirname, "../.env"); // Adjust path as needed

  // Read existing .env content or create an empty string if it doesn't exist
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Update or append CONTRACT_ADDRESS
  const envLines = envContent.split("\n").filter(line => !line.startsWith("CONTRACT_ADDRESS="));
  envLines.push(`CONTRACT_ADDRESS="${contractAddress}"`);
  const newEnvContent = envLines.join("\n");

  // Write the updated content back to .env
  fs.writeFileSync(envPath, newEnvContent, "utf8");
  console.log(`Updated .env.local with CONTRACT_ADDRESS=${contractAddress}`);
};