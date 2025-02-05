import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env["CONVEX_URL"]);

// Query tasks
// client.query(api.tasks.get).then(console.log);

// Create a user
// client.mutation(api.users.createUser, {
//   name: "John Doe",
//   national_id: "123456789",
//   email: "john@example.com",
//   password: "hashed_password_here",
//   organization: "Example Org",
//   sector: "Healthcare",
// }).then((userId) => console.log("User created with ID:", userId));

// client.mutation(api.submissions.submitData, {
//         userId: "j970r2pakcxz83qd3c3bv5jh3d79rkzz",
//         dataHash: "unique-file-hash-or-id",
//         validationStatus: "VALID",
//         datasetName: "Patient Records Dataset",
//         sector: "Healthcare",
// }).then(console.log);

client.query(api.submissions.getSubmissions).then(console.log);