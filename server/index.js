const path = require('path');
const express = require('express');
const colors = require('colors');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const catalogRoutes = require('./routes/catalog');
const reviewsRoutes = require('./routes/reviews');
const uploadRoutes = require('./routes/upload');
const feedbackRoutes = require('./routes/feedback');
const pairingRoutes = require('./routes/pairing');
const userRoutes = require('./routes/user');
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
// AI drink pairing (OpenAI proxy)
app.use('/api/pairing', pairingRoutes);
// User tier (Supabase Auth + user_profiles)
app.use('/api/user', userRoutes);
// Apple IAP (verify / restore)
app.use('/api/subscription', subscriptionRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`.green);
});
