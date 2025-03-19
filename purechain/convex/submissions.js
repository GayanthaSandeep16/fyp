import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all submissions
export const getSubmissions = query({
  handler: async (ctx) => {
    return await ctx.db.query("submissions").collect();
  },
});

// Get submissions by a specific user
export const getUserSubmissions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("submissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// Get all validated data
export const getValidatedData = query({
  args: { quality: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("validationStatus"), args.quality))
      .collect();
    return [...new Set(results.map(submission => submission.dataHash))];
  },
});

// Submit new data
export const submitData = mutation({
  args: {
    userId: v.id("users"),
    dataHash: v.optional(v.string()), // This could be a unique hash or file reference
    validationStatus: v.union(v.literal("VALID"), v.literal("INVALID")),
    validationIssues: v.optional(v.array(v.string())), // List of detected issues
    datasetName: v.string(),
    walletAddress: v.string(),
    sector: v.union(v.literal("Healthcare"), v.literal("Finance")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("submissions", {
      ...args,
      submittedAt: Date.now(),
    });
  },
});
