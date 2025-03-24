import {defineSchema, defineTable} from "convex/server";
import {v} from "convex/values";

export default defineSchema({
    users: defineTable({
        clerkUserId: v.string(),
        name: v.string(),
        email: v.string(),
        organization: v.string(),
        walletAddress: v.string(),
        sector: v.union(v.literal("Healthcare"), v.literal("Finance")),
        created_at: v.optional(v.number()), // Store as timestamp
        role: v.union(v.literal("Admin"), v.literal("User"))
    }).index("by_email", ["email"])
        .index("by_clerkUserId", ["clerkUserId"]),

    submissions: defineTable({
        userId: v.id("users"),
        dataHash: v.string(),
        validationStatus: v.union(v.literal("VALID"), v.literal("INVALID")),
        validationIssues: v.optional(v.array(v.string())),
        datasetName: v.string(),
        sector: v.union(v.literal("Healthcare"), v.literal("Finance")),
        walletAddress: v.string(),
        transactionHash: v.string(),
        submittedAt: v.number(), // Store as timestamp
    }).index("by_userId", ["userId"])
        .index("by_sector", ["sector"])
        .index("by_status", ["validationStatus"]),

    notifications: defineTable({
        userId: v.id("users"),
        email: v.string(),
        subject: v.string(),
        status: v.string(), // "success" or "failed"
        errorMessage: v.optional(v.string()),
        timestamp: v.number(), // Unix timestamp (milliseconds)
        }).index("by_timestamp", ["timestamp"]),

        models: defineTable({
            timestamp: v.number(),
            dataCount: v.number(),
            modelType: v.string(),
            accuracy: v.string(),
            f1Score: v.string(),
            precision: v.string(),
            recall: v.string(),
            status: v.string(),
        
            // Add these two fields so they won't be considered "extra"
            modelFilePath: v.string(),
            scalerFilePath: v.string(),
          }),

});