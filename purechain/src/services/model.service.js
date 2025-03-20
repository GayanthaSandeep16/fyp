import { ConvexHttpClient } from "convex/browser";
const convex = new ConvexHttpClient(process.env["CONVEX_URL_2"]);

export const getModelDetails = async () =>    {
    try {
    const data = convex.query("models:getModelDetails")
    return data
    } catch (error) {
        console.error("Error in getModelDetails:", error);
        throw new Error("Failed to fetch model details");
    }
}