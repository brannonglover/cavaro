const express = require('express');
const colors = require('colors');
const cors = require('cors');
require('dotenv').config();
const catalogRoutes = require('./routes/catalog');
const uploadRoutes = require('./routes/upload');
const feedbackRoutes = require('./routes/feedback');
const port = process.env.PORT || 5001;

const app = express();

app.use(express.json());
app.use(cors());

// Shared cigar catalog (PostgreSQL)
app.use('/api/catalog', catalogRoutes);
// Image upload (Supabase Storage)
app.use('/api/upload', uploadRoutes);
// User feedback (emails to brannonglover@gmail.com)
app.use('/api/feedback', feedbackRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`.green);
});