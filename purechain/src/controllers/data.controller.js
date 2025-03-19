import {generateUniqueId,  saveFileToTemp,  validateData,} from "../services/file.service.js";
import { uploadFileToPinata } from "../../pinata/fileUpload.js";
import {  penalizeUser,  submitDataToContract} from "../services/blockchain.service.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";
import { ConvexHttpClient } from "convex/browser";
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);
import { api } from "../../convex/_generated/api.js";

//submit data by dataprovider (Agent)
const submitData = async (req, res) => {
  try {
    const file = req.files?.files;
    const { clerkUserId, walletAddress } = req.body; 

    console.log("Request body:", req.body);

    if (!clerkUserId || !walletAddress) {
      return res.status(400).json({ message: "clerkUserId and walletAddress are required" });
    }

    
    const user = await convex.query("users:getUserByClerkId", { clerkUserId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const uniqueId = generateUniqueId(user.name, user.organization, user._id);
    const filePath = await saveFileToTemp(file);
    const validation = await validateData(filePath);

    if (validation.quality === "INVALID") {
      await penalizeUser(user.name, user.organization, uniqueId, walletAddress); // Pass walletAddress
      await convex.mutation(api.submissions.submitData, {
        userId: walletAddress,
        dataHash: "",
        validationStatus: "INVALID",
        validationIssues: validation.issues.join(", "),
        datasetName: file.name,
        sector: user.sector,
      });
      return res.status(400).json({ message: "Data validation failed", issues: validation.issues });
    }

    const ipfsHash = await uploadFileToPinata(filePath, {
      name: `${user.name}_${Date.now()}`,
      keyvalues: { userId: walletAddress, organization: user.organization, uniqueId, validationStatus: validation.quality },
    });

    await convex.mutation(api.submissions.submitData, {
      userId: user._id,
      dataHash: ipfsHash,
      validationStatus: validation.quality,
      datasetName: file.name,
      sector: user.sector,
      walletAddress: walletAddress,
    });

    // Submit to blockchain with walletAddress
    const tx = await submitDataToContract(user.name, user.organization, uniqueId, ipfsHash, walletAddress);

    successResponse(res, {
      message: "Data submitted successfully",
      ipfsHash,
      transactionHash: tx.transactionHash,
      walletAddress, // Return for confirmation
    });
  } catch (error) {
    console.error("Data submission error:", error);
    errorResponse(res, error.message, 500);
  }
};


export { submitData };
