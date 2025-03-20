import { retrieveFileFromIPFS } from "../../pinata/fileretriver.js";
import { ConvexHttpClient } from "convex/browser";
import { sendEmail } from "../utils/email.js";
import pkg from 'papaparse';
import fs from 'fs/promises'; // For reading saved files if needed
const { parse } = pkg;

const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);

// Fetch all valid data from Convex
async function fetchAllValidData() {
  try {
    const validatedData = await convex.query("submissions:getValidatedData", { quality: "VALID" });
    const filteredData = validatedData.filter(hash => hash !== 'QmVzJEAuVPsULq1r7tqa3g5dJEwKpuEUYfzFWnDFhfgC25');
    const allData = [];

    for (const entry of filteredData) {
      const result = await retrieveFileFromIPFS(entry);
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
        // Standardize target to binary (0 or 1)
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
          target: targetValue
        };
      });

      // Filter out rows with missing critical fields
      const cleanedData = mappedData.filter(row => 
        row.gender !== undefined && row.age !== undefined && row.bmi !== undefined && 
        row.target !== undefined
      );

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

async function dataToCsvString(data) {
  if (data.length === 0) return "";

  const headers = ['gender', 'age', 'bmi', 'hba1c', 'glucose', 'target'];
  const rows = data.map(row =>
    headers.map(header => (row[header] ?? "").toString()).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

// Send notifications to users
async function sendNotifications(validUsers, invalidUsers, silhouetteScore) {
  let emailErrors = [];

  for (const submission of validUsers) {
    const emailText = `Congratulations, ${submission.user.name}! Your data (${submission.datasetName}) was used to build an HDBSCAN model. It identified risk groups with a silhouette score of ${silhouetteScore || "N/A"}. Thank you for contributing!`;
    const timestamp = Date.now();

    try {
      await sendEmail(submission.user.email, "Model Training Success", emailText);
      await convex.mutation("notification:createNotification", {
        userId: submission.userId,
        email: submission.user.email,
        subject: "Model Training Success",
        status: "success",
        timestamp,
      });
    } catch (error) {
      emailErrors.push(`Failed to email ${submission.user.email}: ${error.message}`);
      await convex.mutation("notification:createNotification", {
        userId: submission.userId,
        email: submission.user.email,
        subject: "Model Training Success",
        status: "failed",
        errorMessage: error.message,
        timestamp,
      });
    }
  }

  for (const submission of invalidUsers) {
    const issues = submission.validationIssues || "Unknown issues";
    const emailText = `Sorry, ${submission.user.name}. Your data (${submission.datasetName}) didn’t meet quality standards and wasn’t used. Issues: ${issues}. Please improve and resubmit!`;
    const timestamp = Date.now();

    try {
      await sendEmail(submission.user.email, "Data Quality Notice", emailText);
      await convex.mutation("notification:createNotification", {
        userId: submission.userId,
        email: submission.user.email,
        subject: "Data Quality Notice",
        status: "success",
        timestamp,
      });
    } catch (error) {
      emailErrors.push(`Failed to email ${submission.user.email}: ${error.message}`);
      await convex.mutation("notification:createNotification", {
        userId: submission.userId,
        email: submission.user.email,
        subject: "Data Quality Notice",
        status: "failed",
        errorMessage: error.message,
        timestamp,
      });
    }
  }

  return emailErrors;
}

export { fetchAllValidData, dataToCsvString, sendNotifications };