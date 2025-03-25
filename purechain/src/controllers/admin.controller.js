import { fetchAllValidData, sendNotifications, dataToCsvString } from "../services/admin.service.js";
import { ConvexHttpClient } from "convex/browser";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { sendEmail } from "../utils/email.js"; // Import sendEmail for admin notifications

// Initialize Convex client with the CONVEX_URL_2 environment variable
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);

/**
 * trainModel
 * Trains a Random Forest model using validated data fetched from Convex and IPFS.
 * Implements model versioning, validates model performance, saves model details in Convex,
 * and sends notifications to users about the training results.
 * Restricted to admin users.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the training result or an error.
 */
const trainModel = async (req, res) => {
  let tempFilePath; // Declare tempFilePath for cleanup

  try {
    console.log("Fetching all valid data from Convex and Pinata...");
    const allData = await fetchAllValidData();

    // Check if there’s valid data to train on
    if (allData.length === 0) {
      return res.status(400).json({ error: "No valid data found to train on" });
    }

    // Convert the data to a CSV string and save it to a temporary file
    const csvString = await dataToCsvString(allData);
    tempFilePath = path.join(__dirname, "../../temp_data.csv"); // Use a consistent temp directory
    await fs.writeFile(tempFilePath, csvString);
    console.log(`Data saved to ${tempFilePath}`);

    // Run the Python script to train the Random Forest model
    const startTime = Date.now(); // Track training duration
    const pythonProcess = spawn("python3", ["./ml/mltrain.py", tempFilePath]);
    const metrics = { accuracy: null, f1Score: null, precision: null, recall: null };

    // Capture stdout to extract metrics
    pythonProcess.stdout.on("data", (data) => {
      const str = data.toString();
      console.log(`Python: ${str}`);
      if (str.match(/Accuracy: ([\d.]+)/)) metrics.accuracy = parseFloat(str.match(/Accuracy: ([\d.]+)/)[1]);
      if (str.match(/F1 Score: ([\d.]+)/)) metrics.f1Score = parseFloat(str.match(/F1 Score: ([\d.]+)/)[1]);
      if (str.match(/Precision: ([\d.]+)/)) metrics.precision = parseFloat(str.match(/Precision: ([\d.]+)/)[1]);
      if (str.match(/Recall: ([\d.]+)/)) metrics.recall = parseFloat(str.match(/Recall: ([\d.]+)/)[1]);
    });

    // Log any errors from the Python script
    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python Error: ${data}`);
    });

    // Handle the Python script completion
    await new Promise((resolve, reject) => {
      pythonProcess.on("close", async (code) => {
        const duration = (Date.now() - startTime) / 1000; // Duration in seconds
        console.log(`Training completed in ${duration} seconds`);

        if (code !== 0) {
          return reject(new Error(`Python script failed with code ${code}`));
        }

        // Validate model performance
        if (metrics.f1Score && metrics.f1Score < 0.7) {
          console.warn("Low F1 score detected. Model quality may be poor.");
          try {
            await sendEmail(
              process.env.ADMIN_EMAIL, 
              "Low Model Performance Warning",
              `The Random Forest model trained with an F1 score of ${metrics.f1Score}, which is below the threshold of 0.7. Consider reviewing the data or model parameters.`
            );
          } catch (emailError) {
            console.error("Failed to send admin notification:", emailError);
          }
        }

        // Model versioning: Move the model files to versioned paths
        const modelVersion = Date.now();
        const modelFilePath = path.join(__dirname, `../../rf_model_${modelVersion}.pkl`);
        const scalerFilePath = path.join(__dirname, `../../scaler_${modelVersion}.pkl`);
        await fs.rename(path.join(__dirname, "../../rf_model.pkl"), modelFilePath);
        await fs.rename(path.join(__dirname, "../../scaler.pkl"), scalerFilePath);

        // Save model details in Convex
        const modelId = await convex.mutation("model:saveModelDetails", {
          dataCount: allData.length,
          modelType: "RandomForest",
          accuracy: metrics.accuracy !== null ? metrics.accuracy.toString() : "N/A",
          f1Score: metrics.f1Score !== null ? metrics.f1Score.toString() : "N/A",
          precision: metrics.precision !== null ? metrics.precision.toString() : "N/A",
          recall: metrics.recall !== null ? metrics.recall.toString() : "N/A",
          status: "success",
          timestamp: Date.now(),
          modelFilePath,
          scalerFilePath,
        });

        // Fetch valid and invalid submissions for notifications
        const validUsers = await convex.query("users:validSubmissions", {});
        const invalidUsers = await convex.query("users:InValidSubmissions", {});

        // Send notifications to users with all metrics
        const emailErrors = await sendNotifications(validUsers, invalidUsers, metrics);

        // Respond with the training result
        res.status(200).json({
          message: "RandomForest model trained successfully",
          modelId,
          modelVersion: modelVersion.toString(),
          dataCount: allData.length,
          modelType: "RandomForest",
          accuracy: metrics.accuracy || "N/A",
          f1Score: metrics.f1Score || "N/A",
          precision: metrics.precision || "N/A",
          recall: metrics.recall || "N/A",
          modelFilePath,
          scalerFilePath,
          emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
        });

        resolve();
      });
    });
  } catch (error) {
    console.error("Error in /train endpoint:", error);
    res.status(500).json({ error: "Failed to train model", details: error.message });
  } finally {
    // Clean up: Delete the temporary file if it exists
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log(`Temporary file deleted: ${tempFilePath}`);
      } catch (err) {
        console.error(`Failed to delete temporary file ${tempFilePath}:`, err);
      }
    }
  }
};

/**
 * getInvalidSubmissions
 * Fetches all submissions with validationStatus "INVALID" along with user details.
 * Restricted to admin users.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the list of invalid submissions or an error.
 */
const getvalidUser = async (req, res) => {
  try {
    console.log("Fetching all invalid submissions from Convex...");
    const allData = await convex.query("users:validSubmissions", {});
    
    if (allData.length === 0) {
      return res.status(404).json({ error: "No invalid submissions found" });
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error("Error in /invalid-submissions endpoint:", error);
    res.status(500).json({ error: "Failed to fetch invalid submissions", details: error.message });
  }
};

/**
 * getInvalidUser
 * Fetches all submissions with validationStatus "VALID" along with user details.
 * Restricted to admin users.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the list of valid submissions or an error.
 */
const getInvalidUser = async (req, res) => {
  try {
    console.log("Fetching all valid submissions from Convex...");
    const allData = await convex.query("users:InValidSubmissions", {});


    if (allData.length === 0) {
      return res.status(200).json({ error: "No valid submissions found" });
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error("Error in /valid-submissions endpoint:", error);
    res.status(500).json({ error: "Failed to fetch valid submissions", details: error.message });
  }
};

/**
 * getNotifications
 * Fetches all notifications for admin users.
 * Restricted to admin users.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the list of notifications or an error.
 */
const getNotifications = async (req, res) => {
  try {
    console.log("Fetching all notifications from Convex...");
    const notifications = await convex.query("notification:getAllNotifications");

    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ error: "No notifications found" });
    }

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error in /notifications endpoint:", error);
    res.status(500).json({ error: "Failed to fetch notifications", details: error.message });
  }
};

export default { trainModel, getInvalidUser, getvalidUser, getNotifications };