/**
 * Phase 1.4 — Micro Competency Framework seed.
 *
 * Idempotent. Loads the baseline parent-child framework (Communication /
 * Leadership / Problem-Solving) by LINKING existing competencies and recording
 * named-only micros where no competency row exists. Never mutates onto_competencies.
 *
 * Run FROM the backend dir:  npx tsx scripts/seed-micro-competency.ts
 */

import { Pool } from 'pg';
import { runMicroCompetencySeed } from '../services/micro-competency.js';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[seed-micro-competency] DATABASE_URL is not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString, max: 3 });
  try {
    const result = await runMicroCompetencySeed(pool);
    console.log('[seed-micro-competency] result:', JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  } catch (err: any) {
    console.error('[seed-micro-competency] failed:', err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void main();
