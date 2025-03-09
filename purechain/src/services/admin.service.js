import { retrieveFileFromIPFS } from "../../pinata/fileretriver.js";
import { ConvexHttpClient } from "convex/browser";
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);


export async function fetchAllValidData() {
  try {
    const validatedData = await convex.query("submissions:getValidatedData", { quality: "VALID" });
    const allData = [];
    console.log(validatedData);

    for (const entry of validatedData) {
      console.log(`Retrieving data from IPFS hash: ${entry}`);
      const csvData = await retrieveFileFromIPFS(entry);
      allData.push(...csvData); // Spread the parsed CSV data into allData
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