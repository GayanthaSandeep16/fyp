import { retrieveFileFromIPFS } from "../../pinata/fileretriver.js";
import { ConvexHttpClient } from "convex/browser";
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);
import { api } from "../../convex/_generated/api.js";


export async function fetchAllValidData() {
  try {
    const validatedData = await convex.query("getValidatedData", { quality: "VALID" });
    const allData = [];
    for (const entry of validatedData) {
      const ipfsHash = entry.ipfsHash;
      console.log(`Retrieving data from IPFS hash: ${ipfsHash}`);
      const csvData = await retrieveFileFromIPFS(ipfsHash);
      allData.push(...csvData);
    }
    return allData;
  } catch (error) {
    console.error("Error fetching valid data:", error);
    throw error;
  }
}

// Convert data to CSV string
export function dataToCsvString(data) {
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((header) => row[header] || "").join(","));
  return [headers.join(","), ...rows].join("\n");
}