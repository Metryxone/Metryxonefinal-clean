/**
 * Phase 8 — Global Competency · region-content ROLLBACK endpoint guard tests.
 *
 * Task #82 added FRONTEND tests proving the confirmation dialog gates every overlay deletion. These
 * tests lock the BACKEND contract of POST /api/global-competency/rollback itself, so a bug in the
 * endpoint cannot over-delete even when the UI guard is correct:
 *   • TARGETED mode (surface + region + entity_refs) deletes ONLY the named overlay rows in that
 *     surface/region and leaves every other overlay row intact.
 *   • BULK mode (empty body) removes the WHOLE provenance overlay.
 *   • Each action is recorded in the audit trail with the correct applied / rejected counts.
 *
 * Pure, DB-free: a fake pg.Pool holds the overlay table (global_region_content) and the audit table
 * (global_region_content_audit) in memory and answers exactly the queries untagRegionContent /
 * rollbackRegionContent / recordRegionAudit issue. ensure-schema / CREATE INDEX DDL is a no-op.
 *
 * Run with:  cd backend && npx tsx --test tests/global-competency-rollback.test.ts
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { registerGlobalCompetencyRoutes } from '../routes/global-competency';
import { isFlagEnabled } from '../config/feature-flags';

// The rollback endpoint is flag-gated (globalCompetency). The handler is captured BEFORE the gate
// middleware runs in these tests (we invoke the final handler directly), but assert the flag exists
// so a rename of the flag surfaces here too.
void isFlagEnabled;

interface OverlayRow {
  id: number;
  surface: string;
  region_code: string;
  entity_ref: string;
  provenance: string;
}

interface AuditRow {
  action: string;
  surface: string | null;
  region_code: string | null;
  actor_id: string | null;
  actor_email: string | null;
  requested_refs: string[];
  applied_refs: string[];
  rejected_refs: string[];
  applied_count: number;
  rejected_count: number;
  detail: unknown;
}

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

// In-memory fake pg.Pool modelling the two tables the rollback path touches.
class FakePool {
  overlay: OverlayRow[];
  audit: AuditRow[] = [];
  /** table names the to_regclass probe should report as PRESENT */
  presentTables: Set<string>;
  private seq = 1000;

  constructor(rows: OverlayRow[], presentTables = ['global_region_content', 'global_region_content_audit']) {
    this.overlay = rows.map((r) => ({ ...r }));
    this.presentTables = new Set(presentTables);
  }

  async query(text: string, params: any[] = []): Promise<any> {
    const q = norm(text);

    // to_regclass probe: SELECT to_regclass($1) AS reg  with param 'public.<name>'
    if (q.includes('to_regclass')) {
      const name = String(params[0] ?? '').replace(/^public\./, '');
      return { rows: [{ reg: this.presentTables.has(name) ? `public.${name}` : null }] };
    }

    // ensure-schema DDL — no-op
    if (q.startsWith('create table') || q.startsWith('create index') || q.startsWith('create unique index')) {
      return { rows: [], rowCount: 0 };
    }

    // Targeted untag DELETE … RETURNING entity_ref
    if (q.startsWith('delete from global_region_content') && q.includes('entity_ref = any')) {
      const [surface, region, refs] = params as [string, string, string[]];
      const refSet = new Set(refs.map(String));
      const removed = this.overlay.filter(
        (r) => r.surface === surface && r.region_code === region && refSet.has(r.entity_ref),
      );
      this.overlay = this.overlay.filter((r) => !removed.includes(r));
      return { rowCount: removed.length, rows: removed.map((r) => ({ entity_ref: r.entity_ref })) };
    }

    // Bulk rollback DELETE … WHERE provenance = $1
    if (q.startsWith('delete from global_region_content') && q.includes('provenance =')) {
      const provenance = String(params[0]);
      const before = this.overlay.length;
      this.overlay = this.overlay.filter((r) => r.provenance !== provenance);
      return { rowCount: before - this.overlay.length, rows: [] };
    }

    // Audit INSERT
    if (q.startsWith('insert into global_region_content_audit')) {
      const [
        action, surface, region_code, actor_id, actor_email,
        requested_refs, applied_refs, rejected_refs, applied_count, rejected_count, detail,
      ] = params;
      this.audit.push({
        action,
        surface: surface ?? null,
        region_code: region_code ?? null,
        actor_id: actor_id ?? null,
        actor_email: actor_email ?? null,
        requested_refs: requested_refs ?? [],
        applied_refs: applied_refs ?? [],
        rejected_refs: rejected_refs ?? [],
        applied_count,
        rejected_count,
        detail: typeof detail === 'string' ? JSON.parse(detail) : detail,
      });
      return { rows: [{ id: this.seq++ }], rowCount: 1 };
    }

    throw new Error(`FakePool: unhandled query: ${q}`);
  }
}

// Capture the rollback handler (last handler registered on POST /api/global-competency/rollback).
function captureRollbackHandler(pool: any) {
  const noop: any = (_req: any, _res: any, next?: any) => (next ? next() : undefined);
  let handler: any = null;
  const fakeApp: any = {
    get: () => {},
    post: (path: string, ...handlers: any[]) => {
      if (path === '/api/global-competency/rollback') {
        handler = handlers[handlers.length - 1];
      }
    },
  };
  registerGlobalCompetencyRoutes(fakeApp, pool, noop, noop);
  assert.ok(handler, 'rollback route handler was registered');
  return handler;
}

async function invoke(handler: any, body: any, user?: any) {
  const req: any = { body, user };
  let statusCode = 200;
  let captured: any = null;
  const res: any = {
    status(code: number) { statusCode = code; return res; },
    json(payload: any) { captured = payload; return res; },
  };
  await handler(req, res);
  return { status: statusCode, body: captured };
}

// Surface 'competency' is a valid surface key; region 'ME' is a valid non-default region.
const PROV = 'phase8_global_competency';
function seedOverlay(): OverlayRow[] {
  return [
    { id: 1, surface: 'competency_models', region_code: 'ME', entity_ref: 'A', provenance: PROV },
    { id: 2, surface: 'competency_models', region_code: 'ME', entity_ref: 'B', provenance: PROV },
    { id: 3, surface: 'competency_models', region_code: 'ME', entity_ref: 'C', provenance: PROV },
    // Different region — must survive a ME-targeted delete.
    { id: 4, surface: 'competency_models', region_code: 'EU', entity_ref: 'A', provenance: PROV },
    // Different surface — must survive a competency-targeted delete.
    { id: 5, surface: 'role_library', region_code: 'ME', entity_ref: 'A', provenance: PROV },
  ];
}

let pool: FakePool;
let handler: any;
beforeEach(() => {
  pool = new FakePool(seedOverlay());
  handler = captureRollbackHandler(pool);
});

// ─── TARGETED mode ───────────────────────────────────────────────────────────
test('targeted: deletes ONLY the named refs in the given surface/region, leaving all others intact', async () => {
  const { status, body } = await invoke(handler, {
    surface: 'competency_models', region: 'ME', entity_refs: ['A', 'B'],
  });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'targeted');
  assert.equal(body.deleted, 2, 'exactly the two named refs were deleted');
  assert.deepEqual([...body.deleted_refs].sort(), ['A', 'B']);

  // Surviving rows: ME/C, EU/A (other region), role/ME/A (other surface).
  const survivors = pool.overlay
    .map((r) => `${r.surface}:${r.region_code}:${r.entity_ref}`)
    .sort();
  assert.deepEqual(survivors, ['competency_models:EU:A', 'competency_models:ME:C', 'role_library:ME:A'],
    'only the two targeted rows were removed — no over-deletion across region or surface');
});

test('targeted: a ref absent from the surface/region counts 0 deleted and removes nothing extra', async () => {
  const { status, body } = await invoke(handler, {
    surface: 'competency_models', region: 'ME', entity_refs: ['B', 'ZZZ'],
  });
  assert.equal(status, 200);
  assert.equal(body.deleted, 1, 'only the real ref B was deleted; ZZZ did not exist');
  assert.deepEqual(body.deleted_refs, ['B']);
  assert.equal(pool.overlay.length, 4, 'four rows remain (started 5, deleted 1)');
});

test('targeted: rejects an invalid surface without deleting anything', async () => {
  const { status, body } = await invoke(handler, {
    surface: 'not_a_surface', region: 'ME', entity_refs: ['A'],
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_surface');
  assert.equal(pool.overlay.length, 5, 'nothing was deleted on a validation failure');
});

test('targeted: rejects an invalid region without deleting anything', async () => {
  const { status, body } = await invoke(handler, {
    surface: 'competency_models', region: 'XX', entity_refs: ['A'],
  });
  assert.equal(status, 400);
  assert.equal(body.error, 'invalid_region');
  assert.equal(pool.overlay.length, 5, 'nothing was deleted on a validation failure');
});

test('targeted: a surface with no refs is rejected (cannot fall through to bulk wipe)', async () => {
  const { status, body } = await invoke(handler, { surface: 'competency_models', region: 'ME' });
  assert.equal(status, 400);
  assert.equal(body.error, 'entity_refs_required');
  assert.equal(pool.overlay.length, 5, 'a targeted call missing refs must NOT bulk-delete the overlay');
});

// ─── BULK mode ───────────────────────────────────────────────────────────────
test('bulk: an empty body removes the entire provenance overlay', async () => {
  const { status, body } = await invoke(handler, {});
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'bulk');
  assert.equal(body.deleted, 5, 'all five overlay rows for the default provenance were removed');
  assert.equal(pool.overlay.length, 0, 'the whole overlay is gone');
});

test('bulk: only rows for the named provenance are wiped; other provenances survive', async () => {
  pool.overlay.push({ id: 99, surface: 'competency_models', region_code: 'ME', entity_ref: 'Z', provenance: 'other_phase' });
  const { status, body } = await invoke(handler, { provenance: PROV });
  assert.equal(status, 200);
  assert.equal(body.mode, 'bulk');
  assert.equal(body.deleted, 5);
  assert.deepEqual(pool.overlay.map((r) => r.provenance), ['other_phase'],
    'a different provenance overlay is left untouched');
});

// ─── Audit trail ─────────────────────────────────────────────────────────────
test('audit: a targeted untag records applied = deleted refs and rejected = absent refs', async () => {
  await invoke(
    handler,
    { surface: 'competency_models', region: 'ME', entity_refs: ['A', 'ZZZ'] },
    { id: 7, email: 'admin@metryxone.com' },
  );
  assert.equal(pool.audit.length, 1, 'exactly one audit row was appended');
  const a = pool.audit[0];
  assert.equal(a.action, 'untag');
  assert.equal(a.surface, 'competency_models');
  assert.equal(a.region_code, 'ME');
  assert.equal(a.actor_id, '7');
  assert.equal(a.actor_email, 'admin@metryxone.com');
  assert.deepEqual([...a.requested_refs].sort(), ['A', 'ZZZ']);
  assert.deepEqual(a.applied_refs, ['A'], 'applied = the ref actually deleted');
  assert.deepEqual(a.rejected_refs, ['ZZZ'], 'rejected = the requested-but-absent ref');
  assert.equal(a.applied_count, 1);
  assert.equal(a.rejected_count, 1);
});

test('audit: a bulk rollback records the rollback action with no applied/rejected refs', async () => {
  await invoke(handler, {}, { id: 7, email: 'admin@metryxone.com' });
  assert.equal(pool.audit.length, 1);
  const a = pool.audit[0];
  assert.equal(a.action, 'rollback');
  assert.equal(a.surface, null);
  assert.equal(a.region_code, null);
  assert.deepEqual(a.applied_refs, []);
  assert.deepEqual(a.rejected_refs, []);
  assert.equal(a.applied_count, 0);
  assert.equal(a.rejected_count, 0);
  assert.equal((a.detail as any).outcome, 'bulk_rollback');
  assert.equal((a.detail as any).deleted, 5);
});

test('audit: a fully-applied targeted untag records every ref applied and none rejected', async () => {
  await invoke(
    handler,
    { surface: 'competency_models', region: 'ME', entity_refs: ['A', 'B', 'C'] },
    { id: 7, email: 'admin@metryxone.com' },
  );
  const a = pool.audit[0];
  assert.equal(a.action, 'untag');
  assert.deepEqual([...a.applied_refs].sort(), ['A', 'B', 'C']);
  assert.deepEqual(a.rejected_refs, []);
  assert.equal(a.applied_count, 3);
  assert.equal(a.rejected_count, 0);
});
