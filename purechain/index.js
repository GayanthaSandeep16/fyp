require('dotenv').config();
const pinataSDK = require('@pinata/sdk');
const fs = require('fs');
const path = require('path');

const { PINATA_API_KEY, PINATA_API_SECRET } = process.env;

if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    console.error("Pinata API Key or Secret is missing. Check your .env file.");
    process.exit(1);
}

const pinata = new pinataSDK(PINATA_API_KEY, PINATA_API_SECRET);

async function uploadFileToPinata(filePath, metadata = {}) {
    try {
        const fileName = path.basename(filePath);
        const readableStream = fs.createReadStream(filePath);

        const options = {
            pinataMetadata: {
                name: metadata.name || fileName,
                keyvalues: metadata.keyvalues || {}
            },
            pinataOptions: {
                cidVersion: metadata.cidVersion || 0,
                wrapWithDirectory: metadata.wrapWithDirectory || false,
            }
        };

        const result = await pinata.pinFileToIPFS(readableStream, options);
        console.log("File uploaded successfully!");
        console.log("IPFS Hash:", result.IpfsHash);
        console.log("Pin Size:", result.PinSize, "bytes");
        console.log("Timestamp:", result.Timestamp);

        return result.IpfsHash;
    } catch (error) {
        console.error("Error uploading file to Pinata:", error.message);
        throw error;
    }
}

// Usage example:
(async () => {
    const filePath = './hello-world.txt';
    const metadata = {
        name: "HelloWorldFile",
        keyvalues: {
            category: "example",
            owner: "user123"
        }
    };

    const ipfsHash = await uploadFileToPinata(filePath, metadata);
    console.log("Uploaded IPFS Hash:", ipfsHash);
})();
