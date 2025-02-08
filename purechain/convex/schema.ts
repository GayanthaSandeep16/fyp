import {defineSchema, defineTable} from "convex/server";
import {v} from "convex/values";

export default defineSchema({
    users: defineTable({
        clerk_id: v.string(),
        name: v.string(),
        national_id: v.string(),
        email: v.string(),
        organization: v.string(),
        sector: v.union(v.literal("Healthcare"), v.literal("Finance")),
        created_at: v.optional(v.number()), // Store as timestamp
        role: v.union(v.literal("Admin"), v.literal("User"))
    }).index("by_email", ["email"])
        .index("by_clerk_id", ["clerk_id"])
        .index("by_national_id", ["national_id"]),

    submissions: defineTable({
        userId: v.id("users"),
        dataHash: v.string(),
        validationStatus: v.union(v.literal("VALID"), v.literal("INVALID")),
        validationIssues: v.optional(v.array(v.string())),
        datasetName: v.string(),
        sector: v.union(v.literal("Healthcare"), v.literal("Finance")),
        submittedAt: v.number(), // Store as timestamp
    }).index("by_userId", ["userId"])
        .index("by_sector", ["sector"])
        .index("by_status", ["validationStatus"]),
});