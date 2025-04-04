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
 * Fetches all valid submissions for a specific modelId and retrieves the actual data.
 * @param {string} modelId - The ID of the model to fetch data for.
 * @returns {Promise<Array>} Array of data rows ready for training.
 */
async function fetchAllValidData(modelId,sector) {
  try {
    if (!modelId) {
      throw new Error("Model ID is required, bro!");
    }

    console.log(`Grabbing valid data for model ${modelId}... and sector ${sector}`);
    
    const validatedData = await convex.query("submissions:getValidatedData", {
      modelId,
      quality: "VALID",
      sector,
    });

    console.log(validatedData)

    if (!validatedData || validatedData.length === 0) {
      console.log(`No valid data found for model ${modelId}`);
      return [];
    }

    const allData = [];
    let glucoseValues = [];
    let bloodPressureValues = [];
    let insulinValues = [];
    let dpfValues = [];
    let cholValues = [];
    let hdlValues = [];
    let ldlValues = [];
    let hba1cValues = [];

    // First pass: Collect values for imputation
    for (const entry of validatedData) {
      const ipfsHash = entry;
      if (!ipfsHash) {
        console.error(`No IPFS hash found in entry:`, entry);
        continue;
      }

      console.log(`Fetching from IPFS with hash: ${ipfsHash}`);
      let result;
      try {
        result = await retry(
          () => retrieveFileFromIPFS(ipfsHash),
          { retries: 2, factor: 2, minTimeout: 1000, maxTimeout: 5000 }
        );
      } catch (error) {
        console.error(`IPFS fetch failed for hash ${ipfsHash}:`, error);
        continue;
      }

      if (Array.isArray(result)) {
        result.forEach(row => {
          if ('diabetes' in row && row.blood_gluc) { // Dataset 2
            const glucose = parseFloat(row.blood_gluc);
            if (!isNaN(glucose)) glucoseValues.push(glucose);
            const hba1c = parseFloat(row.HbA1c_lev);
            if (!isNaN(hba1c)) hba1cValues.push(hba1c);
          } else if ('Outcome' in row && row.Glucose) { // Dataset 3
            const glucose = parseFloat(row.Glucose);
            if (!isNaN(glucose)) glucoseValues.push(glucose);
            const bloodPressure = parseFloat(row.BloodPressure);
            if (!isNaN(bloodPressure)) bloodPressureValues.push(bloodPressure);
            const insulin = parseFloat(row.Insulin);
            if (!isNaN(insulin) && insulin !== 0) insulinValues.push(insulin);
            const dpf = parseFloat(row.DiabetesPedigreeFunction);
            if (!isNaN(dpf)) dpfValues.push(dpf);
          } else if ('CLASS' in row) { // Dataset 1
            const chol = parseFloat(row.Chol);
            if (!isNaN(chol)) cholValues.push(chol);
            const hdl = parseFloat(row.HDL);
            if (!isNaN(hdl)) hdlValues.push(hdl);
            const ldl = parseFloat(row.LDL);
            if (!isNaN(ldl)) ldlValues.push(ldl);
            const hba1c = parseFloat(row.HbA1c);
            if (!isNaN(hba1c)) hba1cValues.push(hba1c);
          }
        });
      }
    }

    // Compute means for imputation
    const meanGlucose = glucoseValues.length > 0 
      ? glucoseValues.reduce((sum, val) => sum + val, 0) / glucoseValues.length 
      : 0;
    const meanBloodPressure = bloodPressureValues.length > 0 
      ? bloodPressureValues.reduce((sum, val) => sum + val, 0) / bloodPressureValues.length 
      : 0;
    const meanInsulin = insulinValues.length > 0 
      ? Math.min(insulinValues.reduce((sum, val) => sum + val, 0) / insulinValues.length, 15) // Cap at 15
      : 15; // Default to 15 if no values
    const meanDpf = dpfValues.length > 0 
      ? dpfValues.reduce((sum, val) => sum + val, 0) / dpfValues.length 
      : 0;
    const meanChol = cholValues.length > 0 
      ? cholValues.reduce((sum, val) => sum + val, 0) / cholValues.length 
      : 0;
    const meanHdl = hdlValues.length > 0 
      ? hdlValues.reduce((sum, val) => sum + val, 0) / hdlValues.length 
      : 0;
    const meanLdl = ldlValues.length > 0 
      ? ldlValues.reduce((sum, val) => sum + val, 0) / ldlValues.length 
      : 0;
    const meanHba1c = hba1cValues.length > 0 
      ? hba1cValues.reduce((sum, val) => sum + val, 0) / hba1cValues.length 
      : 0;

    console.log(`Mean glucose for imputation: ${meanGlucose}`);
    console.log(`Mean blood pressure for imputation: ${meanBloodPressure}`);
    console.log(`Mean insulin for imputation: ${meanInsulin}`);
    console.log(`Mean diabetes pedigree function for imputation: ${meanDpf}`);
    console.log(`Mean cholesterol for imputation: ${meanChol}`);
    console.log(`Mean HDL for imputation: ${meanHdl}`);
    console.log(`Mean LDL for imputation: ${meanLdl}`);
    console.log(`Mean HbA1c for imputation: ${meanHba1c}`);

    // Second pass: Standardize data and impute missing features
    for (const entry of validatedData) {
      const ipfsHash = entry;
      if (!ipfsHash) continue;

      let result;
      try {
        result = await retry(
          () => retrieveFileFromIPFS(ipfsHash),
          { retries: 2, factor: 2, minTimeout: 1000, maxTimeout: 5000 }
        );
      } catch (error) {
        console.error(`IPFS fetch failed for hash ${ipfsHash}:`, error);
        continue;
      }

      if (Array.isArray(result)) {
        const standardizedData = result.map(row => {
          if ('CLASS' in row) { // Dataset 1
            const targetValue = row.CLASS && typeof row.CLASS === 'string' 
              ? row.CLASS.toUpperCase() === 'N' ? 0 : 1 
              : null;
            if (targetValue === null) {
              console.warn(`Invalid CLASS value in row:`, row);
              return null;
            }
            return {
              gender: row.Gender && typeof row.Gender === 'string' 
                ? row.Gender.toUpperCase() === 'M' ? 1 : 0 
                : 0,
              age: parseFloat(row.AGE) || 0,
              bmi: parseFloat(row.BMI) || 0,
              hba1c: parseFloat(row.HbA1c) || meanHba1c,
              glucose: meanGlucose,
              bloodPressure: meanBloodPressure,
              insulin: meanInsulin,
              diabetesPedigreeFunction: meanDpf,
              chol: parseFloat(row.Chol) || meanChol,
              hdl: parseFloat(row.HDL) || meanHdl,
              ldl: parseFloat(row.LDL) || meanLdl,
              target: targetValue
            };
          } else if ('diabetes' in row) { // Dataset 2
            const targetValue = row.diabetes != null 
              ? parseInt(row.diabetes) === 1 ? 1 : 0 
              : null;
            if (targetValue === null) {
              console.warn(`Invalid diabetes value in row:`, row);
              return null;
            }
            return {
              gender: row.gender && typeof row.gender === 'string' 
                ? row.gender.toLowerCase() === 'male' ? 1 : 0 
                : 0,
              age: parseFloat(row.age) || 0,
              bmi: parseFloat(row.bmi) || 0,
              hba1c: parseFloat(row.HbA1c_lev) || meanHba1c,
              glucose: parseFloat(row.blood_gluc) || meanGlucose,
              bloodPressure: meanBloodPressure,
              insulin: meanInsulin,
              diabetesPedigreeFunction: meanDpf,
              chol: meanChol,
              hdl: meanHdl,
              ldl: meanLdl,
              target: targetValue
            };
          } else if ('Outcome' in row) { // Dataset 3
            const targetValue = row.Outcome != null 
              ? parseInt(row.Outcome) === 1 ? 1 : 0 
              : null;
            if (targetValue === null) {
              console.warn(`Invalid Outcome value in row:`, row);
              return null;
            }
            return {
              gender: row.Pregnancies > 0 ? 0 : 1, // Infer gender: Pregnancies > 0 implies female
              age: parseFloat(row.Age) || 0,
              bmi: parseFloat(row.BMI) || 0,
              hba1c: meanHba1c, // Not present in Dataset 3, impute
              glucose: parseFloat(row.Glucose) || meanGlucose,
              bloodPressure: parseFloat(row.BloodPressure) || meanBloodPressure,
              insulin: parseFloat(row.Insulin) || meanInsulin,
              diabetesPedigreeFunction: parseFloat(row.DiabetesPedigreeFunction) || meanDpf,
              chol: meanChol,
              hdl: meanHdl,
              ldl: meanLdl,
              target: targetValue
            };
          } else {
            console.error(`Row does not match expected format:`, row);
            return null;
          }
        }).filter(row => row !== null);

        allData.push(...standardizedData);
      } else {
        console.error(`Expected array from IPFS for hash ${ipfsHash}, got:`, typeof result);
        continue;
      }
    }

    console.log(`Got ${allData.length} rows for model ${modelId}, bro!`);
    if (allData.length > 0) {
      console.log("Here’s a sneak peek:", allData.slice(0, 2));
      const targetCounts = allData.reduce((counts, row) => {
        counts[row.target] = (counts[row.target] || 0) + 1;
        return counts;
      }, {});
      console.log("Class distribution:", targetCounts);
    } else {
      console.warn(`No valid rows remain after cleaning for model ${modelId}`);
    }
    return allData;
  } catch (error) {
    console.error(`Something went wrong fetching data for model ${modelId}:`, error);
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

  const headers = [
    'gender', 'age', 'bmi', 'hba1c', 'glucose', 'bloodPressure', 'insulin',
    'diabetesPedigreeFunction', 'chol', 'hdl', 'ldl', 'target'
  ];

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

  const csvContent = [headers.join(","), ...rows].join("\n");
  console.log("CSV content preview:", csvContent.slice(0, 500)); // Log first 500 characters of CSV
  return csvContent;
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