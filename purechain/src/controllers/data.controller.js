const {
  saveFileToTemp,
  validateData,
  generateUniqueId,
} = require("../services/file.service");
const db = require("../../database/database");
const { uploadFileToPinata } = require("../../pinata/fileUpload");
const { penalizeUser } = require("../services/blockchain.service");
const { submitDataToContract } = require("../services/blockchain.service");
const { successResponse, errorResponse } = require("../utils/responseHandler");

exports.submitData = async (req, res) => {
  try {
    const file = req.files?.files;

    if (!file) {
      return res.status(400).json({ message: "Missing file" });
    }

    // Get user from database using JWT data
    const user = db
      .prepare(
        `
            SELECT * FROM users WHERE id = ?
          `
      )
      .get(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Move all user-dependent logic inside the try block
    if (!user.name || !user.organization || !user.id) {
      return res.status(400).json({ message: "Invalid user data" });
    }

    console.log("User:", user);

    //file save on temp folder
    let filePath;
    try {
      filePath = await saveFileToTemp(file);
    } catch (err) {
      return res
        .status(500)
        .json({ message: "File saved/upload failed", error: err });
    }

    // need to creatr method generate unique id
    const uniqueId = generateUniqueId(user.name, user.organization, user.id);

    // Step 1: Validate the data
    const validation = await validateData(filePath);
    console.log(validation); // Call your Python validator
    if (validation.quality === "BAD") {
      // Call submitData with isValid = false
      await penalizeUser(user.name, user.organization, user.uniqueId);
      return res.status(400).json({
        message: "Data validation failed",
        issues: validation.issues,
      });
    }

    let ipfsHash; 

    // Step 2: Upload to Pinata (IPFS)
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

    const tx = await submitDataToContract(
        user.name,
        user.organization,
        uniqueId,
        ipfsHash
        );

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
