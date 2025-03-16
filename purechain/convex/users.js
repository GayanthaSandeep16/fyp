import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all users
export const getUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getUserByClerkId = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
      .first();
  },
});

export const getInvalidSubmissionsWithUsers = query({
  args: {},
  handler: async (ctx) => {
    const invalidSubmissions = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("validationStatus"), "INVALID"))
      .collect();

    // Fetch user details for each submission
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


export const getvalidSubmissionsWithUsers = query({
  args: {},
  handler: async (ctx) => {
    const invalidSubmissions = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("validationStatus"), "VALID"))
      .collect();

    // Fetch user details for each submission
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

  // Get all admins
  export const getAdmins = query({
    handler: async (ctx) => {
      return await ctx.db.query("users").filter(q => q.eq("role", "admin")).collect();
    },
  });

// Create a new user
export const createUser = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    national_id: v.string(),
    email: v.string(),
    organization: v.string(),
    sector: v.string(),
    role: v.union(v.literal("Admin"), v.literal("User")),
  },
  handler: async (ctx, args) => {
    const userExists = await ctx.db
        .query("users")
        .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
        .first();

    if (userExists) {
      throw new Error("User with this Clerk ID already exists!");
    }

    return await ctx.db.insert("users", {
      ...args,
      created_at: Date.now(),
    });
  },
});
