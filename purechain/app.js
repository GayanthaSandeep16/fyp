// app.js
import dotenv from 'dotenv';
import express from 'express';
import fileUpload from 'express-fileupload';
import routes from './src/routes.js';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());

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