import { generateUniqueId, saveFileToTemp, validateData } from "../services/file.service.js";
import { uploadFileToPinata } from "../../pinata/fileUpload.js";
import { penalizeUser, submitDataToContract, getReputationService } from "../services/blockchain.service.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { getModelDetails } from "../services/model.service.js";
import { ConvexHttpClient } from "convex/browser";
import fs from "fs/promises";
import path from "path";
import Web3 from "web3";

// Initialize Convex client with the CONVEX_URL_2 environment variable
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);
import { api } from "../../convex/_generated/api.js";

// Initialize Web3 for transaction confirmation
const web3 = new Web3(process.env.WEB3_PROVIDER || "HTTP://127.0.0.1:8545");

/**
 * submitData
 * Handles data submission by a data provider (agent). Validates the data, uploads it to IPFS if valid,
 * submits it to the blockchain, and logs the submission in Convex.
 * @param {Object} req - Express request object.
 * @param {Object} req.files - Uploaded files (expected to contain a 'files' field).
 * @param {Object} req.body - Request body containing clerkUserId and walletAddress.
 * @param {string} req.body.clerkUserId - Clerk user ID of the data provider.
 * @param {string} req.body.walletAddress - Blockchain wallet address of the data provider.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the result of the data submission.
 */
const submitData = async (req, res) => {
  let filePath;
  try {
    const file = req.files?.files;
    const { clerkUserId, walletAddress, modelId } = req.body;

    console.log("Request body:", req.body);

    if (!clerkUserId || !walletAddress || !modelId) {
      return res.status(400).json({ message: "clerkUserId, walletAddress, and modelId are required" });
    }

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const allowedFileTypes = ['.csv', '.json', '.txt'];
    const fileExtension = path.extname(file.name).toLowerCase();
    if (!allowedFileTypes.includes(fileExtension)) {
      return res.status(400).json({ message: "Invalid file type. Only CSV, JSON, and TXT are allowed." });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File size exceeds 10MB limit." });
    }

    const user = await convex.query(api.users.getUserByClerkId, { clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const uniqueId = generateUniqueId(user.name, user.organization, user._id);
    filePath = await saveFileToTemp(file);

    // Upload to IPFS
    const ipfsHash = await uploadFileToPinata(filePath, {
      name: `${user.name}_${Date.now()}`,
      keyvalues: { userId: walletAddress, organization: user.organization, uniqueId },
    });

    // Submit to contract first
    const tx = await submitDataToContract(user.name, user.organization, uniqueId, ipfsHash, walletAddress);
    const txReceipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
    if (!txReceipt || !txReceipt.status) {
      throw new Error("Blockchain transaction failed");
    }

    // Validate data
    const validation = await validateData(filePath);
    let penalizeResult;

    if (validation.quality === "INVALID") {
      penalizeResult = await penalizeUser(uniqueId, walletAddress); // Now works
    }

    await convex.mutation(api.submissions.submitData, {
      userId: user._id,
      dataHash: ipfsHash,
      validationStatus: validation.quality,
      validationIssues: validation.quality === "INVALID" ? validation.issues : undefined, 
      datasetName: file.name,
      transactionHash: penalizeResult?.transactionHash || tx.transactionHash,
      walletAddress: walletAddress,
      sector: user.sector,
      modelId,
    });

    const updatedReputation = await getReputationService(walletAddress);

    // Respond with success
    successResponse(res, {
      message: "Data submitted successfully",
      ipfsHash,
      transactionHash: tx.transactionHash,
      walletAddress,
      reputation: updatedReputation.reputation.toString(),
    });
  } catch (error) {
    console.error("Data submission error:", error);
    errorResponse(res, error.message, 500);
  } finally {
    if (filePath) {
      try {
        await fs.unlink(filePath);
        console.log(`Temporary file deleted: ${filePath}`);
      } catch (err) {
        console.error(`Failed to delete temporary file ${filePath}:`, err);
      }
    }
  }
};

export { submitData };