import { saveFileToTemp, validateData } from "../services/file.service.js";
import { uploadFileToPinata } from "../../pinata/fileUpload.js";
import { penalizeUser, submitDataToContract } from "../services/blockchain.service.js";
import { successResponse, errorResponse } from "../utils/responseHandler.js";

const submitData = async (req, res) => {
  try {
    const file = req.files?.files;

    if (!file) {
      return res.status(400).json({ message: "Missing file" });
    }

    const user = db
        .prepare(`SELECT * FROM users WHERE id = ?`)
        .get(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.name || !user.organization || !user.id) {
      return res.status(400).json({ message: "Invalid user data" });
    }

    console.log("User:", user);

    let filePath;
    try {
      filePath = await saveFileToTemp(file);
    } catch (err) {
      return res.status(500).json({ message: "File saved/upload failed", error: err });
    }

    const uniqueId = generateUniqueId(user.name, user.organization, user.id);

    const validation = await validateData(filePath);
    console.log(validation);

    if (validation.quality === "BAD") {
      await penalizeUser(user.name, user.organization, uniqueId);
      return res.status(400).json({
        message: "Data validation failed",
        issues: validation.issues,
      });
    }

    let ipfsHash;
    try {
      ipfsHash = await uploadFileToPinata(filePath, {
        name: `${user.name}_${Date.now()}`,
        keyvalues: {
          userId: user.id,
          organization: user.organization,
          uniqueId: uniqueId,
          validationStatus: "VALID",
        },
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }

    const tx = await submitDataToContract(user.name, user.organization, uniqueId, ipfsHash);

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

// Export using ES Module syntax
export { submitData };
