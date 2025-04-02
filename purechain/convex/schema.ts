import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
        created_at: v.float64(),
        modelId: v.string(),
    }).index("by_userId", ["userId"])
        .index("by_sector", ["sector"])
        .index("by_status", ["validationStatus"])
        .index("by_modelId", ["modelId"]),

    notifications: defineTable({
        userId: v.id("users"),
        email: v.string(),
        subject: v.string(),
        status: v.string(), // "success" or "failed"
        errorMessage: v.optional(v.string()),
        timestamp: v.number(), // Unix timestamp (milliseconds)
    }).index("by_timestamp", ["timestamp"]),

    models: defineTable({
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
    }),

    transactions: defineTable({
        txHash: v.string(),
        type: v.union(v.literal("SUBMISSION"), v.literal("PENALIZE"), v.literal("REWARD"), v.literal("BLACKLIST"), v.literal("TRAINING")),
        userId: v.id("users"),
        walletAddress: v.string(),
        uniqueId: v.string(),
        ipfsHash: v.optional(v.string()),
        submissionId: v.optional(v.id("submissions")),
        status: v.union(v.literal("SUCCESS"), v.literal("FAILED")),
        blockNumber: v.string(),
        eventName: v.string(),
        eventArgs: v.any(), // Flexible object for event-specific data
        created_at: v.number(),
    }).index("by_userId", ["userId"])
        .index("by_type", ["type"])
        .index("by_txHash", ["txHash"]),

    trainingRuns: defineTable({
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
        status: v.union(v.literal("SUCCESS"), v.literal("FAILED"), v.literal("LOW_PERFORMANCE")),
        errorMessage: v.optional(v.string()),
        modelFilePath: v.optional(v.string()),
        scalerFilePath: v.optional(v.string()),
        trainingTxHash: v.optional(v.string()),
        created_at: v.number(),
    }).index("by_modelId", ["modelId"])
        .index("by_triggeredByUserId", ["triggeredByUserId"])
        .index("by_status", ["status"])
});