import { retrieveFileFromIPFS } from "../../pinata/fileretriver.js";
import { ConvexHttpClient } from "convex/browser";
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);
import { sendEmail } from "../utils/email.js";


async function fetchAllValidData() {
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
async function dataToCsvString(data) {
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((header) => row[header] || "").join(","));
  return [headers.join(","), ...rows].join("\n");
}

async function sendNotifications(validUsers, invalidUsers, silhouetteScore) {
  let emailErrors = [];

  // Send notifications for valid users
  for (const submission of validUsers) {
    const emailText = `Congratulations, ${submission.user.name}! Your data (${submission.datasetName}) was used to build a K-Means model. It identified 3 risk groups with a silhouette score of ${silhouetteScore || "N/A"}. Thank you for contributing!`;
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

  // Send notifications for invalid users
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

module.exports = { sendNotifications,dataToCsvString,fetchAllValidData };