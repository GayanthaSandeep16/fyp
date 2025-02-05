import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    national_id: v.string(),
    email: v.string(),
    password: v.string(),
    organization: v.string(),
    sector: v.union(v.literal("Healthcare"), v.literal("Finance")),
    created_at: v.optional(v.number()), // Store as timestamp
  }).index("by_email", ["email"])
    .index("by_national_id", ["national_id"])
});
