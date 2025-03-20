import {mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveModelDetails = mutation({
  args: {
    dataCount: v.number(),
    modelType: v.string(),
    accuracy: v.string(),    
    f1Score: v.string(),     
    precision: v.string(),   
    recall: v.string(),      
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const modelId = await ctx.db.insert("models", {
      timestamp: Date.now(),
      dataCount: args.dataCount,
      modelType: args.modelType,
      accuracy: args.accuracy,
      f1Score: args.f1Score,
      precision: args.precision,
      recall: args.recall,
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


  