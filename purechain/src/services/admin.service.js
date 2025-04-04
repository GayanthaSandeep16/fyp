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
async function fetchAllValidData(modelId, sector) {
  try {
    if (!modelId) throw new Error("Model ID is required, bro!");
    console.log(`Grabbing valid data for model ${modelId}... and sector ${sector}`);

    const validatedData = await convex.query("submissions:getValidatedData", {
      modelId,
      quality: "VALID",
      sector,
    });
    console.log(validatedData);

    if (!validatedData || validatedData.length === 0) {
      console.log(`No valid data found for model ${modelId}`);
      return [];
    }

    const allData = [];

    if (sector === "Healthcare") {
      // Diabetes-specific logic
      let glucoseValues = [];
      let bloodPressureValues = [];
      let insulinValues = [];
      let dpfValues = [];
      let cholValues = [];
      let hdlValues = [];
      let ldlValues = [];
      let hba1cValues = [];

      for (const entry of validatedData) {
        const ipfsHash = entry;
        if (!ipfsHash) continue;

        let result = await retry(() => retrieveFileFromIPFS(ipfsHash), { retries: 2, factor: 2, minTimeout: 1000, maxTimeout: 5000 });
        if (Array.isArray(result)) {
          result.forEach(row => {
            if ('diabetes' in row && row.blood_gluc) {
              const glucose = parseFloat(row.blood_gluc);
              if (!isNaN(glucose)) glucoseValues.push(glucose);
              const hba1c = parseFloat(row.HbA1c_lev);
              if (!isNaN(hba1c)) hba1cValues.push(hba1c);
            } else if ('Outcome' in row && row.Glucose) {
              const glucose = parseFloat(row.Glucose);
              if (!isNaN(glucose)) glucoseValues.push(glucose);
              const bloodPressure = parseFloat(row.BloodPressure);
              if (!isNaN(bloodPressure)) bloodPressureValues.push(bloodPressure);
              const insulin = parseFloat(row.Insulin);
              if (!isNaN(insulin) && insulin !== 0) insulinValues.push(insulin);
              const dpf = parseFloat(row.DiabetesPedigreeFunction);
              if (!isNaN(dpf)) dpfValues.push(dpf);
            } else if ('CLASS' in row) {
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

      const meanGlucose = glucoseValues.length > 0 ? glucoseValues.reduce((sum, val) => sum + val, 0) / glucoseValues.length : 0;
      const meanBloodPressure = bloodPressureValues.length > 0 ? bloodPressureValues.reduce((sum, val) => sum + val, 0) / bloodPressureValues.length : 0;
      const meanInsulin = insulinValues.length > 0 ? Math.min(insulinValues.reduce((sum, val) => sum + val, 0) / insulinValues.length, 15) : 15;
      const meanDpf = dpfValues.length > 0 ? dpfValues.reduce((sum, val) => sum + val, 0) / dpfValues.length : 0;
      const meanChol = cholValues.length > 0 ? cholValues.reduce((sum, val) => sum + val, 0) / cholValues.length : 0;
      const meanHdl = hdlValues.length > 0 ? hdlValues.reduce((sum, val) => sum + val, 0) / hdlValues.length : 0;
      const meanLdl = ldlValues.length > 0 ? ldlValues.reduce((sum, val) => sum + val, 0) / ldlValues.length : 0;
      const meanHba1c = hba1cValues.length > 0 ? hba1cValues.reduce((sum, val) => sum + val, 0) / hba1cValues.length : 0;

      for (const entry of validatedData) {
        const ipfsHash = entry;
        if (!ipfsHash) continue;

        let result = await retry(() => retrieveFileFromIPFS(ipfsHash), { retries: 2, factor: 2, minTimeout: 1000, maxTimeout: 5000 });
        if (Array.isArray(result)) {
          const standardizedData = result.map(row => {
            if ('CLASS' in row) {
              const targetValue = row.CLASS && typeof row.CLASS === 'string' ? (row.CLASS.toUpperCase() === 'N' ? 0 : 1) : null;
              if (targetValue === null) return null;
              return {
                gender: row.Gender && typeof row.Gender === 'string' ? (row.Gender.toUpperCase() === 'M' ? 1 : 0) : 0,
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
            } else if ('diabetes' in row) {
              const targetValue = row.diabetes != null ? (parseInt(row.diabetes) === 1 ? 1 : 0) : null;
              if (targetValue === null) return null;
              return {
                gender: row.gender && typeof row.gender === 'string' ? (row.gender.toLowerCase() === 'male' ? 1 : 0) : 0,
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
            } else if ('Outcome' in row) {
              const targetValue = row.Outcome != null ? (parseInt(row.Outcome) === 1 ? 1 : 0) : null;
              if (targetValue === null) return null;
              return {
                gender: row.Pregnancies > 0 ? 0 : 1,
                age: parseFloat(row.Age) || 0,
                bmi: parseFloat(row.BMI) || 0,
                hba1c: meanHba1c,
                glucose: parseFloat(row.Glucose) || meanGlucose,
                bloodPressure: parseFloat(row.BloodPressure) || meanBloodPressure,
                insulin: parseFloat(row.Insulin) || meanInsulin,
                diabetesPedigreeFunction: parseFloat(row.DiabetesPedigreeFunction) || meanDpf,
                chol: meanChol,
                hdl: meanHdl,
                ldl: meanLdl,
                target: targetValue
              };
            }
            return null;
          }).filter(row => row !== null);
          allData.push(...standardizedData);
        }
      }
    } else if (sector === "Finance") {
      // Financial transaction logic
      let amountValues = [];
      let oldBalanceOrgValues = [];
      let newBalanceOrgValues = [];
      let oldBalanceDestValues = [];
      let newBalanceDestValues = [];

      for (const entry of validatedData) {
        const ipfsHash = entry;
        if (!ipfsHash) continue;

        let result = await retry(() => retrieveFileFromIPFS(ipfsHash), { retries: 2, factor: 2, minTimeout: 1000, maxTimeout: 5000 });
        if (Array.isArray(result)) {
          result.forEach(row => {
            if ('isFraud' in row) {
              const amount = parseFloat(row.amount);
              if (!isNaN(amount)) amountValues.push(amount);
              const oldbalanceOrg = parseFloat(row.oldbalanceOrg);
              if (!isNaN(oldbalanceOrg)) oldBalanceOrgValues.push(oldbalanceOrg);
              const newbalanceOrig = parseFloat(row.newbalanceOrig);
              if (!isNaN(newbalanceOrig)) newBalanceOrgValues.push(newbalanceOrig);
              const oldbalanceDest = parseFloat(row.oldbalanceDest);
              if (!isNaN(oldbalanceDest)) oldBalanceDestValues.push(oldbalanceDest);
              const newbalanceDest = parseFloat(row.newbalanceDest);
              if (!isNaN(newbalanceDest)) newBalanceDestValues.push(newbalanceDest);
            }
          });
        }
      }

      const meanAmount = amountValues.length > 0 ? amountValues.reduce((sum, val) => sum + val, 0) / amountValues.length : 0;
      const meanOldBalanceOrg = oldBalanceOrgValues.length > 0 ? oldBalanceOrgValues.reduce((sum, val) => sum + val, 0) / oldBalanceOrgValues.length : 0;
      const meanNewBalanceOrg = newBalanceOrgValues.length > 0 ? newBalanceOrgValues.reduce((sum, val) => sum + val, 0) / newBalanceOrgValues.length : 0;
      const meanOldBalanceDest = oldBalanceDestValues.length > 0 ? oldBalanceDestValues.reduce((sum, val) => sum + val, 0) / oldBalanceDestValues.length : 0;
      const meanNewBalanceDest = newBalanceDestValues.length > 0 ? newBalanceDestValues.reduce((sum, val) => sum + val, 0) / newBalanceDestValues.length : 0;

      console.log(`Mean amount: ${meanAmount}`);
      console.log(`Mean oldbalanceOrg: ${meanOldBalanceOrg}`);
      console.log(`Mean newbalanceOrig: ${meanNewBalanceOrg}`);
      console.log(`Mean oldbalanceDest: ${meanOldBalanceDest}`);
      console.log(`Mean newbalanceDest: ${meanNewBalanceDest}`);

      for (const entry of validatedData) {
        const ipfsHash = entry;
        if (!ipfsHash) continue;

        let result = await retry(() => retrieveFileFromIPFS(ipfsHash), { retries: 2, factor: 2, minTimeout: 1000, maxTimeout: 5000 });
        if (Array.isArray(result)) {
          const standardizedData = result.map(row => {
            if ('isFraud' in row) {
              const targetValue = row.isFraud != null ? (parseInt(row.isFraud) === 1 ? 1 : 0) : null;
              if (targetValue === null) return null;
              return {
                step: parseFloat(row.step) || 0,
                amount: parseFloat(row.amount) || meanAmount,
                oldbalanceOrg: parseFloat(row.oldbalanceOrg) || meanOldBalanceOrg,
                newbalanceOrig: parseFloat(row.newbalanceOrig) || meanNewBalanceOrg,
                oldbalanceDest: parseFloat(row.oldbalanceDest) || meanOldBalanceDest,
                newbalanceDest: parseFloat(row.newbalanceDest) || meanNewBalanceDest,
                target: targetValue
              };
            }
            return null;
          }).filter(row => row !== null);
          allData.push(...standardizedData);
        }
      }
    } else {
      throw new Error(`Unsupported sector: ${sector}`);
    }

    console.log(`Got ${allData.length} rows for model ${modelId}, bro!`);
    if (allData.length > 0) {
      console.log("Here’s a sneak peek:", allData.slice(0, 2));
      const targetCounts = allData.reduce((counts, row) => {
        counts[row.target] = (counts[row.target] || 0) + 1;
        return counts;
      }, {});
      console.log("Class distribution:", targetCounts);
    }
    return allData;
  } catch (error) {
    console.error(`Something went wrong fetching data for model ${modelId}:`, error);
    throw error;
  }
}

/**
 * dataToCsvStringForKMeans
 * Converts the standardized data to a CSV string for K-Means clustering.
 * * @param {Array} data - Array of data rows.
 * * @returns {Promise<string>} CSV string.
 * */
async function dataToCsvStringForKMeans(data) {
  if (data.length === 0) return "";
  // Use dynamic headers based on the first row, excluding 'target'
  const headers = Object.keys(data[0]).filter(key => key !== 'target');
  const escapeCsvValue = (value) => {
    if (value == null) return "";
    const str = String(value);
    if (str.includes(",") || str.includes("\n") || str.includes('"')) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const rows = data.map(row => headers.map(header => escapeCsvValue(row[header])).join(","));
  const csvContent = [headers.join(","), ...rows].join("\n");
  console.log("CSV content preview (K-Means):", csvContent.slice(0, 500));
  return csvContent;
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
// services/admin.service.js (partial)
async function sendNotifications(validUsers, invalidUsers, metrics, modelChoice) {
  console.log(`Starting sendNotifications for ${modelChoice}...`);
  console.log(`Valid users count: ${validUsers.length}, Invalid users count: ${invalidUsers.length}`);

  const emailPromises = [];

  for (const submission of validUsers) {
    if (!submission.user || !submission.user.email) {
      console.warn(`Skipping submission with missing user data: ${JSON.stringify(submission)}`);
      continue;
    }
    const userName = submission.user.name || "User";
    const userEmail = submission.user.email;
    console.log(`Processing valid submission for user: ${userName} (${userEmail})`);

    console.log("metrics : " + metrics)
    let emailText;
    if (modelChoice === "RandomForest") { // Match controller's value
      emailText = `Congratulations, ${userName}! Your data (${submission.datasetName || "unknown"}) was used to train Model 1 (Random Forest) for diabetes prediction. The model achieved the following performance metrics:
        <table style="border-collapse: collapse; width: 50%;">
          <tr><th style="border: 1px solid #ddd; padding: 8px;">Metric</th><th style="border: 1px solid #ddd; padding: 8px;">Value</th></tr>
          <tr><td style="border: 1px solid #ddd; padding: 8px;">Accuracy</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.accuracy || "N/A"}</td></tr>
          <tr><td style="border: 1px solid #ddd; padding: 8px;">F1 Score</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.f1Score || "N/A"}</td></tr>
          <tr><td style="border: 1px solid #ddd; padding: 8px;">Precision</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.precision || "N/A"}</td></tr>
          <tr><td style="border: 1px solid #ddd; padding: 8px;">Recall</td><td style="border: 1px solid #ddd; padding: 8px;">${metrics.recall || "N/A"}</td></tr>
        </table>
        Thank you for contributing!`;
    } else if (modelChoice === "KMeans") { // Match controller's value
      emailText = `Congratulations, ${userName}! Your data (${submission.datasetName || "unknown"}) was used to train Model 2 (K-Means) for data clustering. The model grouped the data into 2 clusters with a silhouette score of ${metrics.silhouetteScore || "N/A"}, indicating the quality of the clustering. Thank you for contributing!`;
    } else {
      console.warn(`Unknown modelChoice: ${modelChoice}, skipping email for ${userEmail}`);
      continue;
    }

  

    const timestamp = Date.now();
    console.log(`Preparing to send email to ${userEmail} with text: ${emailText.slice(0, 100)}...`);
    emailPromises.push(
      sendEmail(userEmail, "Model Training Success", emailText)
        .then(() => {
          console.log(`Email sent successfully to ${userEmail}`);
          return convex.mutation("notification:createNotification", {
            userId: submission.userId || "unknown",
            email: userEmail,
            subject: "Model Training Success",
            status: "success",
            timestamp,
          }).catch((convexError) => {
            console.error(`Failed to log notification to Convex for ${userEmail}: ${convexError.message}`);
          });
        })
        .catch((error) => {
          console.error(`Email failed for ${userEmail}: ${error.message}`);
          return {
            error: `Failed to email ${userEmail}: ${error.message}`,
            notification: {
              userId: submission.userId || "unknown",
              email: userEmail,
              subject: "Model Training Success",
              status: "failed",
              errorMessage: error.message,
              timestamp,
            },
          };
        })
    );
  }

  for (const submission of invalidUsers) {
    if (!submission.user || !submission.user.email) {
      console.warn(`Skipping invalid submission with missing user data: ${JSON.stringify(submission)}`);
      continue;
    }

    const userName = submission.user.name || "User";
    const userEmail = submission.user.email;
    console.log(`Processing invalid submission for user: ${userName} (${userEmail})`);

    const issues = submission.validationIssues || "Unknown issues";
    const emailText = `Sorry, ${userName}. Your data (${submission.datasetName || "unknown"}) didn’t meet quality standards. Issues: ${issues}. Please resubmit!`;
    const timestamp = Date.now();
    console.log(`Preparing to send email to ${userEmail} with text: ${emailText.slice(0, 100)}...`);
    emailPromises.push(
      sendEmail(userEmail, "Data Quality Notice", emailText)
        .then(() => {
          console.log(`Email sent successfully to ${userEmail}`);
          return convex.mutation("notification:createNotification", {
            userId: submission.userId || "unknown",
            email: userEmail,
            subject: "Data Quality Notice",
            status: "success",
            timestamp,
          }).catch((convexError) => {
            console.error(`Failed to log notification to Convex for ${userEmail}: ${convexError.message}`);
          });
        })
        .catch((error) => {
          console.error(`Email failed for ${userEmail}: ${error.message}`);
          return {
            error: `Failed to email ${userEmail}: ${error.message}`,
            notification: {
              userId: submission.userId || "unknown",
              email: userEmail,
              subject: "Data Quality Notice",
              status: "failed",
              errorMessage: error.message,
              timestamp,
            },
          };
        })
    );
  }

  console.log(`Awaiting ${emailPromises.length} email promises...`);
  const results = await Promise.all(emailPromises);
  const emailErrors = results.filter((result) => result && result.error).map((result) => result.error);
  const failedNotifications = results.filter((result) => result && result.notification).map((result) => result.notification);

  if (failedNotifications.length > 0) {
    console.log(`Logging ${failedNotifications.length} failed notifications to Convex...`);
    await Promise.all(
      failedNotifications.map((notification) =>
        convex.mutation("notification:createNotification", notification)
          .catch((convexError) => console.error(`Failed to log failed notification: ${convexError.message}`))
      )
    );
  } else {
    console.log("No failed notifications to log.");
  }

  console.log(`sendNotifications completed. Email errors: ${emailErrors.length > 0 ? JSON.stringify(emailErrors) : "None"}`);
  return emailErrors;
}

export { fetchAllValidData, dataToCsvString, sendNotifications, dataToCsvStringForKMeans };