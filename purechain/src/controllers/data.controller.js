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
  let filePath; // Declare filePath to store the temporary file path
  const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);
  try {
    // Extract file and user details from the request
    const file = req.files?.files;
    const { clerkUserId, walletAddress } = req.body;
    console.time("submitData");
    console.log("Request body:", req.body);

    // Validate required fields
    if (!clerkUserId || !walletAddress) {
      return res.status(400).json({ message: "clerkUserId and walletAddress are required" });
    }

    // Validate file presence
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Validate file type
    const allowedFileTypes = ['.csv', '.json', '.txt'];
    const fileExtension = path.extname(file.name).toLowerCase();
    console.log(`Validating file: ${file.name}, Size: ${file.size} bytes`);
    if (!allowedFileTypes.includes(fileExtension)) {
      return res.status(400).json({ message: "Invalid file type. Only CSV, JSON, and TXT are allowed." });
    }

    // Validate file size
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File size exceeds 10MB limit." });
    }

    // Fetch user details from Convex using clerkUserId
    const user = await convex.query(api.users.getUserByClerkId, { clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a unique ID for the submission
    const uniqueId = generateUniqueId(user.name, user.organization, user._id);

    // Save the uploaded file to a temporary location
    filePath = await saveFileToTemp(file);
    console.log(`File saved to temp: ${filePath}`);

    // Validate the data using the data validator
    console.time("validateData");
    const validation = await validateData(filePath);
    console.timeEnd("validateData");

    // If data is invalid, penalize the user and log the submission
    if (validation.quality === "INVALID") {
      console.log(`Invalid data detected. Issues: ${validation.issues}`);
      const penalizeResult = await penalizeUser(uniqueId, walletAddress);
      await convex.mutation(api.submissions.submitData, {
        userId: user._id,
        dataHash: "",
        validationStatus: "INVALID",
        validationIssues: validation.issues.join(", "),
        datasetName: file.name,
        transactionHash: penalizeResult.transactionHash,
        walletAddress: walletAddress,
        sector: user.sector,
      });
      return res.status(400).json({
        message: "Data validation failed",
        issues: validation.issues,
        stats: validation.stats,
      });
    }

    // If data is valid, upload it to IPFS via Pinata
    console.time("uploadFileToPinata");
    const ipfsHash = await uploadFileToPinata(filePath, {
      name: `${user.name}_${Date.now()}`,
      keyvalues: {
        userId: walletAddress,
        organization: user.organization,
        uniqueId,
        validationStatus: validation.quality,
      },
    });
    console.timeEnd("uploadFileToPinata");

    // Submit the data to the blockchain
    console.time("submitDataToContract");
    const tx = await submitDataToContract(user.name, user.organization, uniqueId, ipfsHash, walletAddress);
    console.timeEnd("submitDataToContract");

    // Confirm the transaction
    const txReceipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
    if (!txReceipt || !txReceipt.status) {
      throw new Error("Blockchain transaction failed");
    }

    // Log the successful submission in Convex
    await convex.mutation(api.submissions.submitData, {
      userId: user._id,
      dataHash: ipfsHash,
      validationStatus: validation.quality,
      datasetName: file.name,
      sector: user.sector,
      transactionHash: tx.transactionHash,
      walletAddress: walletAddress,
    });

    // Fetch updated reputation
    const updatedReputation = await getReputationService(walletAddress);

    console.timeEnd("submitData");
    // Respond with success
    successResponse(res, {
      message: "Data submitted successfully",
      ipfsHash,
      transactionHash: tx.transactionHash,
      walletAddress,
      reputation: updatedReputation.reputation,
    });
  } catch (error) {
    console.error("Data submission error:", error);
    errorResponse(res, error.message, 500);
  } finally {
    // Clean up: Delete the temporary file if it exists
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