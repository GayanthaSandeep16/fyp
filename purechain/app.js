import dotenv from 'dotenv';
import express from 'express';
import fileUpload from 'express-fileupload';
import routes from './src/routes.js';
import cors from 'cors';
import { cleanupTempDir } from './src/utils/cleanup.js';
import { clerkMiddleware } from '@clerk/express';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;


// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://fyp-frontend-bay.vercel.app', // Allow frontend to access
    credentials: true,
}));
app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true
}));
// console.log(process.env.CLERK_SECRET_KEY);
// Clerk middleware for authentication
app.use(clerkMiddleware({
    apiKey: process.env.CLERK_SECRET_KEY
}));

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

