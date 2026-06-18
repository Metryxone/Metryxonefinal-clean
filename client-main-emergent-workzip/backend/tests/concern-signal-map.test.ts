/**
 * CAPADEX Concern → Signal Mapping Engine — deterministic unit + idempotency tests
 *
 * Locks in the guarantees the mapping engine was designed around (Task #16):
 *
 *   1. Cascade precedence — bridge_exact > token_semantic > cluster_match >
 *      domain_category resolve to the correct `match_method`, and a strong token
 *      match outranks a domain-only candidate.
 *   2. Orphan guarantee — an unresolvable concern emits EXACTLY ONE explicit
 *      orphan marker row (signal_tier='orphan', signal_ref='__orphan__') and
 *      never a fabricated Tier-3/atomic signal.
 *   3. Idempotency — replace converges, upsert overwrites on conflict (DO UPDATE),
 *      append no-ops on conflict (DO NOTHING), dryRun writes nothing. Exercised
 *      end-to-end through the real `runConcernSignalMapping` orchestration against
 *      an in-memory pool that faithfully simulates the unique-index ON CONFLICT
 *      semantics of `capadex_concern_signal_map`.
 *   4. Chain validator — a concern with NO map row at all (partial-population
 *      state) is counted as a signal-stage break, never silently dropped.
 *
 * Pure + in-memory — requires NO live DATABASE_URL.
 *
 * Run with:  npx tsx backend/tests/concern-signal-map.test.ts
 */

import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import {
  mapConcernToSignals,
  runConcernSignalMapping,
  type ConcernInput,
  type MappingOntology,
  type Tier3SignalDef,
} from '../services/concern-signal-mapping-engine';
import { validateConcernSignalChain } from '../services/concern-signal-chain-validator';

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function test(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${label}`);
    console.error(err);
    failed++;
  }
}

// ── Fixtures ────────────────────────────────────────────────────────────────
function sig(partial: Partial<Tier3SignalDef> & { signal_id: string }): Tier3SignalDef {
  return {
    signal_name: partial.signal_id,
    token: partial.signal_id.toLowerCase(),
    domain: 'cognitive',
    bridge_tag: 'NO_TAG',
    hpc_cluster: '',
    severity: 0.6,
    confidence: 0.6,
    persistence: 0.6,
    nameTokens: [],
    hpcTokens: [],
    keywords: [],
    ...partial,
  };
}

function concern(partial: Partial<ConcernInput> & { id: number }): ConcernInput {
  return {
    concern_id: `CONCERN_${partial.id}`,
    domain: null,
    concern_cluster: null,
    signal_cluster: null,
    root_cause_group: null,
    display_label: null,
    concern_category: null,
    intelligence_layer: null,
    assessment_dimension: null,
    intervention_lens: null,
    relational_bridge_tag: null,
    ...partial,
  };
}

const EMPTY_ONTOLOGY = (tier3: Tier3SignalDef[]): MappingOntology => ({
  tier3,
  atomicByTag: new Map(),
  compositeKeys: new Set(),
});

// ── Suite 1: Cascade precedence ───────────────────────────────────────────────
console.log('\nCascade precedence (pure mapConcernToSignals)');

void (async () => {
  await test('bridge_exact — tag-only match (no token/hpc/domain overlap) → match_method=bridge_exact', () => {
    const ontology = EMPTY_ONTOLOGY([
      sig({ signal_id: 'SIG_PEER', signal_name: 'Peer Comparison', token: 'peer_comparison',
            nameTokens: ['peer', 'comparison'], keywords: ['compar', 'jealous'], hpcTokens: ['inferior'],
            domain: 'social', bridge_tag: 'PEER_COMPARISON' }),
    ]);
    // Corpus deliberately shares nothing with the signal's tokens/keywords/domain,
    // so the ONLY thing that resolves is the exact bridge tag.
    const rows = mapConcernToSignals(
      concern({ id: 1, display_label: 'xyzzy foobar widget', relational_bridge_tag: 'PEER_COMPARISON' }),
      ontology,
    );
    const tier3 = rows.filter((r) => r.signal_tier === 'tier3');
    assert.equal(tier3.length, 1, 'exactly one tier3 row');
    assert.equal(tier3[0].signal_ref, 'SIG_PEER');
    assert.equal(tier3[0].match_method, 'bridge_exact');
    assert.equal(rows.some((r) => r.signal_tier === 'orphan'), false, 'a resolved concern is never an orphan');
  });

  await test('token_semantic — name/synonym overlap → match_method=token_semantic', () => {
    const ontology = EMPTY_ONTOLOGY([
      sig({ signal_id: 'SIG_BURN', signal_name: 'Burnout Tendency', token: 'burnout_tendency',
            nameTokens: ['burnout', 'tendency'], keywords: ['burnout', 'exhaust'], domain: 'emotional' }),
    ]);
    const rows = mapConcernToSignals(concern({ id: 2, display_label: 'burnout and exhaustion' }), ontology);
    const tier3 = rows.filter((r) => r.signal_tier === 'tier3');
    assert.equal(tier3.length, 1);
    assert.equal(tier3[0].signal_ref, 'SIG_BURN');
    assert.equal(tier3[0].match_method, 'token_semantic');
  });

  await test('cluster_match — only hidden-pattern (hpc) tokens overlap → match_method=cluster_match', () => {
    const ontology = EMPTY_ONTOLOGY([
      sig({ signal_id: 'SIG_OVT', signal_name: 'Overthinking Pattern', token: 'overthinking',
            nameTokens: ['somethingunique'], keywords: [], hpcTokens: ['rumination', 'spiral'],
            hpc_cluster: 'hidden_overthinking_cluster', domain: 'cognitive' }),
    ]);
    const rows = mapConcernToSignals(concern({ id: 3, display_label: 'rumination and spiral' }), ontology);
    const tier3 = rows.filter((r) => r.signal_tier === 'tier3');
    assert.equal(tier3.length, 1);
    assert.equal(tier3[0].match_method, 'cluster_match');
  });

  await test('domain_category — only inferred-domain match → match_method=domain_category', () => {
    const ontology = EMPTY_ONTOLOGY([
      sig({ signal_id: 'SIG_SOC', signal_name: 'Social Withdrawal', token: 'social_withdrawal',
            nameTokens: ['rarewordzzz'], keywords: [], hpcTokens: [], domain: 'social' }),
    ]);
    // "peer" forces inferredCategory=social, but matches no name/keyword/hpc token.
    const rows = mapConcernToSignals(concern({ id: 4, display_label: 'peer dynamics' }), ontology);
    const tier3 = rows.filter((r) => r.signal_tier === 'tier3');
    assert.equal(tier3.length, 1);
    assert.equal(tier3[0].match_method, 'domain_category');
  });

  await test('precedence — a strong token match outranks a domain-only candidate (domain signal not selected)', () => {
    const ontology = EMPTY_ONTOLOGY([
      sig({ signal_id: 'SIG_TOK', signal_name: 'Burnout Tendency', token: 'burnout_tendency',
            nameTokens: ['burnout'], keywords: ['burnout', 'exhaust'], domain: 'emotional' }),
      sig({ signal_id: 'SIG_DOM', signal_name: 'Emotional Overload', token: 'emotional_overload',
            nameTokens: ['nomatchtoken'], keywords: [], domain: 'emotional' }),
    ]);
    // Corpus contains "emotional" (→ domain=emotional, both candidates domain-match)
    // AND the token "burnout" (only SIG_TOK). SIG_TOK is strong; SIG_DOM is domain-only.
    const rows = mapConcernToSignals(concern({ id: 5, display_label: 'burnout and emotional strain' }), ontology);
    const tier3 = rows.filter((r) => r.signal_tier === 'tier3');
    assert.equal(tier3.length, 1, 'only the strong token candidate is selected');
    assert.equal(tier3[0].signal_ref, 'SIG_TOK');
    assert.equal(tier3[0].match_method, 'token_semantic');
  });

  await test('composite_derived — a mapped signal whose hpc cluster is a real composite emits a composite row', () => {
    const ontology: MappingOntology = {
      tier3: [
        sig({ signal_id: 'SIG_BURN', signal_name: 'Burnout Tendency', token: 'burnout_tendency',
              nameTokens: ['burnout'], keywords: ['burnout'], domain: 'emotional',
              hpc_cluster: 'hidden_depletion_cluster' }),
      ],
      atomicByTag: new Map(),
      compositeKeys: new Set(['hidden_depletion_cluster']),
    };
    const rows = mapConcernToSignals(concern({ id: 6, display_label: 'burnout' }), ontology);
    const comp = rows.filter((r) => r.signal_tier === 'composite');
    assert.equal(comp.length, 1, 'exactly one composite row');
    assert.equal(comp[0].signal_ref, 'hidden_depletion_cluster');
    assert.equal(comp[0].match_method, 'composite_derived');
  });

  // ── Suite 2: Orphan guarantee ───────────────────────────────────────────────
  console.log('\nOrphan guarantee');

  await test('unresolvable concern → EXACTLY ONE orphan marker, no fabricated signal', () => {
    const ontology = EMPTY_ONTOLOGY([
      sig({ signal_id: 'SIG_X', signal_name: 'Career Confusion', token: 'career_confusion',
            nameTokens: ['career', 'confusion'], keywords: ['career'], domain: 'cognitive', bridge_tag: 'CAREER' }),
    ]);
    const rows = mapConcernToSignals(
      concern({ id: 7, display_label: 'qwerty asdf zxcv', relational_bridge_tag: 'UNRELATED_TAG' }),
      ontology,
    );
    assert.equal(rows.length, 1, 'a fully unresolvable concern emits exactly one row');
    assert.equal(rows[0].signal_tier, 'orphan');
    assert.equal(rows[0].signal_ref, '__orphan__');
    assert.equal(rows[0].confidence, 0);
    assert.equal(rows[0].confidence_band, 'none');
    assert.equal(rows.some((r) => r.signal_tier === 'tier3'), false, 'never fabricates a tier3 signal');
    assert.equal(rows.some((r) => r.signal_tier === 'atomic'), false, 'never fabricates an atomic signal');
  });

  await test('orphan marker coexists honestly with a coarse atomic GENERAL_CONCERN link, still no tier3', () => {
    const ontology: MappingOntology = {
      tier3: [
        sig({ signal_id: 'SIG_X', signal_name: 'Career Confusion', token: 'career_confusion',
              nameTokens: ['career'], keywords: ['career'], domain: 'cognitive' }),
      ],
      atomicByTag: new Map([
        ['GENERAL_CONCERN', { bridge_tag: 'GENERAL_CONCERN', count: 100, avg_severity: 0.5,
          avg_confidence: 0.5, avg_persistence: 0.5, sample_ids: ['a1', 'a2'] }],
      ]),
      compositeKeys: new Set(),
    };
    const rows = mapConcernToSignals(concern({ id: 8, display_label: 'qwerty nonsense' }), ontology);
    const orphans = rows.filter((r) => r.signal_tier === 'orphan');
    assert.equal(orphans.length, 1, 'exactly one orphan marker even with an atomic fallback present');
    assert.equal(orphans[0].signal_ref, '__orphan__');
    assert.equal(rows.some((r) => r.signal_tier === 'tier3'), false, 'no fabricated tier3 signal');
    // The GENERAL_CONCERN atomic link is an honest coarse row, recorded as a weak bridge_fallback.
    const atomic = rows.filter((r) => r.signal_tier === 'atomic');
    assert.equal(atomic.length, 1);
    assert.equal(atomic[0].match_method, 'bridge_fallback');
  });

  // ── Suite 3: Idempotency (replace / upsert / append / dryRun) ────────────────
  console.log('\nIdempotency — replace / upsert / append / dryRun');

  await runIdempotencyTests();

  // ── Suite 4: Chain validator partial-population robustness ───────────────────
  console.log('\nChain validator — partial population');

  await runChainValidatorTests();

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  ${passed} passed   ${failed > 0 ? failed + ' FAILED' : 'all green'}`);
  console.log('');
  if (failed > 0) process.exit(1);
})();

// ── In-memory pool that simulates capadex_concern_signal_map ──────────────────
interface StoreRow {
  concern_pk: number; concern_id: string | null; relational_bridge_tag: string | null;
  signal_tier: string; signal_ref: string; signal_name: string | null; domain: string | null;
  match_method: string; score: number; confidence: number; confidence_band: string;
  severity_weight: number | null; metadata: string;
}

/**
 * Two synthetic concerns: one resolves to a Tier-3 token match, one is an orphan.
 * No atomic rows (atomic group query returns empty) → mapping output is exactly
 * one tier3 row + one orphan row, fully deterministic.
 */
const FAKE_SIGNALS = [
  { signal_id: 'SIG_BURN', signal_name: 'Burnout Tendency', domain: 'emotional',
    relational_bridge_tag: 'EMOTIONAL_LOAD', hidden_pattern_contribution: '', related_signals: '',
    severity_weight: 0.7, confidence_weight: 0.7, persistence_weight: 0.6 },
];
const FAKE_CONCERNS = [
  { id: 101, concern_id: 'CONCERN_BURN', domain: 'emotional', concern_cluster: 'burnout exhaustion',
    signal_cluster: null, root_cause_group: null, display_label: 'burnout and exhaustion',
    concern_category: null, intelligence_layer: null, assessment_dimension: null,
    intervention_lens: null, relational_bridge_tag: 'EMOTIONAL_LOAD' },
  { id: 102, concern_id: 'CONCERN_VOID', domain: null, concern_cluster: 'qwerty nonsense gibberish',
    signal_cluster: null, root_cause_group: null, display_label: 'qwerty nonsense gibberish',
    concern_category: null, intelligence_layer: null, assessment_dimension: null,
    intervention_lens: null, relational_bridge_tag: null },
];

function makeFakePool(store: Map<string, StoreRow>): Pool {
  const key = (pk: number, tier: string, ref: string) => `${pk}|${tier}|${ref}`;

  const answer = (sqlRaw: string, params?: unknown[]): { rows: unknown[]; rowCount: number } => {
    const sql = sqlRaw.toLowerCase();
    if (/^\s*(create|begin|commit|rollback)/.test(sql)) return { rows: [], rowCount: 0 };
    if (/^\s*truncate/.test(sql)) { store.clear(); return { rows: [], rowCount: 0 }; }

    if (/from capadex_signals/.test(sql)) return { rows: FAKE_SIGNALS, rowCount: FAKE_SIGNALS.length };
    if (/from capadex_atomic_signals/.test(sql)) return { rows: [], rowCount: 0 };
    if (/from intervention_library/.test(sql)) return { rows: [], rowCount: 0 };

    if (/from capadex_concerns_master/.test(sql)) {
      if (/as concern_pk/.test(sql)) {
        // Chain validator master-universe query.
        return { rows: FAKE_CONCERNS.map((c) => ({ concern_pk: c.id, concern_id: c.concern_id })),
                 rowCount: FAKE_CONCERNS.length };
      }
      return { rows: FAKE_CONCERNS, rowCount: FAKE_CONCERNS.length };
    }

    if (/from capadex_concern_signal_map/.test(sql)) {
      // Chain validator reads tier3 + orphan rows.
      const rows = Array.from(store.values()).filter((r) => r.signal_tier === 'tier3' || r.signal_tier === 'orphan');
      return { rows, rowCount: rows.length };
    }

    if (/^\s*insert into capadex_concern_signal_map/.test(sql)) {
      const doNothing = /do nothing/.test(sql);
      const vals = params ?? [];
      for (let i = 0; i < vals.length; i += 13) {
        const r: StoreRow = {
          concern_pk: vals[i] as number, concern_id: vals[i + 1] as string | null,
          relational_bridge_tag: vals[i + 2] as string | null, signal_tier: vals[i + 3] as string,
          signal_ref: vals[i + 4] as string, signal_name: vals[i + 5] as string | null,
          domain: vals[i + 6] as string | null, match_method: vals[i + 7] as string,
          score: vals[i + 8] as number, confidence: vals[i + 9] as number,
          confidence_band: vals[i + 10] as string, severity_weight: vals[i + 11] as number | null,
          metadata: vals[i + 12] as string,
        };
        const k = key(r.concern_pk, r.signal_tier, r.signal_ref);
        if (store.has(k)) { if (!doNothing) store.set(k, r); /* DO NOTHING: keep existing */ }
        else store.set(k, r);
      }
      return { rows: [], rowCount: 0 };
    }

    return { rows: [], rowCount: 0 };
  };

  const query = (sql: unknown, params?: unknown) => {
    const text = typeof sql === 'string' ? sql : (sql as { text?: string })?.text ?? '';
    return Promise.resolve(answer(text, params as unknown[] | undefined));
  };

  const client = {
    query,
    release: () => undefined,
  };

  return {
    query,
    connect: () => Promise.resolve(client),
    end: () => Promise.resolve(),
  } as unknown as Pool;
}

async function runIdempotencyTests() {
  await test('dryRun — computes stats but writes NOTHING', async () => {
    const store = new Map<string, StoreRow>();
    const pool = makeFakePool(store);
    const stats = await runConcernSignalMapping(pool, { mode: 'replace', dryRun: true });
    assert.equal(stats.dry_run, true);
    assert.ok(stats.rows_total > 0, 'stats still reflect computed rows');
    assert.equal(store.size, 0, 'dryRun must not persist any rows');
  });

  await test('replace — converges (re-running yields byte-identical store)', async () => {
    const store = new Map<string, StoreRow>();
    const pool = makeFakePool(store);
    await runConcernSignalMapping(pool, { mode: 'replace' });
    const snap1 = JSON.stringify([...store.entries()].sort());
    const sizeAfterFirst = store.size;
    assert.ok(sizeAfterFirst > 0, 'replace populates rows');
    await runConcernSignalMapping(pool, { mode: 'replace' });
    const snap2 = JSON.stringify([...store.entries()].sort());
    assert.equal(store.size, sizeAfterFirst, 'replace converges to a stable row count');
    assert.equal(snap1, snap2, 'replace is idempotent — identical store on re-run');
  });

  await test('replace — TRUNCATEs stale rows that the engine no longer produces', async () => {
    const store = new Map<string, StoreRow>();
    const pool = makeFakePool(store);
    store.set('999|tier3|GHOST', {
      concern_pk: 999, concern_id: 'GHOST', relational_bridge_tag: null, signal_tier: 'tier3',
      signal_ref: 'GHOST', signal_name: 'ghost', domain: null, match_method: 'token_semantic',
      score: 1, confidence: 1, confidence_band: 'strong', severity_weight: 1, metadata: '{}',
    });
    await runConcernSignalMapping(pool, { mode: 'replace' });
    assert.equal(store.has('999|tier3|GHOST'), false, 'replace wipes pre-existing rows before reinserting');
  });

  await test('upsert — overwrites a conflicting (concern,tier,ref) row (DO UPDATE)', async () => {
    const store = new Map<string, StoreRow>();
    const pool = makeFakePool(store);
    // Seed a STALE row at the exact key the engine will produce for the burnout concern.
    const k = '101|tier3|SIG_BURN';
    store.set(k, {
      concern_pk: 101, concern_id: 'CONCERN_BURN', relational_bridge_tag: 'EMOTIONAL_LOAD',
      signal_tier: 'tier3', signal_ref: 'SIG_BURN', signal_name: 'stale', domain: null,
      match_method: '__STALE__', score: 0, confidence: 0.0123, confidence_band: 'weak',
      severity_weight: 0, metadata: '{}',
    });
    await runConcernSignalMapping(pool, { mode: 'upsert' });
    const updated = store.get(k)!;
    assert.notEqual(updated.match_method, '__STALE__', 'upsert overwrites the stale match_method');
    assert.equal(updated.match_method, 'token_semantic');
    assert.notEqual(updated.confidence, 0.0123, 'upsert overwrites the stale confidence');
  });

  await test('append — no-ops on a conflicting row (DO NOTHING), still inserts new ones', async () => {
    const store = new Map<string, StoreRow>();
    const pool = makeFakePool(store);
    // Populate first, then mark one row with a sentinel that append must NOT overwrite.
    await runConcernSignalMapping(pool, { mode: 'replace' });
    const k = '101|tier3|SIG_BURN';
    assert.ok(store.has(k), 'precondition: burnout tier3 row exists');
    const sentinel = { ...store.get(k)!, match_method: '__KEEP__' };
    store.set(k, sentinel);
    // Also drop a row so we can confirm append re-inserts the genuinely-missing one.
    store.delete('102|orphan|__orphan__');
    await runConcernSignalMapping(pool, { mode: 'append' });
    assert.equal(store.get(k)!.match_method, '__KEEP__', 'append must NOT overwrite an existing conflicting row');
    assert.ok(store.has('102|orphan|__orphan__'), 'append re-inserts a genuinely missing row');
  });
}

async function runChainValidatorTests() {
  await test('concern with NO map row at all is counted as a signal-stage break', async () => {
    // Empty store → no map rows for ANY of the two master concerns.
    const store = new Map<string, StoreRow>();
    const pool = makeFakePool(store);
    const report = await validateConcernSignalChain(pool);
    assert.equal(report.total_concerns, FAKE_CONCERNS.length, 'full concern universe is the denominator');
    assert.equal(report.orphan, FAKE_CONCERNS.length, 'every map-less concern is an orphan');
    assert.equal(report.breaks.signal, FAKE_CONCERNS.length, 'every map-less concern breaks at the signal stage');
    for (const r of report.results) {
      assert.equal(r.tier3_count, 0);
      assert.equal(r.breaks_at, 'signal');
      assert.equal(r.complete, false);
    }
  });

  await test('mixed population — orphan-only and map-less concerns both break at signal; tier3-only breaks later', async () => {
    const store = new Map<string, StoreRow>();
    const pool = makeFakePool(store);
    // Concern 101 → a tier3 row (reaches signal stage; no composites defined here → breaks at composite).
    store.set('101|tier3|SIG_BURN', {
      concern_pk: 101, concern_id: 'CONCERN_BURN', relational_bridge_tag: 'EMOTIONAL_LOAD',
      signal_tier: 'tier3', signal_ref: 'SIG_BURN', signal_name: 'Burnout Tendency', domain: 'emotional',
      match_method: 'token_semantic', score: 2, confidence: 0.8, confidence_band: 'strong',
      severity_weight: 0.7, metadata: '{}',
    });
    // Concern 102 → only an orphan marker row (chain never starts → signal break).
    store.set('102|orphan|__orphan__', {
      concern_pk: 102, concern_id: 'CONCERN_VOID', relational_bridge_tag: null, signal_tier: 'orphan',
      signal_ref: '__orphan__', signal_name: null, domain: null, match_method: 'orphan',
      score: 0, confidence: 0, confidence_band: 'none', severity_weight: null, metadata: '{}',
    });
    const report = await validateConcernSignalChain(pool);
    assert.equal(report.total_concerns, 2);
    assert.equal(report.orphan, 1, 'only the orphan-marker concern counts as an orphan (102)');
    assert.equal(report.breaks.signal, 1, 'the orphan-only concern breaks at signal');
    assert.equal(report.breaks.composite, 1, 'the tier3-only concern reaches the signal but breaks at composite');
    const c102 = report.results.find((r) => r.concern_pk === 102)!;
    assert.equal(c102.breaks_at, 'signal');
    assert.equal(c102.tier3_count, 0);
  });
}
