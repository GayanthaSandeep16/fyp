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
    timestamp: v.number(),
    modelFilePath: v.string(),
    scalerFilePath: v.string(),
  },
  handler: async (ctx, args) => {
    // Insert the new model record into the "models" table
    return await ctx.db.insert("models", {
      ...args,
      // created_at: Date.now(), // Uncomment if you also add created_at to schema
    });
  },
});

export const getModelDetails = query({
  handler: async (ctx) => {
    const models = await ctx.db.query("models").order("desc").collect();
    return models;
  },
});


  