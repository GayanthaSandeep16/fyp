require('dotenv').config();
const express = require('express');
const dataRoutes = require('./routes/data');

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;


// Middleware to handle routes
app.use('/api',dataRoutes );

// Start server
const PORT = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
