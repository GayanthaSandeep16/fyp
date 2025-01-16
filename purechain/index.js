const PinataSDK = require("pinata-sdk"); // Use the correct SDK
const fs = require("fs");
require("dotenv").config();

// Initialize Pinata SDK
const pinata = new PinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

async function upload() {
  try {
    // Create a readable stream from the file
    const readableStreamForFile = fs.createReadStream("./hello-world.txt");

    // Upload the file to Pinata
    const result = await pinata.pinFileToIPFS(readableStreamForFile);

    // Log the result (IPFS hash)
    console.log("File uploaded successfully!");
    console.log("IPFS Hash:", result.IpfsHash);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
}

upload();