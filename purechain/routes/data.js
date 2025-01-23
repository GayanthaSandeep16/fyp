const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

//Data Submission Endpoint
router.post("/submit-data", async (req, res) => {
  const { name, organization, id } = req.body; // User details
  const { file } = req.files; // Uploaded data file

  if (!name || !organization || !id || !file) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  //file save on temp folder
  let filePath;
    try {
      filePath = await saveFileToTemp(file);
    } catch (err) {
      return res.status(500).json({ message: "File upload failed", error: err });
    }

  // need to creatr method generate unique id
  const uniqueId = generateUniqueId(name, organization, id);

  // Step 1: Validate the data
  const validation = await validateData(filePath);
  console.log(validation); // Call your Python validator
  if (validation.quality === "BAD") {
    // Call submitData with isValid = false
    await penalizeUser(name, organization, uniqueId);
    return res.status(400).json({
      message: "Data validation failed",
      issues: validation.issues,
    });
  }

  // Step 2: Upload to Pinata (IPFS)
  try {
     const ipfsHash = await uploadFileToPinata(filePath, {
      name: `${name}_${Date.now()}`,
      keyvalues: {
        userId: id,
        organization: organization,
        uniqueId: uniqueId,
        validationStatus: "VALID"
      }
    });

    // Step 3: Save user details and IPFS hash in smart contract
    const tx = await contract.methods
      .submitData(name, organization, uniqueId, ipfsHash, true)
      .send({
        from: process.env.ACCOUNT_ADDRESS,
        gas: 3000000,
      });

    res.json({
      message: "Data submitted successfully",
      ipfsHash,
      transactionHash: tx.transactionHash,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

async function saveFileToTemp(file) {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(__dirname, "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir); // Create temp directory if it doesn't exist
    }

    const filePath = path.join(tempDir, file.name);
    file.mv(filePath, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(filePath); // Resolve with the file path
    });
  });
}

// Function to generate unique ID
function generateUniqueId(name, organization, id) {
  return `${name}-${organization}-${id}`;
}

// Function to penalize user
async function penalizeUser(name, organization, uniqueId) {
  const tx = await contract.methods
      .submitData(
        name,
        organization,
        uniqueId,
        "", // Empty IPFS hash for invalid data
        false
      )
      .send({
        from: process.env.ACCOUNT_ADDRESS,
        gas: 3000000,
      });
  console.log("User penalized:", tx.transactionHash);
}


async function validateData(filePath) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn("python", [
      "./dataValidator/dataValidator.py",
      filePath,
    ]);

    let result = "";
    pythonProcess.stdout.on("data", (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      reject({ error: `Validator error: ${data.toString()}` });
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject({ error: `Validator exited with code ${code}` });
        return;
      }

      try {
        resolve(JSON.parse(result));
      } catch (e) {
        reject({ error: "Failed to parse validator output" });
      }
    });
  });
}

module.exports = router;
