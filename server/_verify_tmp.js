/**
 * Download whatever the catalog now points at for the blends in the report.
 */
require('dotenv').config({ path: '/Users/bglover/projects/cavaro/server/.env' });
const fs = require('fs');
const path = require('path');
const pool = require('/Users/bglover/projects/cavaro/server/config/postgres');

const TARGETS = [
  ['Plasencia', 'Alma Fuerte'],
  ['Rocky Patel', 'Decade'],
  ['Rocky Patel', 'The 1865 Project'],
  ['Davidoff', 'Aniversario'],
  ['Davidoff', 'Millennium'],
  ['Rocky Patel', 'A.L.R. 2nd Edition'],
  ['Rocky Patel', 'Bold by Nish Patel'],
  ['Rocky Patel', 'Conviction'],
  ['Rocky Patel', 'Disciple'],
  ['Rocky Patel', 'Vintage 2006 San Andres'],
  ['Rocky Patel', 'Vintage 2003 Cameroon'],
  ['Rocky Patel', 'Java Red'],
  ['Rocky Patel', 'Java Maduro'],
  ['Rocky Patel', 'Grand Reserve'],
];

const OUT = '/tmp/cigar-fix/live';

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  let index = 0;
  for (const [brand, name] of TARGETS) {
    const { rows } = await pool.query(
      `SELECT DISTINCT image FROM cigar_catalog
       WHERE brand = $1 AND name = $2 AND COALESCE(image, '') <> ''
       ORDER BY image`,
      [brand, name]
    );
    if (!rows.length) {
      console.log(`${brand} / ${name}: NO IMAGE`);
      continue;
    }
    for (const row of rows) {
      const hidden = row.image.includes('/catalog/') && row.image.toLowerCase().endsWith('.png');
      const res = await fetch(row.image);
      const file = path.join(
        OUT,
        `${String(index).padStart(2, '0')}_${slug(`${brand} ${name}`)}.jpg`
      );
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(
        `${String(index).padStart(2, '0')} ${brand} / ${name} ${res.status}` +
          `${hidden ? '  *** CLIENT WOULD HIDE (ai png) ***' : ''}`
      );
      index += 1;
    }
  }
  await pool.end();
})();
