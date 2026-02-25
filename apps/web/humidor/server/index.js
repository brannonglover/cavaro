const express = require('express');
const colors = require('colors');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const port = process.env.PORT || 5000;

const app = express();

connectDB();

app.use(express.json())
app.use(cors());

app.listen(port, console.log(`Server running on port ${port}`));