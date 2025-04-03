import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const logTransaction = mutation({
  args: {
    txHash: v.string(),
    type: v.union(v.literal("SUBMISSION"), v.literal("PENALIZE"), v.literal("REWARD"), v.literal("BLACKLIST"), v.literal("TRAINING")),
    userId: v.id("users"),
    walletAddress: v.string(),
    uniqueId: v.string(),
    ipfsHash: v.optional(v.string()),
    submissionId: v.optional(v.string()),
    status: v.union(v.literal("SUCCESS"), v.literal("FAILED")),
    blockNumber: v.string(),
    eventName: v.string(),
    eventArgs: v.any(),
    created_at: v.number(), 
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transactions", args);
  },
});