import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const logTrainingRun = mutation({
    args: {
      modelId: v.string(),
      triggeredByUserId: v.id("users"),
      triggeredByWalletAddress: v.string(),
      duration: v.number(),
      dataCount: v.number(),
      metrics: v.object({
        accuracy: v.optional(v.string()),
        f1Score: v.optional(v.string()),
        precision: v.optional(v.string()),
        recall: v.optional(v.string()),
      }),
      status: v.string(),
      errorMessage: v.optional(v.string()),
      modelFilePath: v.optional(v.string()),
      scalerFilePath: v.optional(v.string()),
      trainingTxHash: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
      return await ctx.db.insert("trainingRuns", args);
    },
  });