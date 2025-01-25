// const express = require("express");
// const router = express.Router();
// const { spawn } = require("child_process");
// const Web3 = require("web3");
// const fs = require("fs");
// const path = require("path");
// const { uploadFileToPinata } = require("../pinata/fileUpload");
// const DataQualityArtifact = require("../build/contracts/DataQuality.json");
// require("dotenv").config();
// const db = require('../database/database');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const authenticate = require('../middleware/auth');



// // Web3 Configuration
// const web3 = new Web3("HTTP://127.0.0.1:7545");
// const networkId = 5777; // Verify this matches your Ganache network ID

// web3.eth
//   .getAccounts()
//   .then((accounts) =>
//     console.log(`Connected to Ganache. Accounts found: ${accounts.length}`)
//   )
//   .catch((err) => console.error("Web3 connection failed:", err));

// // Contract Setup
// const contractAddress = process.env.CONTRACT_ADDRESS;
// if (!contractAddress) throw new Error("CONTRACT_ADDRESS not set in .env");

// const contract = new web3.eth.Contract(
//   DataQualityArtifact.abi,
//   contractAddress,
//   { from: process.env.ACCOUNT_ADDRESS } // Add default from address
// );


// router.get("/test", (req, res) => {
//   res.send("Hello FYP");
// });

// //Data Submission Endpoint
// router.post("/submit-data", authenticate, async (req, res) => {
//   const file = req.files?.files;

//   if (!file) {
//     return res.status(400).json({ message: "Missing file" });
//   }

//   try {
//     // Get user from database using JWT data
//     const user = db.prepare(`
//       SELECT * FROM users WHERE id = ?
//     `).get(req.user.userId);

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Move all user-dependent logic inside the try block
//     if (!user.name || !user.organization || !user.id) {
//       return res.status(400).json({ message: "Invalid user data" });
//     }

//     console.log("User:", user);
  
//   //file save on temp folder
//   let filePath;
//   try {
//     filePath = await saveFileToTemp(file);
//   } catch (err) {
//     return res
//       .status(500)
//       .json({ message: "File saved/upload failed", error: err });
//   }

//   // need to creatr method generate unique id
//   const uniqueId = generateUniqueId(user.name, user.organization, user.id);

//   // Step 1: Validate the data
//   const validation = await validateData(filePath);
//   console.log(validation); // Call your Python validator
//   if (validation.quality === "BAD") {
//     // Call submitData with isValid = false
//     await penalizeUser(user.name, user.organization, user.uniqueId);
//     return res.status(400).json({
//       message: "Data validation failed",
//       issues: validation.issues,
//     });
//   }

//   // Step 2: Upload to Pinata (IPFS)
//   try {
//      const ipfsHash = await uploadFileToPinata(filePath, {
//       name: `${user.name}_${Date.now()}`,
//       keyvalues: {
//         userId: user.id,
//         organization: user.organization,
//         uniqueId: user.uniqueId,
//         validationStatus: "VALID"
//       }
//     });


//     // Step 3: Save user details and IPFS hash in smart contract
//     const tx = await contract.methods
//       .submitData(user.name, user.organization, uniqueId, ipfsHash)
//       .send({
//         from: process.env.CONTRACT_ADDRESS,
//         gas: 3000000,
//       });

//     res.json({
//       message: "Data submitted successfully",
//       message: "Data is good",
//       ipfsHash,
//       transactionHash: tx.transactionHash,
//     });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// async function saveFileToTemp(file) {
//   return new Promise((resolve, reject) => {
//     const tempDir = path.join(__dirname, "temp");
//     if (!fs.existsSync(tempDir)) {
//       fs.mkdirSync(tempDir); // Create temp directory if it doesn't exist
//     }

//     const filePath = path.join(tempDir, file.name);
//     file.mv(filePath, (err) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(filePath); // Resolve with the file path
//     });
//   });
// }

// // Function to generate unique ID
// function generateUniqueId(name, organization, id) {
//   return `${name}-${organization}-${id}`;
// }

// // Function to penalize user
// async function penalizeUser(name, organization, uniqueId) {
//   const tx = await contract.methods
//     .penalizeUser(uniqueId) // Use the correct function
//     .send({
//       from: process.env.ACCOUNT_ADDRESS,
//       gas: 3000000,
//     });
//   console.log("User penalized:", tx.transactionHash);
// }

// async function validateData(filePath) {
//   return new Promise((resolve, reject) => {
//     const pythonProcess = spawn("python", [
//       "./dataValidator/dataValidator.py",
//       filePath,
//     ]);

//     let result = "";
//     pythonProcess.stdout.on("data", (data) => {
//       result += data.toString();
//     });

//     pythonProcess.stderr.on("data", (data) => {
//       reject({ error: `Validator error: ${data.toString()}` });
//     });

//     pythonProcess.on("close", (code) => {
//       if (code !== 0) {
//         reject({ error: `Validator exited with code ${code}` });
//         return;
//       }

//       try {
//         resolve(JSON.parse(result));
//       } catch (e) {
//         reject({ error: "Failed to parse validator output" });
//       }
//     });
//   });
// }

// // Web3 status endpoint
// router.get("/web3-status", async (req, res) => {
//   try {
//     const block = await web3.eth.getBlockNumber();
//     const accounts = await web3.eth.getAccounts();
//     res.json({
//       connected: true,
//       blockNumber: block,
//       accountCount: accounts.length,
//       currentProvider: web3.currentProvider.constructor.name,
//     });
//   } catch (error) {
//     res.status(500).json({ connected: false, error: error.message });
//   }
// });


// // Login endpoint
// router.post("/signup", async (req, res) => {
//   const { name, nationalId, email, password, organization, sector } = req.body;

//   // Validation (add password check)
//   if (!name || !nationalId || !email || !password || !organization || !sector) {
//     return res.status(400).json({ message: "Missing required fields" });
//   }

//   // Hash password
//   const hashedPassword = await bcrypt.hash(password, 10);

//   try {
//     const stmt = db.prepare(`
//       INSERT INTO users 
//       (name, national_id, email, password, organization, sector)
//       VALUES (?, ?, ?, ?, ?, ?)
//     `);

//     const result = stmt.run(
//       name, 
//       nationalId, 
//       email, 
//       hashedPassword, 
//       organization, 
//       sector
//     );
    
//     res.status(201).json({
//       message: "User registered successfully",
//       userId: result.lastInsertRowid
//     });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });


// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     // Find user by email
//     const user = db.prepare(`
//       SELECT * FROM users WHERE email = ?
//     `).get(email);

//     if (!user) return res.status(401).json({ message: "Invalid credentials" });

//     // Verify password
//     const validPassword = await bcrypt.compare(password, user.password);
//     if (!validPassword) return res.status(401).json({ message: "Invalid credentials" });

//     // Generate JWT
//     const token = jwt.sign(
//       { userId: user.id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '1h' }
//     );

//     res.json({ token });
//   } catch (error) {
//     res.status(500).json({ message: "Login failed" });
//   }
// });

// module.exports = router;
