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
  args: {
    quality: v.string(),
    modelId: v.string(),
    sector: v.string(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("submissions")
      .filter((q) =>
        q.and(
          q.eq(q.field("validationStatus"), args.quality),
          q.eq(q.field("modelId"), args.modelId),
          q.eq(q.field("sector"), args.sector)
        )
      )
      .collect();
    return [...new Set(results.map((submission) => submission.dataHash))];
  },
});
// Submit new data
export const submitData = mutation({
  args: {
    userId: v.id("users"),
    dataHash: v.optional(v.string()),
    validationStatus: v.string(),
    validationIssues: v.optional(v.array(v.string())),
    datasetName: v.string(),
    sector: v.string(),
    transactionHash: v.string(),
    walletAddress: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("submissions", {
      ...args,
      created_at: Date.now(),
    });
  }});
