import {mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getLatestModel = query({
    handler: async (ctx) => {
      return await ctx.db.query("models").order("desc").first(); 
    },
  });
  
  export const addNewModel = mutation({
    args: {
      version: v.number(),
      accuracy: v.number(), 
      trainedBy: v.id("users"), 
      trainedAt: v.number(),
    },
    handler: async (ctx, args) => {
      return await ctx.db.insert("models", {
        ...args,
        trainedAt: Date.now(),
      });
    },
  });


  