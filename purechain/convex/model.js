import {mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveModelDetails = mutation({
  args: {
    dataCount: v.number(),
    modelType: v.string(),
    silhouetteScore: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const modelId = await ctx.db.insert("models", {
      timestamp: Date.now(),
      dataCount: args.dataCount,
      modelType: args.modelType,
      silhouetteScore: args.silhouetteScore,
      status: args.status,
    });
    return modelId;
  },
});

export const getModelDetails = query({
  handler: async (ctx) => {
    const models = await ctx.db.query("models").order("desc").collect();
    return models;
  },
});


  