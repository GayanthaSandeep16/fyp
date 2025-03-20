import { retrieveFileFromIPFS } from "../../pinata/fileretriver.js";
import { ConvexHttpClient } from "convex/browser";
import { sendEmail } from "../utils/email.js";
import pkg from 'papaparse';
import fs from 'fs/promises';
import retry from 'async-retry';
const { parse } = pkg;

const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);

/**
 * fetchAllValidData
 * Fetches all valid submissions from Convex, retrieves the data from IPFS, and standardizes it for training.
 * @returns {Promise<Array>} Array of standardized data rows.
 */
async function fetchAllValidData() {
  try {
    const validatedData = await convex.query("submissions:getValidatedData", { quality: "VALID" });
    const filteredData = validatedData.filter(hash => hash !== 'QmVzJEAuVPsULq1r7tqa3g5dJEwKpuEUYfzFWnDFhfgC25');
    const allData = [];

    for (const entry of filteredData) {
      console.log(`Retrieving data from IPFS hash: ${entry}`);
      let result;
      try {
        result = await retry(
          () => retrieveFileFromIPFS(entry),
          { retries: 3, factor: 2, minTimeout: 1000, maxTimeout: 5000 }
        );
      } catch (error) {
        console.error(`Failed to retrieve data from IPFS hash ${entry}:`, error);
        continue;
      }

      let csvText;
      if (typeof result === 'string') {
        csvText = result;
      } else if (Buffer.isBuffer(result)) {
        csvText = result.toString('utf8');
      } else if (typeof result === 'object' && result.path) {
        csvText = await fs.readFile(result.path, 'utf8');
      } else if (typeof result === 'object') {
        csvText = await fs.readFile(`./retrieved-${entry}.txt`, 'utf8');
        await fs.unlink(`./retrieved-${entry}.txt`);
      } else {
        throw new Error(`Unexpected return type from IPFS: ${typeof result}`);
      }

      const parsed = parse(csvText, { header: true, skipEmptyLines: true, dynamicTyping: true });

      // Map headers and standardize target
      const mappedData = parsed.data.map(row => {
        let targetValue;
        const rawTarget = row.diabetes || row.CLASS || row.Outcome;
        if (typeof rawTarget === 'string') {
          targetValue = rawTarget.toUpperCase() === 'Y' ? 1 : rawTarget.toUpperCase() === 'N' ? 0 : rawTarget;
        } else {
          targetValue = rawTarget; // Assume numeric (0 or 1)
        }
        targetValue = targetValue === 1 || targetValue === '1' ? 1 : 0; // Final binary conversion

        return {
          gender: row.gender || row.Gender,
          age: row.age || row.AGE || row.Age,
          bmi: row.bmi || row.BMI,
          hba1c: row.HbA1c || row.HbA1c_level || row.hba1c,
          glucose: row.blood_glucose_level || row.Glucose || row.glucose,
          target: targetValue,
        };
      });

      // Filter out rows with missing critical fields
      const requiredColumns = ['gender', 'age', 'bmi', 'target'];
      const cleanedData = mappedData.filter(row => 
        requiredColumns.every(col => row[col] !== undefined)
      );

      // Log data quality
      const totalRows = mappedData.length;
      const cleanedRows = cleanedData.length;
      const dropPercentage = totalRows > 0 ? ((totalRows - cleanedRows) / totalRows) * 100 : 0;
      console.log(`Dropped ${dropPercentage.toFixed(2)}% of rows due to missing critical fields`);

      allData.push(...cleanedData);
    }

    console.log(`Total cleaned rows: ${allData.length}`);
    console.log("Sample cleaned data:", allData.slice(0, 2));
    return allData;
  } catch (error) {
    console.error("Error fetching valid data:", error);
    throw error;
  }
}

/**
 * dataToCsvString
 * Converts the standardized data to a CSV string for training.
 * @param {Array} data - Array of data rows.
 * @returns {Promise<string>} CSV string.
 */
async function dataToCsvString(data) {
  if (data.length === 0) return "";

  const headers = ['gender', 'age', 'bmi', 'hba1c', 'glucose', 'target'];
  const escapeCsvValue = (value) => {
    if (value == null) return "";
    const str = String(value);
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = data.map(row =>
    headers.map(header => escapeCsvValue(row[header])).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * sendNotifications
 * Sends email notifications to users about the training results, including all metrics.
 * @param {Array} validUsers - List of users with valid submissions.
 * @param {Array} invalidUsers - List of users with invalid submissions.
 * @param {Object} metrics - Metrics of the trained model (accuracy, f1Score, precision, recall).
 * @returns {Promise<Array>} Array of email errors, if any.
 */
async function sendNotifications(validUsers, invalidUsers, metrics) {
  const emailPromises = [];

  // Send notifications for valid users
  for (const submission of validUsers) {
    const emailText = `Congratulations, ${submission.user.name}! Your data (${submission.datasetName}) was used to train a Random Forest model for diabetes prediction. The model achieved the following performance metrics:
      <table style="border-collapse: collapse; width: 50%;">
        <tr><th style="border: 1px solid #ddd; padding: 8px;">Metric</th><th style="border: 1px solid #ddd; padding: 8px;">Value</th></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Accuracy</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.accuracy || "N/A"}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">F1 Score</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.f1Score || "N/A"}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Precision</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.precision || "N/A"}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Recall</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.recall || "N/A"}</td></tr>
      </table>
      Thank you for contributing!`;
    const timestamp = Date.now();

    emailPromises.push(
      sendEmail(submission.user.email, "Model Training Success", emailText)
        .then(() =>
          convex.mutation("notification:createNotification", {
            userId: submission.userId,
            email: submission.user.email,
            subject: "Model Training Success",
            status: "success",
            timestamp,
          })
        )
        .catch((error) => ({
          error: `Failed to email ${submission.user.email}: ${error.message}`,
          notification: {
            userId: submission.userId,
            email: submission.user.email,
            subject: "Model Training Success",
            status: "failed",
            errorMessage: error.message,
            timestamp,
          },
        }))
    );
  }

  // Send notifications for invalid users
  for (const submission of invalidUsers) {
    const issues = submission.validationIssues || "Unknown issues";
    const emailText = `Sorry, ${submission.user.name}. Your data (${submission.datasetName}) didn’t meet quality standards and wasn’t used for training. Issues: ${issues}. Please improve and resubmit!`;
    const timestamp = Date.now();

    emailPromises.push(
      sendEmail(submission.user.email, "Data Quality Notice", emailText)
        .then(() =>
          convex.mutation("notification:createNotification", {
            userId: submission.userId,
            email: submission.user.email,
            subject: "Data Quality Notice",
            status: "success",
            timestamp,
          })
        )
        .catch((error) => ({
          error: `Failed to email ${submission.user.email}: ${error.message}`,
          notification: {
            userId: submission.userId,
            email: submission.user.email,
            subject: "Data Quality Notice",
            status: "failed",
            errorMessage: error.message,
            timestamp,
          },
        }))
    );
  }

  // Process all email promises
  const results = await Promise.all(emailPromises);
  const emailErrors = results
    .filter((result) => result && result.error)
    .map((result) => result.error);
  const failedNotifications = results
    .filter((result) => result && result.notification)
    .map((result) => result.notification);

  // Batch insert failed notifications
  if (failedNotifications.length > 0) {
    await Promise.all(
      failedNotifications.map((notification) =>
        convex.mutation("notification:createNotification", notification)
      )
    );
  }

  return emailErrors;
}

export { fetchAllValidData, dataToCsvString, sendNotifications };