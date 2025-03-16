import {fetchAllValidData, dataToCsvString} from "../services/admin.service.js";
import { ConvexHttpClient } from "convex/browser";
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);
import { spawn } from "child_process";
import fs from "fs";
import { sendEmail } from "../utils/email.js";

const trainModel = async (req, res) => {
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

    const csvString = dataToCsvString(allData);
    const tempFilePath = "./temp_data.csv";
    fs.writeFileSync(tempFilePath, csvString);
    console.log(`Data saved to ${tempFilePath}`);

    const pythonProcess = spawn("python3", ["./ml/mltrain.py", tempFilePath]);
    let silhouetteScore = null;

    pythonProcess.stdout.on("data", (data) => {
      console.log(`Python: ${data}`);
      // Extract silhouette score from Python output (assuming it prints it)
      const match = data.toString().match(/Silhouette Score: ([\d.]+)/);
      if (match) silhouetteScore = match[1];
    });
    pythonProcess.stderr.on("data", (data) => console.error(`Python Error: ${data}`));

    pythonProcess.on("close", async (code) => {
      console.log(`Python script exited with code ${code}`);
      fs.unlinkSync(tempFilePath);

      if (code !== 0) {
        return res.status(500).json({ error: "Failed to train model" });
      }

      // Fetch valid and invalid users
      const validUsers = await convex.query("users:getvalidSubmissionsWithUsers");
      const invalidUsers = await convex.query("users:getInvalidSubmissionsWithUsers");

      // Send emails to valid users
      for (const submission of validUsers) {
        const emailText = `Congratulations, ${submission.user.name}! Your data (${submission.datasetName}) was used to build an ML model. The model's silhouette score is ${silhouetteScore || "N/A"}. Thank you for contributing to our Purechain platform!`;
        await sendEmail(submission.user.email, "Model Training Success", emailText);
      }

      // Send emails to invalid users
      for (const submission of invalidUsers) {
        const issues = submission.validationIssues || "Unknown issues"; // Adjust based on Convex schema
        const emailText = `Sorry, ${submission.user.name}. Your data (${submission.datasetName}) didn’t meet our quality standards and wasn’t used in the model. Issues: ${issues}. Please improve and resubmit!`;
        await sendEmail(submission.user.email, "Data Quality Notice", emailText);
      }

      res.json({
        message: "K-Means model trained successfully",
        dataCount: allData.length,
        modelType: "KMeans",
        silhouetteScore: silhouetteScore || "N/A",
      });
    });
  } catch (error) {
    console.error("Error in /train-model endpoint:", error);
    res.status(500).json({ error: "Failed to process data", details: error.message });
  }
};

  const getInvalidUser = async (req, res) => {
    const authHeader = req.headers["authorization"];
    if (authHeader !== "AdminSecret123") {
      return res.status(403).json({ error: "Unauthorized" });
    }
  
    try {
      console.log("Fetching all invalid data from Convex" );
      const allData = await convex.query("users:getInvalidSubmissionsWithUsers");
  
      if (allData.length === 0) {
        return res.status(400).json({ error: "No invalid data found" });
      }
  
      res.json(allData);
    } catch (error) {
      console.error("Error in /get-invalid-data endpoint:", error);
      res.status(500).json({ error: "Failed to fetch invalid data", details: error.message });
    }

  };

  const getvalidUser = async (req, res) => {
    const authHeader = req.headers["authorization"];
    if (authHeader !== "AdminSecret123") {
      return res.status(403).json({ error: "Unauthorized" });
    }
  
    try {
      console.log("Fetching all invalid data from Convex" );
      const allData = await convex.query("users:getvalidSubmissionsWithUsers");
  
      if (allData.length === 0) {
        return res.status(400).json({ error: "No invalid data found" });
      }
  
      res.json(allData);
    } catch (error) {
      console.error("Error in /get-invalid-data endpoint:", error);
      res.status(500).json({ error: "Failed to fetch invalid data", details: error.message });
    }

  };
  
  export default { trainModel,getInvalidUser,getvalidUser };