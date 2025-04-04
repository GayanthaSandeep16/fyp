import { fetchAllValidData, sendNotifications, dataToCsvString, dataToCsvStringForKMeans } from "../services/admin.service.js";
import { recordTransaction } from "../services/blockchain.service.js";
import { prepareKMeansData } from "../utils/kmeansUtils.js";
import { ConvexHttpClient } from "convex/browser";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { sendEmail } from "../utils/email.js";
import { fileURLToPath } from "url";

// Derive __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  let tempFilePath;
  const user = req.user;
  const sector = req.body.sector;
  const modelId = req.body.modelId;

  // Correctly determine modelChoice based on modelId
  const modelChoice = modelId === "model1" ? "RandomForest" : "KMeans";
  console.log(`Model id: ${modelId}, Model choice: ${modelChoice}`);

  let formattedSector = sector;
  if (sector === "healthcare") {
    formattedSector = "Healthcare";
  } else if (sector === "finance") {
    formattedSector = "Finance";
  }
  

  try {
    if (!modelId) {
      return res.status(400).json({ error: "Model ID is required" });
    }
    if (!sector || !["healthcare", "finance"].includes(sector)) {
      return res.status(400).json({ error: "Sector is required and must be 'healthcare' or 'finance'" });
    }
    if (!["model1", "model2"].includes(modelId)) {
      return res.status(400).json({ error: "Model ID must be 'model1' or 'model2'" });
    }

    const modelType = modelChoice;
    console.log(`Model type: ${modelType}`);

    console.log(`Fetching all valid data for model ${modelId}, sector ${formattedSector}, modelChoice ${modelChoice} from Convex...`);
    let allData = await fetchAllValidData(modelId, formattedSector);

    if (allData.length < 2) {
      return res.status(400).json({
        error: `Insufficient data for training ${modelId} in ${sector} sector with ${modelChoice}. At least 2 valid submissions are required, but found ${allData.length}.`,
      });
    }
    if (modelChoice === "KMeans") {
      console.log("Entering K-Means preparation path...");
      allData = prepareKMeansData(allData);
      const csvString = await dataToCsvStringForKMeans(allData);
      tempFilePath = path.join(__dirname, "../../temp_data.csv");
      await fs.writeFile(tempFilePath, csvString);
      console.log(`Data saved to ${tempFilePath}`);
    } else {
      console.log("Using RandomForest path, keeping target column...");
      const csvString = await dataToCsvString(allData);
      tempFilePath = path.join(__dirname, "../../temp_data.csv");
      await fs.writeFile(tempFilePath, csvString);
      console.log(`Data saved to ${tempFilePath}`);
      console.log("CSV content sample:", csvString.slice(0, 500));
    }


    const startTime = Date.now();
    const pythonScript = modelChoice === "KMeans" ? "./ml/kmeans_train.py" : "./ml/mltrain.py";
    console.log(`Running Python script: ${pythonScript}`);
    const pythonProcess = spawn("python3", [pythonScript, tempFilePath]);
    const metrics = {};
    console.log("metrics object initialized:", metrics);

    pythonProcess.stdout.on("data", (data) => {
      const str = data.toString();
      console.log(`Python: ${str}`);
      if (modelChoice === "RandomForest") {
        if (str.match(/Accuracy: ([\d.]+)/)) metrics.accuracy = parseFloat(str.match(/Accuracy: ([\d.]+)/)[1]);
        if (str.match(/F1 Score: ([\d.]+)/)) metrics.f1Score = parseFloat(str.match(/F1 Score: ([\d.]+)/)[1]);
        if (str.match(/Precision: ([\d.]+)/)) metrics.precision = parseFloat(str.match(/Precision: ([\d.]+)/)[1]);
        if (str.match(/Recall: ([\d.]+)/)) metrics.recall = parseFloat(str.match(/Recall: ([\d.]+)/)[1]);
      } else {
        if (str.match(/Silhouette Score: ([\d.]+)/)) {
          metrics.silhouetteScore = parseFloat(str.match(/Silhouette Score: ([\d.]+)/)[1]);
        }
      }
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python Error: ${data}`);
    });

    await new Promise((resolve, reject) => {
      pythonProcess.on("close", async (code) => {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        console.log(`Training completed in ${duration} seconds`);

        if (code !== 0) {
          return reject(new Error(`Python script failed with code ${code}`));
        }

        if (modelChoice === "RandomForest" && metrics.f1Score && metrics.f1Score < 0.7) {
          console.warn("Low F1 score detected. Model quality may be poor.");
          await sendEmail(
            process.env.ADMIN_EMAIL,
            "Low Model Performance Warning",
            `The Random Forest model trained for ${modelId} in ${sector} sector with an F1 score of ${metrics.f1Score}, which is below the threshold of 0.7.`
          ).catch((emailError) => console.error("Failed to send admin notification:", emailError));
        }

        const modelVersion = Date.now();
        const modelFileName = `${modelType.toLowerCase()}_model_${modelVersion}.pkl`;
        const modelFilePath = path.join(__dirname, `../../${modelFileName}`);
        const scalerFilePath = path.join(__dirname, `../../scaler_${modelVersion}.pkl`);
        await fs.rename(path.join(__dirname, "../../model.pkl"), modelFilePath);
        await fs.rename(path.join(__dirname, "../../scaler.pkl"), scalerFilePath);

        const txReceipt = await recordTransaction(modelId, user.walletAddress);

        const trainingRunId = await convex.mutation("trainingRuns:logTrainingRun", {
          modelId,
          triggeredByUserId: user._id,
          triggeredByWalletAddress: user.walletAddress,
          duration,
          status: modelChoice === "RandomForest" && metrics.f1Score && metrics.f1Score < 0.7 ? "LOW_PERFORMANCE" : "SUCCESS",
          trainingTxHash: txReceipt.transactionHash,
          created_at: Date.now(),
        });

        await convex.mutation("transactions:logTransaction", {
          txHash: txReceipt.transactionHash,
          type: "TRAINING",
          userId: user._id,
          walletAddress: user.walletAddress,
          uniqueId: `${modelId}_${modelVersion}`,
          status: txReceipt.status ? "SUCCESS" : "FAILED",
          blockNumber: txReceipt.blockNumber.toString(),
          eventName: "ModelTrained",
          eventArgs: { modelId },
          created_at: Date.now(),
        });

        const savedModelId = await convex.mutation("model:saveModelDetails", {
          dataCount: allData.length,
          modelType,
          metrics,
          status: "success",
          modelFilePath,
          scalerFilePath,
          created_at: Date.now(),
        });

        console.log(`Fetching valid and invalid users for notifications (modelId: ${modelId})...`);
        const validUsers = await convex.query("users:validSubmissions", { modelId, sector: formattedSector });
        const invalidUsers = await convex.query("users:InValidSubmissions", { modelId, sector: formattedSector });
        console.log(`Valid users: ${validUsers.length}, Invalid users: ${invalidUsers.length}`);
        console.log("Valid users sample:", validUsers.slice(0, 2));
        console.log("Invalid users sample:", invalidUsers.slice(0, 2));

        console.log("Sending notifications...");
        const emailErrors = await sendNotifications(validUsers, invalidUsers, metrics, modelChoice);
        console.log(`Notifications sent. Email errors: ${emailErrors.length > 0 ? emailErrors : "None"}`);

        res.status(200).json({
          message: `${modelChoice} Trained successfully for ${modelId} in ${sector} sector`,
          modelVersion: modelVersion.toString(),
          dataCount: allData.length,
          modelType,
          metrics,
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

// Rest of the file remains unchanged
const getvalidUser = async (req, res) => {
  try {
    const modelId = req.query.modelId;
    console.log(`Fetching valid submissions ${modelId ? `for model ${modelId}` : "for all models"} from Convex...`);
    const allData = await convex.query("users:validSubmissions", modelId ? { modelId } : {});

    if (allData.length === 0) {
      return res.status(200).json({ message: modelId ? `Nobody submitted valid data to ${modelId}` : "No valid submissions found" });
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error("Error in /valid-submissions endpoint:", error);
    res.status(500).json({ error: "Failed to fetch valid submissions", details: error.message });
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
    const modelId = req.query.modelId; // Get modelId from query params
    console.log(`Fetching invalid submissions ${modelId ? `for model ${modelId}` : "for all models"} from Convex...`);
    const allData = await convex.query("users:InValidSubmissions", modelId ? { modelId } : {});

    if (allData.length === 0) {
      return res.status(200).json({ message: modelId ? `Nobody submitted invalid data to ${modelId}` : "No invalid submissions found" });
    }

    res.status(200).json(allData);
  } catch (error) {
    console.error("Error in /invalid-submissions endpoint:", error);
    res.status(500).json({ error: "Failed to fetch invalid submissions", details: error.message });
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