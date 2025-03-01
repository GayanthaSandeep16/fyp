import {generateUniqueId,  saveFileToTemp,  validateData,} from "../services/file.service.js";
import { uploadFileToPinata } from "../../pinata/fileUpload.js";
import {  penalizeUser,  submitDataToContract} from "../services/blockchain.service.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { ConvexHttpClient } from "convex/browser";
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);
import { api } from "../../convex/_generated/api.js";

const submitData = async (req, res) => {
  try {
    const file = req.files?.files;
    const clerkUserId = req.body.clerkUserId;

    console.log("Request body:", req.body); // Log the request body

    if (!clerkUserId) {
      return res
        .status(400)
        .json({ message: "User ID (clerkUserId) is required" });
    }

    console.log("Fetching user with clerkUserId:", clerkUserId); // Log the clerkUserId

    let user;
    try {
      user = await convex.query("users:getUserByClerkId", {
        clerkUserId: clerkUserId,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
    console.log("User fetched:", user); // Log the entire user object

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Generate a unique ID for the submission
    const uniqueId = generateUniqueId(user.name, user.organization, user._id);

    // Save file temporarily
    const filePath = await saveFileToTemp(file);

    // Validate data
    const validation = await validateData(filePath);
    console.log(validation);

    // If data quality is bad, penalize the user and record the invalid submission
    if (validation.quality === "INVALID") {
      await penalizeUser(user.name, user.organization, uniqueId);

      // Record invalid submission in Convex
      await convex.mutation(api.submissions.submitData, {
        userId: user._id,
        dataHash: "", // No IPFS hash for invalid data
        validationStatus: "INVALID",
        datasetName: file.name,
        sector: user.sector,
      });

      return res.status(400).json({
        message: "Data validation failed",
        issues: validation.issues,
      });
    }

    console.log("Uploading to IPFS with metadata:", {
      userId: String(user._id),
      organization: String(user.organization),
      uniqueId: String(uniqueId),
      validationStatus: String(validation.quality),
    });

    // Upload file to IPFS (only for valid data)
    let ipfsHash;
    try {
      ipfsHash = await uploadFileToPinata(filePath, {
        name: `${user.name}_${Date.now()}`,
        keyvalues: {
          userId: user._id,
          organization: user.organization,
          uniqueId: uniqueId,
          validationStatus: validation.quality, // Set dynamically based on validation
        },
      });
    } catch (error) {
      console.error("Error uploading to IPFS:", error);
      return res.status(500).json({ message: "Failed to upload file to IPFS" });
    }
 

    try {
      // Submit valid data to Convex
      const submissionId = await convex.mutation(api.submissions.submitData, {
        userId: user._id,
        dataHash: ipfsHash,
        validationStatus: validation.quality, // "VALID"
        datasetName: file.name,
        sector: user.sector,
      });
    } catch (error) {
      console.error("Error submitting data to Convex:", error);
      return res
        .status(500)
        .json({ message: "Failed to submit data to Convex" });
    }
    // Submit data to blockchain (only for valid data)
    const tx = await submitDataToContract(
      user.name,
      user.organization,
      uniqueId,
      ipfsHash
    );

    // Return success response
    successResponse(res, {
      message: "Data submitted successfully",
      ipfsHash,
      transactionHash: tx.transactionHash,
    });
  } catch (error) {
    console.error("Data submission error:", error);
    errorResponse(res, error.message, 500);
  }
};


export { submitData };
