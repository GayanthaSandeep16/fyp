import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Query: getUsers
 * Fetches all users from the "users" table.
 * @returns {Promise<Array>} List of all users.
 */
export const getUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

/**
 * Query: getUserByClerkId
 * Fetches a user by their Clerk user ID.
 * @param {Object} args - Query arguments.
 * @param {string} args.clerkUserId - The Clerk user ID to search for.
 * @returns {Promise<Object|null>} The user object if found, otherwise null.
 */
export const getUserByClerkId = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
  },
});

/**
 * Query: getInvalidSubmissionsWithUsers
 * Fetches all submissions with validationStatus "INVALID" and includes user details.
 * @returns {Promise<Array>} List of invalid submissions with associated user details.
 */
export const InValidSubmissions = query({
  args: {
    modelId: v.optional(v.string()),
    sector: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("validationStatus"), "INVALID"));

    if (args.modelId) {
      query = query.filter((q) => q.eq(q.field("modelId"), args.modelId));
    }

    if (args.sector) {
      query = query.filter((q) => q.eq(q.field("sector"), args.sector));
    }

    const invalidSubmissions = await query.collect();

    // Enrich each submission with user details
    const submissionsWithUsers = await Promise.all(
      invalidSubmissions.map(async (submission) => {
        const user = await ctx.db.get(submission.userId);
        return {
          ...submission,
          user: user ? { name: user.name, email: user.email } : null,
        };
      })
    );

    return submissionsWithUsers;
  },
});

/**
 * Query: validSubmissions
 * Fetches all submissions with validationStatus "VALID" and includes user details.
 * @returns {Promise<Array>} List of valid submissions with associated user details.
 */
export const validSubmissions = query({
  args: {
    modelId: v.optional(v.string()),
    sector: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("validationStatus"), "VALID"));

    if (args.modelId) {
      query = query.filter((q) => q.eq(q.field("modelId"), args.modelId));
    }

    if (args.sector) {
      query = query.filter((q) => q.eq(q.field("sector"), args.sector));
    }

    const validSubmissions = await query.collect();

    // Enrich each submission with user details
    const submissionsWithUsers = await Promise.all(
      validSubmissions.map(async (submission) => {
        const user = await ctx.db.get(submission.userId);
        return {
          ...submission,
          user: user ? { name: user.name, email: user.email } : null,
        };
      })
    );

    return submissionsWithUsers;
  },
});

/**
 * Query: getAdmins
 * Fetches all users with the role "admin".
 * @returns {Promise<Array>} List of admin users.
 * Note: Fix filter syntax for consistency.
 */
export const getAdmins = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();
  },
});

/**
 * Mutation: createUser
 * Creates a new user in the "users" table.
 * @param {Object} args - Mutation arguments.
 * @param {string} args.clerkUserId - Clerk user ID (unique identifier).
 * @param {string} args.name - User's full name.
 * @param {string} args.walletAddress - User's blockchain wallet address.
 * @param {string} args.email - User's email address.
 * @param {string} args.organization - User's organization.
 * @param {string} args.sector - User's sector.
 * @param {string} args.role - User's role ("Admin" or "User").
 * @returns {Promise<string>} The ID of the newly created user.
 * @throws {Error} If a user with the given Clerk ID already exists.
 */
export const createUser = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    walletAddress: v.string(),
    email: v.string(),
    organization: v.string(),
    sector: v.string(),
    role: v.union(v.literal("Admin"), v.literal("User")),
  },
  handler: async (ctx, args) => {
    // Check if a user with the given Clerk ID already exists
    const userExists = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (userExists) {
      throw new Error("User with this Clerk ID already exists!");
    }

    // Insert the new user into the database
    return await ctx.db.insert("users", {
      ...args,
      created_at: Date.now(),
    });
  },
});