require('dotenv').config();
const express = require('express');
const fileUpload = require("express-fileupload");


const app = express();
const dataRoutes = require('./routes/endpoints');
const port = process.env.PORT || 3000;


app.use(express.json());
app.use(fileUpload());



// Middleware to handle routes
app.use('/api',dataRoutes );


// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
