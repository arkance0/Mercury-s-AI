// Mercury's AI-Generator | api/db.js
// Conexión con PostgreSQL

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está configurada.');
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Railway/PostgreSQL puede usar certificados internos.
  ssl: {
    rejectUnauthorized: false
  },

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (error) => {
  console.error('❌ PostgreSQL pool error:', error.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function testConnection() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0];
}

module.exports = {
  pool,
  query,
  testConnection
};