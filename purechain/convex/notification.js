import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new notification( email, subject, status, errorMessage, timestamp)
export const createNotification = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    subject: v.string(),
    status: v.string(),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      email: args.email,
      subject: args.subject,
      status: args.status,
      errorMessage: args.errorMessage,
      timestamp: args.timestamp,
    });
    return notificationId;
  },
});

// Get all notifications
export const getAllNotifications = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("notifications")
      .order("desc", "timestamp") // Newest first
      .collect();
  },
});