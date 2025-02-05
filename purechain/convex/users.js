import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get all users
export const getUsers = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

  // Get all admins
  export const getAdmins = query({
    handler: async (ctx) => {
      return await ctx.db.query("users").filter(q => q.eq("role", "admin")).collect();
    },
  });

// Create a new user
export const createUser = mutation({
  args: {
    name: v.string(),
    national_id: v.string(),
    email: v.string(),
    password: v.string(),
    organization: v.string(),
    sector: v.union(v.literal("Healthcare"), v.literal("Finance")),
    role: v.union(v.literal("Admin"), v.literal("User")),
  },
  handler: async (ctx, args) => {
    const userExists = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (userExists) {
      throw new Error("User with this email already exists!");
    }

    return await ctx.db.insert("users", {
      ...args,
      created_at: Date.now(),
    });
  },
});
