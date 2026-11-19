/**
 * Seeds sample community reviews for demo purposes.
 * Run after init-catalog and init-reviews: npm run seed-reviews
 * Skips in production to avoid demo data in live environments.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

if (process.env.NODE_ENV === 'production') {
  console.log('Skipping seed-reviews in production');
  process.exit(0);
}

const pool = require('../config/postgres');

const SAMPLE_REVIEWS = [
  { brand: 'Alec Bradley', name: 'Prensado', length: '5x50', rating: 5, flavor_profile: 'Earthy, woody, hints of cocoa and coffee', favorite_notes: 'Smooth and complex. Great construction.' },
  { brand: 'Alec Bradley', name: 'Prensado', length: '6x54', rating: 5, flavor_profile: 'Earthy, leather, pepper in final third', favorite_notes: 'Cigar of the year for a reason.' },
  { brand: 'Alec Bradley', name: 'Chunk', length: '4x60', rating: 4, flavor_profile: 'Spicy, full-bodied, Mexican wrapper sweetness', favorite_notes: 'Bold and satisfying.' },
  { brand: 'Alec Bradley', name: 'Safe Keepings', length: '5 3/8x46', rating: 4, flavor_profile: 'Savory, piquant, medium-full Nicaraguan puro', favorite_notes: 'Nicaraguan gem.' },
  { brand: 'Alec Bradley', name: 'Chunk', length: '4x66', rating: 4, flavor_profile: 'Spice, pepper, woody', favorite_notes: 'Great for a shorter smoke.' },
  { brand: 'Alec Bradley', name: 'Prensado', length: '5 5/8x46', rating: 5, flavor_profile: 'Creamy, earthy, nutty, Honduran corojo', favorite_notes: 'Classic. Always reliable.' },
];

async function seedReviews() {
  const client = await pool.connect();
  try {
    for (const r of SAMPLE_REVIEWS) {
      const cat = await client.query(
        'SELECT id FROM cigar_catalog WHERE brand = $1 AND name = $2 AND length = $3',
        [r.brand, r.name, r.length]
      );
      const catalogId = cat.rows[0]?.id;
      if (!catalogId) {
        console.warn(`Skipping ${r.brand} ${r.name} ${r.length} - not in catalog`);
        continue;
      }
      await client.query(
        `INSERT INTO cigar_reviews (catalog_id, rating, flavor_profile, favorite_notes)
         VALUES ($1, $2, $3, $4)`,
        [catalogId, r.rating, r.flavor_profile, r.favorite_notes]
      );
    }
    console.log(`Seeded ${SAMPLE_REVIEWS.length} sample reviews`);
  } finally {
    client.release();
    await pool.end();
  }
}

seedReviews().catch((err) => {
  console.error(err);
  process.exit(1);
});
