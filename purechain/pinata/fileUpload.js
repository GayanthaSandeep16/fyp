import pinataSDK from "@pinata/sdk";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const { PINATA_API_KEY, PINATA_API_SECRET } = process.env;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// if (!PINATA_API_KEY || !PINATA_API_SECRET) {
//   console.error("Pinata API Key or Secret is missing. Check your .env file.");
//   process.exit(1);
// }

const pinata = new pinataSDK(PINATA_API_KEY, PINATA_API_SECRET);

export async function uploadFileToPinata(filePath, metadata = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("File does not exist");
    }
    const stats = fs.statSync(filePath);

    if (stats.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds 10MB limit");
    }

    if (!/\.(csv|json|txt)$/i.test(filePath)) {
      throw new Error("Invalid file type. Only CSV, JSON, TXT allowed");
    }
    const fileName = path.basename(filePath);
    const readableStream = fs.createReadStream(filePath);

    const options = {
      pinataMetadata: {
        name: metadata.name || fileName,
        keyvalues: metadata.keyvalues || {},
      },
      pinataOptions: {
        cidVersion: metadata.cidVersion || 0,
        wrapWithDirectory: metadata.wrapWithDirectory || false,
      },
    };

    const result = await pinata.pinFileToIPFS(readableStream, options);
    console.log("File uploaded successfully!");
    console.log("IPFS Hash:", result.IpfsHash);
    console.log("Pin Size:", result.PinSize, "bytes");
    console.log("Timestamp:", result.Timestamp);

    return result.IpfsHash;
  } catch (error) {
    console.error("Error uploading file to Pinata:", error.message || error);
    throw error instanceof Error ? error : new Error(error);
  }
}
