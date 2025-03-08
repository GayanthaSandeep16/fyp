import axios from "axios";
import fs from "fs";

 export async function retrieveFileFromIPFS(ipfsHash) {
  try {
    const gatewayURL = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    const response = await axios.get(gatewayURL, { responseType: "stream" });

    const outputPath = `./retrieved-${ipfsHash}.txt`;
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      console.log(`File retrieved and saved to: ${outputPath}`);
    });
  } catch (error) {
    console.error("Error retrieving file from IPFS:", error.message);
  }
}

// Usage example:
// (async () => {
//   const ipfsHash = "QmPcWxNJ5ew598yKt7prXuE6phvEg8BB3PU4DppFsseiYD";
//   await retrieveFileFromIPFS(ipfsHash);
// })();
