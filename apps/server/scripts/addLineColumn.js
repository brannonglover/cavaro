/**
 * Adds line column to cigar_catalog for sub-brand/series.
 * Run: node scripts/addLineColumn.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../config/postgres');

async function addLineColumn() {
  try {
    await pool.query('ALTER TABLE cigar_catalog ADD COLUMN IF NOT EXISTS line TEXT');
    console.log('Added line column to cigar_catalog');
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column line already exists');
    } else {
      console.error(err);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

addLineColumn();
