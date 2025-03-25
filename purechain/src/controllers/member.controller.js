import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";
import { Clerk } from "@clerk/clerk-sdk-node";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const clerkClient = new Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
// Initialize Convex client with the CONVEX URL from environment variables
const client = new ConvexHttpClient(process.env["CONVEX"]);
import { api } from "../../convex/_generated/api.js";

/**
 * createUser
 * Creates a new user (role: member) in the system by calling the Convex mutation.
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body containing user details.
 * @param {string} req.body.name - User's full name.
 * @param {string} req.body.email - User's email address.
 * @param {string} req.body.organization - User's organization.
 * @param {string} req.body.sector - User's sector.
 * @param {string} req.body.role - User's role ("Admin" or "User").
 * @param {string} req.body.clerkUserId - Clerk user ID (unique identifier).
 * @param {string} req.body.walletAddress - User's blockchain wallet address.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Responds with the created user ID or an error message.
 */
async function createUser(req, res) {
  const { name, email, organization, sector, role, clerkUserId, walletAddress } = req.body;

  // Validate required fields
  if (!name || !email || !organization || !sector || !role || !clerkUserId || !walletAddress) {
    return res.status(400).json({ error: "All fields are required." });
  }
  try {
    // Update Clerk user's unsafeMetadata
    await clerkClient.users.updateUser(clerkUserId, {
      unsafeMetadata: {
          walletAddress,
      },
  });
  // Additional validation for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email format." });
  }

  // Validate role
  if (!["Admin", "User"].includes(role)) {
    return res.status(400).json({ error: "Role must be either 'Admin' or 'User'." });
  }

 
    // Call the Convex mutation to create the user
    const userId = await client.mutation(api.users.createUser, {
      name,
      email,
      organization,
      sector,
      role,
      clerkUserId,
      walletAddress,
    });

    // Respond with success message and user ID
    res.status(200).json({ message: "User created successfully!" });
  } catch (error) {
    // Handle errors (e.g., duplicate Clerk ID, Convex errors)
    res.status(500).json({ error: error.message });
  }
}

// Export the controller functions
export default { createUser };