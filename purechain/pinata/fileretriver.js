import axios from "axios";
import fs from "fs";
import csv from "csv-parser";

export async function retrieveFileFromIPFS(ipfsHash) {
  try {
    const gatewayURL = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    const response = await axios.get(gatewayURL, { responseType: "stream" });

    const outputPath = `./retrieved-${ipfsHash}.txt`;
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    // Return a promise that resolves when the file is written and parsed
    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`File retrieved and saved to: ${outputPath}`);

        // Read and parse the CSV file
        const results = [];
        fs.createReadStream(outputPath)
          .pipe(csv())
          .on("data", (data) => results.push(data))
          .on("end", () => {
            resolve(results); // Resolve with the parsed CSV data
          })
          .on("error", (error) => {
            reject(error); // Reject if there's an error parsing the CSV
          });
      });

      writer.on("error", (error) => {
        reject(error); // Reject if there's an error writing the file
      });
    });
  } catch (error) {
    console.error("Error retrieving file from IPFS:", error.message);
    throw error; // Propagate the error
  }
}

// Usage example:
// (async () => {
//   const ipfsHash = "QmVzJEAuVPsULq1r7tqa3g5dJEwKpuEUYfzFWnDFhfgC25";
//   await retrieveFileFromIPFS(ipfsHash);
// })();
