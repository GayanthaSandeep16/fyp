import { ConvexHttpClient } from "convex/browser";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new ConvexHttpClient(process.env["CONVEX"]);
import { api } from "../../convex/_generated/api.js";

async function createUser(req, res) {
    const { name, national_id, email, organization, sector,role, clerk_id } = req.body;


    if (!name || !national_id || !email  || !organization || !sector || !role || !clerk_id) {
        return res.status(400).json({ error: "All fields are required." });
    }

    try {
        const userId = await client.mutation(api.users.createUser, {
            name,
            national_id,
            email,
            organization,
            sector,
            role,
            clerk_id,
        });

        res.status(200).json({ userId, message: "User created successfully!" });
    } catch (error) {
        res.status(500).json({ error: error.message || "An error occurred while creating the user." });
    }
}


// Export the function
export default { createUser };
