import {fetchAllValidData, dataToCsvString} from "../services/admin.service.js";
import { spawn } from "child_process";
import fs from "fs";

const trainModel =  async (req, res) => {
    const authHeader = req.headers["authorization"];
    if (authHeader !== "AdminSecret123") {
      return res.status(403).json({ error: "Unauthorized" });
    }
  
    try {
      console.log("Fetching all valid data from Convex and Pinata...");
      const allData = await fetchAllValidData();
  
      if (allData.length === 0) {
        return res.status(400).json({ error: "No valid data found to train on" });
      }
  
      // Save combined data to a temporary CSV
      const csvString = dataToCsvString(allData);
      const tempFilePath = "./temp_data.csv";
      fs.writeFileSync(tempFilePath, csvString);
      console.log(`Data saved to ${tempFilePath}`);
  
      // Trigger Python script
      const pythonProcess = spawn("python3", ["./ml/mltrain.py", tempFilePath]);
  
      pythonProcess.stdout.on("data", (data) => console.log(`Python: ${data}`));
      pythonProcess.stderr.on("data", (data) => console.error(`Python Error: ${data}`));
  
      pythonProcess.on("close", (code) => {
        console.log(`Python script exited with code ${code}`);
        fs.unlinkSync(tempFilePath); // Clean up temp file
        if (code === 0) {
          res.json({
            message: "K-Means model trained successfully",
            dataCount: allData.length,
            modelType: "KMeans",
          });
        } else {
          res.status(500).json({ error: "Failed to train model" });
        }
      });
    } catch (error) {
      console.error("Error in /train-model endpoint:", error);
      res.status(500).json({ error: "Failed to process data", details: error.message });
    }
  };
  
  export default { trainModel };