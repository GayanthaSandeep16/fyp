import {generateUniqueId, saveFileToTemp, validateData} from "../services/file.service.js";
import {uploadFileToPinata} from "../../pinata/fileUpload.js";
import { penalizeUser, submitDataToContract } from "../services/blockchain.service.js";
import {successResponse, errorResponse} from "../utils/responseHandler.js";
import {internalMutation, query} from "../../convex/_generated/server.js";
import {useQuery} from "convex/react";
import {api} from "../../convex/_generated/api.js";


const submitData = async (req, res) => {
    try {
        const file = req.files?.files;
        const clerk_id = req.body.clerk_id;

        if (clerk_id) {
            const user = await query(api.users.getUserByClerkId, {
                clerkUserId: clerk_id,
            });

            if (!user) {
                return res.status(404).json({message: 'User not found'});
            }
        }

        if (!file) {
            return res.status(400).json({message: 'No file uploaded'});
        }

        // Save file temporarily
        const filePath = await saveFileToTemp(file);

        // Validate data
        const validation = await validateData(filePath);
        console.log(validation);

        if (validation.quality === "BAD") {
            await penalizeUser(user.name, user.organization, uniqueId);
            return res.status(400).json({
                message: 'Data validation failed',
                issues: validation.issues,
            });
        }

        const submissionId = await internalMutation({
            args: {
                userId: user.id,
                dataHash: generateUniqueId(),
                validationStatus: 'VALID',
                datasetName: file.name,
                sector: user.publicMetadata.sector || 'General',
                submittedAt: Date.now(),
            },
            handler: async (ctx, args) => {
                return await ctx.db.insert('submissions', args);
            },
        });

        let ipfsHash;
        try {
            ipfsHash = await uploadFileToPinata(filePath, {
                name: `${user.name}_${Date.now()}`,
                keyvalues: {
                    userId: user.id,
                    organization: user.organization,
                    uniqueId: uniqueId,
                    validationStatus: "VALID",
                },
            });
        } catch (error) {
            console.error("Error:", error);
            res.status(500).json({message: "Internal server error"});
        }

         const tx = await submitDataToContract(user.name, user.organization, uniqueId, ipfsHash);

        successResponse(res, {
            message: "Data submitted successfully",
            ipfsHash,
            transactionHash: tx.transactionHash,
        });
    } catch (error) {
        console.error("Data submission error:", error);
        errorResponse(res, error.message, 500);
    }
};

// Export using ES Module syntax
export {submitData};
