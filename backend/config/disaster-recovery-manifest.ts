/**
 * CAPADEX 3.0 — Program 2 · Phase 2.5 Operational Readiness.
 *
 * Canonical, machine-readable DISASTER-RECOVERY MANIFEST (pure data — NO engine, NO DDL).
 * Part of closing GAP-OPS-7: an in-repo DR substrate (declared data stores, backup cadence,
 * RTO/RPO targets, restore runbook steps, readiness checks). Paired with:
 *   - `scripts/ops-dr-verify.ts` — restore-READINESS verification harness.
 *   - `docs/DISASTER_RECOVERY.md` — human runbook.
 *
 * Honesty: this manifest DECLARES targets + procedures + machine-checkable readiness. It does
 * NOT and CANNOT execute a real infra restore drill from here (that is an infra/adoption
 * activity, tracked SEPARATELY). Targets are stated, never claimed as validated/achieved.
 */

export interface DrDataStore {
  key: string;
  label: string;
  engine: string;
  env_var: string; // connection-string env var (presence-checkable; value never logged)
  managed_backup: string; // who owns backups + cadence
  rto_target: string; // recovery TIME objective (declared)
  rpo_target: string; // recovery POINT objective (declared)
  restore_steps: string[];
}

export interface DrCheck {
  key: string;
  label: string;
  kind: 'connectivity' | 'config_presence' | 'manifest';
  detail: string;
}

export const DISASTER_RECOVERY_MANIFEST = {
  version: '2.5.0',
  owner: 'platform-operations',
  note: 'Managed-database backups are infra-owned (provider). This manifest declares targets, procedures, and machine-checkable readiness. Live restore-drill EXECUTION is a separate operational/adoption activity — never claimed as validated here.',
  data_stores: [
    {
      key: 'postgres',
      label: 'Primary PostgreSQL (application data)',
      engine: 'postgresql',
      env_var: 'DATABASE_URL',
      managed_backup: 'Provider automated backups (e.g. Cloud SQL automated + PITR). Daily full + continuous WAL where enabled.',
      rto_target: '≤ 1 hour',
      rpo_target: '≤ 5 minutes (with PITR) / ≤ 24 hours (daily snapshot only)',
      restore_steps: [
        'Identify the target recovery point (timestamp or snapshot id).',
        'Provision a restore instance from the provider snapshot / PITR.',
        'Repoint DATABASE_URL (Secret Manager) to the restored instance.',
        'Run boot-time env preflight + lazy ensure-schema; verify /api/health/ready.',
        'Run scripts/ops-dr-verify.ts to confirm connectivity + core tables present.',
      ],
    },
    {
      key: 'mongodb',
      label: 'MongoDB (bulk-upload / document store)',
      engine: 'mongodb',
      env_var: 'MONGODB_URI',
      managed_backup: 'Provider automated backups (e.g. Atlas continuous/cloud backup).',
      rto_target: '≤ 2 hours',
      rpo_target: '≤ 1 hour',
      restore_steps: [
        'Select the backup snapshot / point-in-time in the provider console.',
        'Restore to a new cluster or in-place per provider runbook.',
        'Repoint MONGODB_URI (Secret Manager) for the FastAPI upload service.',
        'Verify FastAPI /health and a sample read.',
      ],
    },
  ] as DrDataStore[],
  checks: [
    { key: 'pg_connectivity', label: 'PostgreSQL reachable', kind: 'connectivity', detail: 'SELECT 1 against DATABASE_URL.' },
    { key: 'pg_config', label: 'DATABASE_URL configured', kind: 'config_presence', detail: 'Env var present (value never logged).' },
    { key: 'mongo_config', label: 'MONGODB_URI configured', kind: 'config_presence', detail: 'Env var present (value never logged).' },
    { key: 'manifest_present', label: 'DR manifest + runbook present', kind: 'manifest', detail: 'This manifest + docs/DISASTER_RECOVERY.md exist in-repo.' },
  ] as DrCheck[],
} as const;

export type DisasterRecoveryManifest = typeof DISASTER_RECOVERY_MANIFEST;
