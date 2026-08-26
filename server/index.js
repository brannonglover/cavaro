const path = require('path');
const express = require('express');
const colors = require('colors');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const catalogRoutes = require('./routes/catalog');
const reviewsRoutes = require('./routes/reviews');
const uploadRoutes = require('./routes/upload');
const feedbackRoutes = require('./routes/feedback');
const tasteRoutes = require('./routes/taste');
const userRoutes = require('./routes/user');
const userCigarsRoutes = require('./routes/userCigars');
const userHumidorsRoutes = require('./routes/userHumidors');
const userCellaredRoutes = require('./routes/userCellared');
const userJournalRoutes = require('./routes/userJournal');
const subscriptionRoutes = require('./routes/subscription');
const port = process.env.PORT || 5001;

const app = express();

app.use(express.json());
app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Shared cigar catalog (PostgreSQL)
app.use('/api/catalog', catalogRoutes);
// Shared community reviews
app.use('/api/reviews', reviewsRoutes);
// Image upload (Supabase Storage)
app.use('/api/upload', uploadRoutes);
// User feedback (emails to brannonglover@gmail.com)
app.use('/api/feedback', feedbackRoutes);
// AI cigar taste analysis (OpenAI proxy)
app.use('/api/taste', tasteRoutes);
// User tier (Supabase Auth + user_profiles)
app.use('/api/user', userRoutes);
// User data sync
app.use('/api/user/cigars', userCigarsRoutes);
app.use('/api/user/humidors', userHumidorsRoutes);
app.use('/api/user/cellared', userCellaredRoutes);
app.use('/api/user/journal', userJournalRoutes);
// Apple IAP (verify / restore)
app.use('/api/subscription', subscriptionRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`.green);
});
