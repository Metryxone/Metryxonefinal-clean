import { runMigrations } from './migrate.js';
import { runCompetencyMigrations } from './migrate-competency.js';

/**
 * Runs all pending DB migrations as part of server startup.
 * Called by server/src/index.ts at boot time and by the smoke test
 * (src/__tests__/db-tables-smoke.test.ts) to validate the startup path.
 */
export async function runStartupMigrations(): Promise<void> {
  await runMigrations();
  await runCompetencyMigrations();
}
