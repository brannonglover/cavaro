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
// exposedHeaders is required for browser callers to read X-Collection-Revision:
// by default CORS only exposes the six simple response headers, so a fetch()
// from a web origin would see the header stripped and fall back to an
// unversioned write. React Native is not subject to CORS, but the web auth
// callback and any future browser client are.
app.use(cors({ exposedHeaders: ['X-Collection-Revision'] }));

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
