import pinataSDK from "@pinata/sdk";
import fs from "fs";
import path from "path";
import retry from "async-retry";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);

export async function uploadFileToPinata(filePath, metadata = {}) {
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

  try {
    const result = await retry(
      async () => {
        const response = await pinata.pinFileToIPFS(readableStream, options);
        if (!response || !response.IpfsHash) {
          throw new Error("Pinata upload failed: No IPFS hash returned");
        }
        return response;
      },
      {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 5000,
      }
    );

    console.log("File uploaded successfully!");
    console.log("IPFS Hash:", result.IpfsHash);
    console.log("Pin Size:", result.PinSize, "bytes");
    console.log("Timestamp:", result.Timestamp);

    return result.IpfsHash;
  } catch (error) {
    console.error("Error uploading file to Pinata:", error.message || error);
    throw error;
  }
}