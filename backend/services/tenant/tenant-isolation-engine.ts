/**
 * Phase 6.11 — Multi-Tenant Architecture · tenant_isolation AUDIT engine (READ-ONLY).
 *
 * Enumerates the tenant-scoped table namespaces (every public table carrying a `tenant_id` column),
 * measures tenant_id coverage (rows with NULL tenant_id are honest isolation gaps), best-effort
 * detects orphan tenant_id rows (tenant_id pointing at no live tenant), and reports a renormalized
 * isolation index computed ONLY over the measurable (non-empty, scannable) namespaces.
 *
 * GET-NEVER-WRITES: reads information_schema / pg_class / row counts only; runs NO DDL. Never
 * fabricates — unmeasurable tables (empty, or tenant_id of an incomparable type for the orphan probe)
 * are excluded from the index rather than scored as a pass or a fail.
 */
import pg from 'pg';

const N = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Hard cap on exact row scans so an on-demand admin audit can never run away on a huge prod substrate.
const MAX_DEEP_SCANS = 80;

export interface TenantTableCoverage {
  table: string;
  namespace: string;
  estimated_rows: number;
  scanned: boolean;
  total_rows: number | null;
  null_tenant_rows: number | null;
  orphan_tenant_rows: number | null;
  coverage_pct: number | null; // % of rows with a non-null tenant_id
  fully_isolated: boolean | null; // null_tenant_rows === 0 (orphans tracked separately)
  note?: string;
}

export interface TenantIsolationAudit {
  generated_at: string;
  degraded: boolean;
  summary: {
    tenant_scoped_tables: number;
    namespaces: number;
    deep_scanned: number;
    measurable_tables: number; // non-empty + scanned
    fully_isolated_tables: number;
    tables_with_null_tenant: number;
    tables_with_orphans: number;
    isolation_index: number | null; // renormalized over measurable tables only
    total_rows_scanned: number;
    total_null_tenant_rows: number;
  };
  namespaces: { namespace: string; tables: number; measurable: number; fully_isolated: number }[];
  gaps: TenantTableCoverage[]; // measurable tables with null tenant rows (or orphans)
  tables: TenantTableCoverage[];
  notes: string[];
}

export async function buildTenantIsolationAudit(pool: pg.Pool): Promise<TenantIsolationAudit> {
  const notes: string[] = [];
  let degraded = false;
  const generated_at = new Date().toISOString();

  // 1. Tenant-scoped table inventory.
  let scoped: { table: string }[] = [];
  try {
    const r = await pool.query(`
      SELECT table_name FROM information_schema.columns
       WHERE column_name = 'tenant_id' AND table_schema = 'public'
       ORDER BY table_name`);
    scoped = r.rows.map((row) => ({ table: String(row.table_name) }));
  } catch {
    degraded = true;
    notes.push('Could not enumerate tenant-scoped tables — isolation audit unavailable.');
    return {
      generated_at, degraded,
      summary: {
        tenant_scoped_tables: 0, namespaces: 0, deep_scanned: 0, measurable_tables: 0,
        fully_isolated_tables: 0, tables_with_null_tenant: 0, tables_with_orphans: 0,
        isolation_index: null, total_rows_scanned: 0, total_null_tenant_rows: 0,
      },
      namespaces: [], gaps: [], tables: [], notes,
    };
  }

  // 2. Row estimates so we deep-scan the heaviest tables first and bound the work.
  const estByTable = new Map<string, number>();
  try {
    const r = await pool.query(`
      SELECT c.relname AS t, GREATEST(c.reltuples, 0)::bigint AS est
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'`);
    for (const row of r.rows) estByTable.set(String(row.t), N(row.est));
  } catch { degraded = true; }

  const ns = (t: string): string => t.split('_')[0];

  const ordered = scoped
    .map((s) => ({ ...s, est: estByTable.get(s.table) ?? 0 }))
    .sort((a, b) => b.est - a.est);

  // 3. Deep-scan up to MAX_DEEP_SCANS tables for exact coverage; the rest are inventory-only.
  const tables: TenantTableCoverage[] = [];
  let scannedCount = 0;
  let totalRowsScanned = 0;
  let totalNullRows = 0;

  for (const s of ordered) {
    const namespace = ns(s.table);
    if (scannedCount >= MAX_DEEP_SCANS) {
      tables.push({
        table: s.table, namespace, estimated_rows: s.est, scanned: false,
        total_rows: null, null_tenant_rows: null, orphan_tenant_rows: null,
        coverage_pct: null, fully_isolated: null, note: 'not scanned (deep-scan cap reached)',
      });
      continue;
    }
    scannedCount += 1;
    const ident = '"' + s.table.replace(/"/g, '""') + '"';
    let total: number | null = null;
    let nulls: number | null = null;
    let orphans: number | null = null;
    let note: string | undefined;
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE tenant_id IS NULL)::int AS nulls FROM ${ident}`);
      total = N(r.rows[0]?.total);
      nulls = N(r.rows[0]?.nulls);
      totalRowsScanned += total;
      totalNullRows += nulls;
    } catch {
      degraded = true;
      note = 'unreadable';
    }
    // Best-effort orphan probe (fails when tenant_id is an incomparable type vs tenants.id INTEGER).
    if (total != null && total > 0) {
      try {
        const r = await pool.query(
          `SELECT COUNT(*)::int AS orphans FROM ${ident} t
            WHERE t.tenant_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM tenants te WHERE te.id = t.tenant_id)`);
        orphans = N(r.rows[0]?.orphans);
      } catch {
        orphans = null;
        note = note ? `${note}; orphan probe skipped (type)` : 'orphan probe skipped (type)';
      }
    } else if (total != null) {
      orphans = 0;
    }
    const coverage_pct = total != null && total > 0 && nulls != null
      ? Math.round(((total - nulls) / total) * 1000) / 10
      : null;
    const fully_isolated = nulls != null ? nulls === 0 : null;
    tables.push({
      table: s.table, namespace, estimated_rows: s.est, scanned: total != null,
      total_rows: total, null_tenant_rows: nulls, orphan_tenant_rows: orphans,
      coverage_pct, fully_isolated, note,
    });
  }

  // 4. Renormalized isolation index over MEASURABLE tables only (scanned + non-empty).
  const measurable = tables.filter((t) => t.scanned && (t.total_rows ?? 0) > 0);
  const fullyIsolated = measurable.filter((t) => t.fully_isolated === true);
  const withNull = measurable.filter((t) => (t.null_tenant_rows ?? 0) > 0);
  const withOrphans = measurable.filter((t) => (t.orphan_tenant_rows ?? 0) > 0);
  const isolation_index = measurable.length > 0
    ? Math.round((fullyIsolated.length / measurable.length) * 1000) / 10
    : null;

  if (measurable.length === 0) {
    notes.push('No tenant-scoped table currently holds rows — isolation index not measurable yet (honest zero-data state).');
  }
  if (scannedCount < ordered.length) {
    notes.push(`Deep-scan cap reached: ${scannedCount}/${ordered.length} tables exact-scanned (heaviest first); the remainder are inventory-only.`);
  }

  // 5. Namespace rollup.
  const nsMap = new Map<string, { tables: number; measurable: number; fully_isolated: number }>();
  for (const t of tables) {
    const agg = nsMap.get(t.namespace) ?? { tables: 0, measurable: 0, fully_isolated: 0 };
    agg.tables += 1;
    if (t.scanned && (t.total_rows ?? 0) > 0) {
      agg.measurable += 1;
      if (t.fully_isolated === true) agg.fully_isolated += 1;
    }
    nsMap.set(t.namespace, agg);
  }
  const namespaces = [...nsMap.entries()]
    .map(([namespace, v]) => ({ namespace, ...v }))
    .sort((a, b) => b.tables - a.tables);

  const gaps = measurable
    .filter((t) => (t.null_tenant_rows ?? 0) > 0 || (t.orphan_tenant_rows ?? 0) > 0)
    .sort((a, b) => (b.null_tenant_rows ?? 0) - (a.null_tenant_rows ?? 0));

  return {
    generated_at,
    degraded,
    summary: {
      tenant_scoped_tables: scoped.length,
      namespaces: namespaces.length,
      deep_scanned: scannedCount,
      measurable_tables: measurable.length,
      fully_isolated_tables: fullyIsolated.length,
      tables_with_null_tenant: withNull.length,
      tables_with_orphans: withOrphans.length,
      isolation_index,
      total_rows_scanned: totalRowsScanned,
      total_null_tenant_rows: totalNullRows,
    },
    namespaces,
    gaps,
    tables,
    notes,
  };
}
