import {mutation, query } from "./_generated/server";
import { v } from "convex/values";


/**
 * saveModelDetails
 * Saves details of a trained model in Convex, including versioned file paths.
 */
export const saveModelDetails = mutation({
  args: {
    dataCount: v.number(),
    modelType: v.string(),
    metrics: v.optional(v.record(v.string(), v.any())),
    status: v.string(),
    modelFilePath: v.string(),
    scalerFilePath: v.string(),
    created_at: v.number(), 
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("models", {
      ...args, 
    });
  },
});

//getModelDetails
/**
 * Retrieves the details of a specific model from Convex.
 */
export const getAllModels = query({
  handler: async (ctx) => {
    return await ctx.db.query("models").collect();
  },
});


  