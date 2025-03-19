import Web3 from "web3";
import DataQualityArtifact from "../../build/contracts/DataQuality.json" with { type: "json" };

const web3 = new Web3(process.env.WEB3_PROVIDER || "HTTP://127.0.0.1:8545");

const contract = new web3.eth.Contract(
  DataQualityArtifact.abi,
  process.env.CONTRACT_ADDRESS // This is correct as the contract address
);

// Submit data to the contract using the user's wallet address
export const submitDataToContract = async (name, organization, uniqueId, ipfsHash, walletAddress) => {
  try {
    if (!web3.utils.isAddress(walletAddress)) {
      throw new Error("Invalid wallet address");
    }

    const tx = await contract.methods
      .submitData(name, organization, uniqueId, ipfsHash)
      .send({
        from: walletAddress, // Use the user's wallet address
        gas: 3000000,
      });

    return tx;
  } catch (error) {
    throw new Error(`Blockchain submission failed: ${error.message}`);
  }
};

// Penalize a user using their wallet address
export const penalizeUser = async (uniqueId, walletAddress) => {
  try {
    if (!web3.utils.isAddress(walletAddress)) {
      throw new Error("Invalid wallet address");
    }

    const tx = await contract.methods
      .penalizeUser(uniqueId)
      .send({
        from: walletAddress, 
        gas: 3000000,
      });

    return tx;
  } catch (error) {
    throw new Error(`Penalization failed: ${error.message}`);
  }
};

// Get the reputation of a user
export const getReputationService = async (walletAddress) => {
  try {
    if (!web3.utils.isAddress(walletAddress)) {
      throw new Error("Invalid wallet address");
    }
    const reputation = await contract.methods.getReputation().call({ from: walletAddress });
    return { walletAddress, reputation };
  } catch (error) {
    throw new Error(`Failed to fetch reputation: ${error.message}`);
  }
};

// Optional: Get full user details (for debugging or UI)
export const getUserDetails = async (walletAddress) => {
  try {
    if (!web3.utils.isAddress(walletAddress)) {
      throw new Error("Invalid wallet address");
    }

    const userData = await contract.methods.getUserByAddress(walletAddress).call();
    return {
      name: userData[0],
      organization: userData[1],
      uniqueId: userData[2],
      reputation: userData[3],
      isBlacklisted: userData[4],
      submissionCount: userData[5],
    };
  } catch (error) {
    throw new Error(`Failed to fetch user details: ${error.message}`);
  }
};