import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const logTrainingRun = mutation({
    args: {
      modelId: v.string(),
      triggeredByUserId: v.id("users"),
      triggeredByWalletAddress: v.string(),
      duration: v.number(),
      status: v.union(v.literal("SUCCESS"), v.literal("FAILED"), v.literal("LOW_PERFORMANCE")),
      trainingTxHash: v.optional(v.string()),
      created_at: v.number(),
    },
    handler: async (ctx, args) => {
      return await ctx.db.insert("trainingRuns", args);
    },
  });