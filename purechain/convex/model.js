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
    accuracy: v.string(),
    f1Score: v.string(),
    precision: v.string(),
    recall: v.string(),
    status: v.string(),
    modelFilePath: v.string(),
    scalerFilePath: v.string(),
    created_at: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("models", {
      ...args, // Now includes created_at from the args
    });
  },
});

export const getModelDetails = query({
  handler: async (ctx) => {
    const models = await ctx.db.query("models").order("desc").collect();
    return models;
  },
});


  