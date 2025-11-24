// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL is not set');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: isProd
    ? { rejectUnauthorized: false } // needed for many hosted Postgres providers (incl. Railway)
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
