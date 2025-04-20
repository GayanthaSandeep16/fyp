import Web3 from "web3";
import DataQualityArtifact from "../../build/contracts/DataQuality.json" with { type: "json" };

const web3 = new Web3(process.env.WEB3_PROVIDER);

const contract = new web3.eth.Contract(
  DataQualityArtifact.abi,
  process.env.CONTRACT_ADDRESS // This is correct as the contract address
);

export const recordTransaction = async (modelId, walletAddress) => {
  try {
    const contract = new web3.eth.Contract(DataQualityArtifact.abi, process.env.CONTRACT_ADDRESS);
    const tx = await contract.methods.logTraining(modelId).send({
      from: walletAddress,
      gas: 3000000,
    });
    const txReceipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
    return txReceipt; // Return the receipt for use in trainModel
  } catch (error) {
    console.error("Error recording transaction:", error);
    throw new Error(`Failed to record transaction: ${error.message}`);
  }
};

// Submit data to the contract using the user's wallet address
export const submitDataToContract = async (name, organization, uniqueId, ipfsHash, walletAddress) => {
  try {
    if (!web3.utils.isAddress(walletAddress)) {
      throw new Error("Invalid wallet address");
    }

    // Log inputs for debugging
    console.log("Submitting to contract with:", { name, organization, uniqueId, ipfsHash, walletAddress });

    // Check balance (using BigInt)
    const balance = await web3.eth.getBalance(walletAddress); // Returns string
    console.log("Wallet balance (wei):", balance);
    const minBalance = BigInt("10000000000000000"); // 0.01 ETH in wei
    if (BigInt(balance) < minBalance) {
      throw new Error("Insufficient funds in wallet (less than 0.01 ETH)");
    }

    // Get nonce to avoid mismatches
    const nonce = await web3.eth.getTransactionCount(walletAddress, "pending");
    console.log("Nonce:", nonce);

    // Estimate gas
    const gasEstimate = await contract.methods
      .submitData(name, organization, uniqueId, ipfsHash)
      .estimateGas({ from: walletAddress });
    console.log("Estimated gas:", gasEstimate);

    // Convert all to BigInt and calculate gas limit
    const gasLimit = BigInt(gasEstimate) * BigInt(2) < BigInt(3000000) ? gasEstimate * BigInt(2) : BigInt(3000000);

    const tx = await contract.methods
      .submitData(name, organization, uniqueId, ipfsHash)
      .send({
        from: walletAddress,
        gas: Number(gasLimit), // Convert back to number for Web3.js compatibility
        nonce: Number(nonce),  // Convert BigInt to number for send
      });

    console.log("Transaction successful:", tx);
    return tx;
  } catch (error) {
    console.error("Submission error:", error);
    if (error.receipt) {
      // Attempt to get revert reason
      const tx = await web3.eth.getTransaction(error.transactionHash);
      try {
        await web3.eth.call({
          from: walletAddress,
          to: process.env.CONTRACT_ADDRESS,
          data: contract.methods.submitData(name, organization, uniqueId, ipfsHash).encodeABI(),
        });
      } catch (callError) {
        const revertReason = callError.reason || callError.message || "Unknown revert reason";
        throw new Error(`Blockchain submission failed: Reverted with reason - ${revertReason}`);
      }
    }
    throw new Error(`Blockchain submission failed: ${error.message}`);
  }
};

// Penalize a user using their wallet address
export const penalizeUser = async (uniqueId, walletAddress) => {
  try {
    const tx = await contract.methods
      .penalizeUser(uniqueId)
      .send({ from: walletAddress });

    // Parse the transaction receipt for events
    const receipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
    const userPenalizedEvent = receipt.logs
      .map((log) => {
        try {
          return contract.interface.parseLog(log);
        } catch (e) {
          return null;
        }
      })
      .filter((event) => event && event.name === "UserPenalized")[0];

    const reputationLoss = userPenalizedEvent ? userPenalizedEvent.args.reputationLoss.toString() : "1";

    return {
      transactionHash: tx.transactionHash,
      reputationLoss,
    };
  } catch (error) {
    throw new Error(`Failed to penalize user: ${error.message}`);
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

export const isUserBlacklisted = async (walletAddress) => {
  try {
    if (!web3.utils.isAddress(walletAddress)) {
      throw new Error("Invalid wallet address");
    }
    const userDetails = await contract.methods.getUserByAddress(walletAddress).call();
    return userDetails[4];
  } catch (error) {
    throw new Error(`Failed to check blacklist status: ${error.message}`);
  }
};

//Get full user details using wallet address
export const getUserDetails = async (walletAddress) => {
  try {
    const userDetails = await contract.methods.getUserByAddress(walletAddress).call();
    return {
      name: userDetails[0],
      organization: userDetails[1],
      uniqueId: userDetails[2],
      reputation: parseInt(userDetails[3]),
      isBlacklisted: userDetails[4],
      submissionCount: parseInt(userDetails[5]),
    };
  } catch (error) {
    throw new Error(`Failed to fetch user details: ${error.message}`);
  }
};

// get transaction details using transaction hash using this try to get the transaction details and show in ui
export const getTransactionDetails = async (txHash) => {
  try {
    const receipt = await web3.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Transaction not found or not yet mined");
    }

    const tx = await web3.eth.getTransaction(txHash);

    const eventABIs = DataQualityArtifact.abi.filter(e => e.type === "event");

    const decodedLogs = receipt.logs.map(log => {
      console.log("Log topics:", log.topics);
      try {
        const eventABI = eventABIs.find(e => 
          web3.utils.keccak256(`${e.name}(${e.inputs.map(i => i.type).join(",")})`) === log.topics[0]
        );
        if (!eventABI) {
          console.log(`No matching ABI for topic: ${log.topics[0]}`);
          return null;
        }

        const decoded = web3.eth.abi.decodeLog(
          eventABI.inputs,
          log.data,
          log.topics.slice(1)
        );

        // Convert BigInt values in returnValues to strings
        const returnValues = {};
        for (const [key, value] of Object.entries(decoded)) {
          returnValues[key] = (typeof value === 'bigint') ? value.toString() : value;
        }

        return {
          event: eventABI.name,
          returnValues
        };
      } catch (e) {
        console.error("Decoding error:", e.message);
        return null;
      }
    }).filter(log => log !== null);

    console.log("Decoded logs:", decodedLogs);

    return {
      transactionHash: txHash,
      blockNumber: receipt.blockNumber.toString(),
      from: tx.from,
      to: tx.to,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status ? "Success" : "Failed",
      events: decodedLogs.map(log => ({
        name: log.event,
        args: log.returnValues
      }))
    };
  } catch (error) {
    throw new Error(`Failed to fetch transaction details: ${error.message}`);
  }
};
