import { generateUniqueId, saveFileToTemp, validateData } from "../services/file.service.js";
import { uploadFileToPinata } from "../../pinata/fileUpload.js";
import { penalizeUser, submitDataToContract, getReputationService ,getUserDetails } from "../services/blockchain.service.js";
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
  const startTime = Date.now();
  console.log("Received request to submit data at:", new Date(startTime).toISOString());
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

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ message: "File size exceeds 50MB limit." });
    }

    const user = await convex.query(api.users.getUserByClerkId, { clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const uniqueId = generateUniqueId(user.name, user.organization, user._id);
    filePath = await saveFileToTemp(file);

    // Check if the user is a first-time submitter
    const userDetails = await getUserDetails(walletAddress);
    const isFirstSubmission = userDetails.submissionCount === 0;

    // Validate data first
    const validateStartTime = Date.now();
    console.log("Validation start time at:", new Date(validateStartTime).toISOString());
    const validation = await validateData(filePath);
    const validationEndTime = Date.now();
    console.log("Validation completed at:", new Date(validationEndTime).toISOString());

    console.log("Validation result:", validation.quality, validation.issues);

    let ipfsHash = "";
    let submissionTxHash = null;
    let penalizeResult = null;

    // Save submission to Convex (even for invalid data)
    const submissionId = await convex.mutation(api.submissions.submitData, {
      userId: user._id,
      dataHash: ipfsHash,
      validationStatus: validation.quality,
      validationIssues: validation.quality === "INVALID" ? validation.issues : undefined,
      datasetName: file.name,
      transactionHash: "",
      walletAddress: walletAddress,
      sector: user.sector,
      modelId,
    });

    // Handle valid data or first-time invalid submission
    if (validation.quality === "VALID" || (validation.quality === "INVALID" && isFirstSubmission)) {
      if (validation.quality === "VALID") {
        ipfsHash = await uploadFileToPinata(filePath, {
          name: `${user.name}_${Date.now()}`,
          keyvalues: { userId: walletAddress, organization: user.organization, uniqueId },
        });
      } else {
        // For first-time invalid submission, use a dummy IPFS hash
        ipfsHash = "INVALID_FIRST_SUBMISSION";
      }

      const tx = await submitDataToContract(user.name, user.organization, uniqueId, ipfsHash, walletAddress);
      const txReceipt = await web3.eth.getTransactionReceipt(tx.transactionHash);
      if (!txReceipt || !txReceipt.status) {
        throw new Error("Blockchain transaction failed");
      }
      submissionTxHash = tx.transactionHash;

      // Update submission with transaction hash
      await convex.mutation(api.submissions.update, {
        id: submissionId,
        transactionHash: submissionTxHash,
      });

      // Log submission transaction
      await convex.mutation("transactions:logTransaction", {
        txHash: submissionTxHash,
        type: "SUBMISSION",
        userId: user._id,
        walletAddress,
        uniqueId,
        ipfsHash: ipfsHash === "INVALID_FIRST_SUBMISSION" ? null : ipfsHash,
        submissionId,
        status: txReceipt.status ? "SUCCESS" : "FAILED",
        blockNumber: txReceipt.blockNumber.toString(),
        eventName: "DataSubmitted",
        eventArgs: { uniqueId, ipfsHash: ipfsHash === "INVALID_FIRST_SUBMISSION" ? "" : ipfsHash },
        created_at: Date.now(),
      });

      // Log reward transaction
      await convex.mutation("transactions:logTransaction", {
        txHash: submissionTxHash,
        type: "REWARD",
        userId: user._id,
        walletAddress,
        uniqueId,
        ipfsHash: ipfsHash === "INVALID_FIRST_SUBMISSION" ? null : ipfsHash,
        submissionId,
        status: txReceipt.status ? "SUCCESS" : "FAILED",
        blockNumber: txReceipt.blockNumber.toString(),
        eventName: "UserRewarded",
        eventArgs: { uniqueId, reputationGain: "2" },
        created_at: Date.now(),
      });
    }

    // Handle penalization for invalid data (only for non-first-time submissions)
    if (validation.quality === "INVALID" && !isFirstSubmission) {
      penalizeResult = await penalizeUser(uniqueId, walletAddress);
      const penalizeReceipt = await web3.eth.getTransactionReceipt(penalizeResult.transactionHash);

      // Log penalization transaction with reputation loss from the event
      await convex.mutation("transactions:logTransaction", {
        txHash: penalizeResult.transactionHash,
        type: "PENALIZE",
        userId: user._id,
        walletAddress,
        uniqueId,
        ipfsHash: " ",
        submissionId,
        status: penalizeReceipt.status ? "SUCCESS" : "FAILED",
        blockNumber: penalizeReceipt.blockNumber.toString(),
        eventName: "UserPenalized",
        eventArgs: { uniqueId, reputationLoss: penalizeResult.reputationLoss },
        created_at: Date.now(),
      });

      // Check if blacklisted and log if applicable
      const updatedUserDetails = await getUserDetails(walletAddress);
      if (updatedUserDetails.reputation < 0) {
        await convex.mutation("transactions:logTransaction", {
          txHash: penalizeResult.transactionHash,
          type: "BLACKLIST",
          userId: user._id,
          walletAddress,
          uniqueId,
          ipfsHash: null,
          submissionId,
          status: penalizeReceipt.status ? "SUCCESS" : "FAILED",
          blockNumber: penalizeReceipt.blockNumber.toString(),
          eventName: "UserBlacklisted",
          eventArgs: { uniqueId },
          created_at: Date.now(),
        });

        // Return error response if user is blacklisted
        return errorResponse(res, "User is blocked by the system due to repeated invalid data submissions.", 403);
      }
    }

    const updatedReputation = await getReputationService(walletAddress);
    const endTime = Date.now();
    console.log("submit end time at:", new Date(endTime).toISOString());

    successResponse(res, {
      message: "Data processed successfully",
      submissionTxHash,
      penalizeTxHash: penalizeResult?.transactionHash,
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