import { fetchAllValidData, sendNotifications, dataToCsvString } from "../services/admin.service.js";
import { ConvexHttpClient } from "convex/browser";
import { spawn } from "child_process";
import fs from "fs";

const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);

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

    const csvString = await dataToCsvString(allData);
    const tempFilePath = "./temp_data.csv";
    fs.writeFileSync(tempFilePath, csvString);

    // Use Random Forest script instead of K-means
    const pythonProcess = spawn("python3", ["./ml/mltrain.py", tempFilePath]);
    let metrics = { accuracy: null, f1Score: null };

    pythonProcess.stdout.on("data", (data) => {
      const str = data.toString();
      console.log(`Python: ${str}`);
      if (str.match(/Accuracy: ([\d.]+)/)) metrics.accuracy = parseFloat(str.match(/Accuracy: ([\d.]+)/)[1]);
      if (str.match(/F1 Score: ([\d.]+)/)) metrics.f1Score = parseFloat(str.match(/F1 Score: ([\d.]+)/)[1]);
    });
    pythonProcess.stderr.on("data", (data) => console.error(`Python Error: ${data}`));

    pythonProcess.on("close", async (code) => {
      fs.unlinkSync(tempFilePath);
      if (code !== 0) {
        return res.status(500).json({ error: "Failed to train model" });
      }

      const modelId = await convex.mutation("api.models.saveModelDetails", {
        dataCount: allData.length,
        modelType: "RandomForest",
        accuracy: metrics.accuracy || "N/A",
        f1Score: metrics.f1Score || "N/A",
        status: "success",
      });

      const validUsers = await convex.query("users:getvalidSubmissionsWithUsers");
      const invalidUsers = await convex.query("users:getInvalidSubmissionsWithUsers");
      const emailErrors = await sendNotifications(validUsers, invalidUsers, metrics.f1Score);

      res.json({
        message: "RandomForest model trained successfully",
        modelId,
        dataCount: allData.length,
        modelType: "RandomForest",
        accuracy: metrics.accuracy || "N/A",
        f1Score: metrics.f1Score || "N/A",
        emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
      });
    });
  } catch (error) {
    console.error("Error in /train-model endpoint:", error);
    res.status(500).json({ error: "Failed to process data", details: error.message });
  }
};

// Other endpoints unchanged
const getInvalidUser = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (authHeader !== "AdminSecret123") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    console.log("Fetching all invalid data from Convex");
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
    console.log("Fetching all valid data from Convex");
    const allData = await convex.query("users:getvalidSubmissionsWithUsers");

    if (allData.length === 0) {
      return res.status(400).json({ error: "No valid data found" });
    }

    res.json(allData);
  } catch (error) {
    console.error("Error in /get-valid-data endpoint:", error);
    res.status(500).json({ error: "Failed to fetch valid data", details: error.message });
  }
};

const getNotifications = async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (authHeader !== "AdminSecret123") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    console.log("Fetching all notifications from Convex...");
    const notifications = await convex.query("notification:getAllNotifications");

    if (notifications.length === 0) {
      return res.status(400).json({ error: "No notifications found" });
    }

    res.json(notifications);
  } catch (error) {
    console.error("Error in /get-notifications endpoint:", error);
    res.status(500).json({ error: "Failed to fetch notifications", details: error.message });
  }
};

export default { trainModel, getInvalidUser, getvalidUser, getNotifications };