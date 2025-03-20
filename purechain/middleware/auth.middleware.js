import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

// Initialize Convex client to fetch user details
const client = new ConvexHttpClient(process.env["CONVEX"]);

/**
 * requireAuth
 * Middleware to ensure the user is authenticated.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next function.
 * @returns {void}
 */
export const requireAuth = async (req, res, next) => {
  // Check if req.auth exists and has a userId (set by ClerkExpressWithAuth)
  if (!req.auth || !req.auth.userId) {
    return res.status(401).json({ error: "Unauthorized. Please log in." });
  }

  // Fetch the user's details from Convex using their Clerk user ID
  try {
    const user = await client.query(api.users.getUserByClerkId, {
      clerkUserId: req.auth.userId,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found in the system." });
    }

    // Attach the user object to req.user for use in subsequent middleware/routes
    req.user = user;
    next();
  } catch (error) {
    console.error("Error fetching user from Convex:", error);
    return res.status(500).json({ error: "Failed to authenticate user." });
  }
};

/**
 * isAdmin
 * Middleware to ensure the authenticated user has the "Admin" role.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next function.
 * @returns {void}
 */
export const isAdmin = (req, res, next) => {
  // Check if req.user exists and has the role "Admin"
  if (req.user && req.user.role === "Admin") {
    return next();
  }
  return res.status(403).json({ error: "Access denied. Admin only." });
};