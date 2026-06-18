#!/bin/bash
set -e

echo "[post-merge] Installing frontend dependencies..."
cd frontend && npm install --legacy-peer-deps 2>&1 | tail -3
cd ..

echo "[post-merge] Installing backend dependencies..."
cd backend && npm install 2>&1 | tail -3
cd ..

echo "[post-merge] Running pending migrations..."
cd backend && node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  await pool.query(\`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  \`);

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE filename=\$1', [file]);
    if (rows.length > 0) { console.log('[skip]', file); continue; }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (filename) VALUES (\$1)', [file]);
      console.log('[applied]', file);
    } catch (e) {
      console.warn('[warn]', file, e.message);
    }
  }
  await pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
" 2>&1
cd ..

echo "[post-merge] Done."
