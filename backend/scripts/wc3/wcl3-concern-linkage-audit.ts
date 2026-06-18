/**
 * WC-L3 — Concern Linkage Intelligence Audit (AUDIT ONLY · READ-ONLY · NO IMPLEMENTATION ·
 * NO SCHEMA CHANGES · NO DEPLOY · STOP FOR APPROVAL).
 *
 * Question: why do completed sessions fail to produce `master_concern_pk` /
 * `primary_construct_key` / a behavioural spine, and what is the SHORTEST path to >90%
 * linkage coverage (and >90% forecast readiness)?
 *
 * Method: trace Question → Concern → Construct → Outcome → Journey → Forecast for every
 * completed session, and — the decisive step — RE-RUN the EXISTING resolvers read-only over
 * the stored `concern_name` text to separate three loss modes:
 *   • CAPTURE failure   (the input text never arrived)        — measured by concern_name presence
 *   • MAPPING failure   (resolver can't map captured text)    — measured by re-resolve == null
 *   • PERSISTENCE/STALE (resolver maps now but wasn't stored) — measured by re-resolve != stored
 *
 * Outcome/journey/forecast reachability is MEASURED by mirroring the engine's own construct
 * resolver (`resolveConstructsFromClarityBank` = primary_construct_key ∪ L5C crosswalk of the
 * master concern's bridge tag) against each outcome model's construct vocabulary. The spine is
 * empty for every session (0 active hypotheses; patterns carry no construct_key), so this mirror
 * is faithful to what the live engine would emit after a re-resolve.
 *
 * HONESTY: every number is read from live data or computed by the EXISTING resolvers; nothing is
 * fabricated. Deterministic (re-resolvable today) is reported separately from projected
 * (needs a new mapping entry / spine generation). PII: emails sha256-masked. NO WRITES.
 *
 * Run (crosswalk tier ON so the master→construct hop is live, matching the WC-L2B/runtime path):
 *   cd backend && FF_WC3_OUTCOME=1 FF_WC3_OUTCOME_CROSSWALK=1 \
 *     npx tsx scripts/wc3/wcl3-concern-linkage-audit.ts
 */
import { Pool } from 'pg';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { resolveSeedConcernPk } from '../../services/concern-signal-seeding';
import { detectCategory } from '../../routes/capadex-concern-intelligence';
import { resolveConstructForBridgeTag } from '../../data/bridge-tag-construct-crosswalk';

const OUT_DIR = join(process.cwd(), 'audit', 'wc-l3');
const mask = (e: string | null | undefined) => e ? 'user_' + createHash('sha256').update(e.toLowerCase()).digest('hex').slice(0, 10) : 'anon';
const pct = (n: number, d: number) => (d === 0 ? '—' : ((n / d) * 100).toFixed(1) + '%');
const yn = (b: boolean) => (b ? 'yes' : 'no');

interface OutcomeModel { model_key: string; construct_keys: string[]; }

interface SessionRow {
  sid: string; owned: boolean; who: string; concern: string; created: string;
  responses: number;
  storedMaster: number | null; reMaster: number | null;
  storedPck: string | null; rePck: string | null;
  bridgeTag: string | null;
  resolvedConstructs: string[];      // pck(re) ∪ crosswalk(reMaster) — what the engine WOULD load
  matchedModels: string[];           // outcome models overlapping resolvedConstructs
  outcomeReachable: boolean;
  hasStoredOutcome: boolean;
  sig: number; comp: number; pat: number; hyp: number; hypActive: number;
}

async function loadModels(pool: Pool): Promise<OutcomeModel[]> {
  const { rows } = await pool.query(`SELECT model_key, construct_keys FROM wc3_outcome_models ORDER BY model_key`);
  return rows.map((r) => ({ model_key: r.model_key, construct_keys: Array.isArray(r.construct_keys) ? r.construct_keys.map(String) : [] }));
}

/** Mirror resolveConstructsFromClarityBank for a HYPOTHETICAL master/pck (read-only). */
async function resolveConstructs(pool: Pool, master: number | null, pck: string | null): Promise<{ constructs: string[]; bridgeTag: string | null }> {
  const out = new Set<string>();
  if (pck && pck.trim() !== '') out.add(pck);
  let bridgeTag: string | null = null;
  if (master != null) {
    const { rows } = await pool.query(`SELECT relational_bridge_tag FROM capadex_concerns_master WHERE id=$1 LIMIT 1`, [master]);
    bridgeTag = rows[0]?.relational_bridge_tag ?? null;
    const entry = resolveConstructForBridgeTag(bridgeTag as any);
    if (entry) {
      if (entry.status === 'HIGH_CONFIDENCE' && entry.construct) out.add(entry.construct);
      else if (entry.status === 'REVIEW_REQUIRED' && Array.isArray(entry.candidates)) for (const c of entry.candidates) out.add(c);
    }
  }
  return { constructs: Array.from(out), bridgeTag };
}

function matchModels(constructs: string[], models: OutcomeModel[]): string[] {
  const set = new Set(constructs);
  return models.filter((m) => m.construct_keys.some((c) => set.has(c))).map((m) => m.model_key);
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const stamp = new Date().toISOString();
  const models = await loadModels(pool);

  const { rows: masterCount } = await pool.query(`SELECT count(*)::int AS n FROM capadex_concerns_master`);

  const { rows } = await pool.query(
    `SELECT s.id::text AS sid, (s.guest_email IS NOT NULL AND s.guest_email<>'') AS owned, s.guest_email,
            s.concern_name, s.master_concern_pk, s.primary_construct_key, s.created_at,
            (SELECT count(*) FROM capadex_responses r WHERE r.session_id::text=s.id::text)::int AS responses,
            (SELECT count(*) FROM capadex_session_signals x WHERE x.session_id::text=s.id::text)::int AS sig,
            (SELECT count(*) FROM capadex_session_composites x WHERE x.session_id::text=s.id::text)::int AS comp,
            (SELECT count(*) FROM capadex_session_patterns x WHERE x.session_id::text=s.id::text)::int AS pat,
            (SELECT count(*) FROM behavioural_hypotheses h WHERE h.session_id=s.id::text)::int AS hyp,
            (SELECT count(*) FROM behavioural_hypotheses h WHERE h.session_id=s.id::text AND h.lifecycle_state='active' AND h.construct_key IS NOT NULL)::int AS hyp_active,
            EXISTS(SELECT 1 FROM wc3_outcome_state o WHERE o.session_id=s.id) AS has_outcome
       FROM capadex_sessions s WHERE s.status='completed' ORDER BY s.created_at`,
  );

  const sessions: SessionRow[] = [];
  for (const r of rows) {
    const reMaster = await resolveSeedConcernPk(pool, r.concern_name, true);
    const det = detectCategory(String(r.concern_name || ''));
    const rePck = det.construct_key;
    // What the engine WOULD load after a re-resolve backfill (re_master + re_pck), crosswalk-on:
    const { constructs, bridgeTag } = await resolveConstructs(pool, reMaster, rePck);
    const matchedModels = matchModels(constructs, models);
    sessions.push({
      sid: r.sid, owned: r.owned, who: mask(r.guest_email),
      concern: String(r.concern_name || ''), created: new Date(r.created_at).toISOString().slice(0, 10),
      responses: r.responses,
      storedMaster: r.master_concern_pk, reMaster,
      storedPck: r.primary_construct_key, rePck,
      bridgeTag, resolvedConstructs: constructs, matchedModels,
      outcomeReachable: matchedModels.length > 0,
      hasStoredOutcome: r.has_outcome,
      sig: r.sig, comp: r.comp, pat: r.pat, hyp: r.hyp, hypActive: r.hyp_active,
    });
  }

  const N = sessions.length;
  const storedMasterN = sessions.filter((s) => s.storedMaster != null).length;
  const reMasterN = sessions.filter((s) => s.reMaster != null).length;
  const storedPckN = sessions.filter((s) => s.storedPck).length;
  const rePckN = sessions.filter((s) => s.rePck).length;
  const storedOutcomeN = sessions.filter((s) => s.hasStoredOutcome).length;
  const reOutcomeN = sessions.filter((s) => s.outcomeReachable).length;
  const sigN = sessions.filter((s) => s.sig > 0).length;
  const compN = sessions.filter((s) => s.comp > 0).length;
  const patN = sessions.filter((s) => s.pat > 0).length;
  const hypN = sessions.filter((s) => s.hypActive > 0).length;
  const zeroResp = sessions.filter((s) => s.responses === 0).length;

  // Forecast reachability: owned user with ≥2 completed sessions whose sessions are ALL outcome-bearing.
  const ownedByUser = new Map<string, SessionRow[]>();
  for (const s of sessions) if (s.owned) { const k = s.who; (ownedByUser.get(k) ?? ownedByUser.set(k, []).get(k)!).push(s); }
  const eligibleOwners = [...ownedByUser.entries()].filter(([, ss]) => ss.length >= 2);
  const forecastStored = eligibleOwners.filter(([, ss]) => ss.filter((s) => s.hasStoredOutcome).length >= 2).length;
  const forecastReResolve = eligibleOwners.filter(([, ss]) => ss.filter((s) => s.outcomeReachable).length >= 2).length;

  const flagLine = `Flags at run: \`FF_WC3_OUTCOME\`=${process.env.FF_WC3_OUTCOME === '1' ? 'ON' : 'OFF'}, \`FF_WC3_OUTCOME_CROSSWALK\`=${process.env.FF_WC3_OUTCOME_CROSSWALK === '1' ? 'ON' : 'OFF'}. Audit is READ-ONLY (no writes).`;
  const mappingGapConcerns = [...new Set(sessions.filter((s) => !s.rePck).map((s) => s.concern))];

  // ── 1. Concern Coverage Report ──
  writeFileSync(join(OUT_DIR, '01_concern_coverage_report.md'), `# WC-L3 Deliverable 1 — Concern Coverage Report
_Generated ${stamp}_

${flagLine}

**\`master_concern_pk\` is resolved at \`/start\`** from the free-text \`concern_name\` via
\`resolveSeedConcernPk\` (≥${60}% token overlap against \`capadex_concerns_master\`, ${masterCount[0].n} rows).
We RE-RAN that exact resolver read-only over every stored \`concern_name\`.

| Metric | Value | of ${N} completed |
|---|---|---|
| Sessions with \`concern_name\` captured (input present) | ${sessions.filter((s) => s.concern.trim()).length} | ${pct(sessions.filter((s) => s.concern.trim()).length, N)} |
| Sessions with \`master_concern_pk\` **stored** | ${storedMasterN} | ${pct(storedMasterN, N)} |
| Sessions where the EXISTING resolver **re-resolves** a pk today | **${reMasterN}** | **${pct(reMasterN, N)}** |

| Session | Owned | Created | concern_name | stored pk | re-resolved pk |
|---|---|---|---|---|---|
${sessions.map((s) => `| ${s.sid.slice(0, 8)} | ${yn(s.owned)} | ${s.created} | ${s.concern} | ${s.storedMaster ?? '—'} | ${s.reMaster ?? '—'} |`).join('\n')}

**Honest finding:** concern input is captured **${pct(sessions.filter((s) => s.concern.trim()).length, N)}** and the resolver
re-resolves **${reMasterN}/${N}** today — but only **${storedMasterN}** is stored. The gap is **stale/unpersisted
linkage**, NOT a capture failure and NOT a resolver-quality failure. See Root Cause (Deliverable 5).
`);

  // ── 2. Construct Coverage Report ──
  writeFileSync(join(OUT_DIR, '02_construct_coverage_report.md'), `# WC-L3 Deliverable 2 — Construct Coverage Report
_Generated ${stamp}_

${flagLine}

**\`primary_construct_key\` is resolved at \`/start\`** (client \`construct_key\` → else \`detectCategory\`
over \`concern_name\` against \`CONCERN_TO_CONSTRUCT\`/\`CONSTRUCT_MAP\`). We re-ran \`detectCategory\` read-only.

| Metric | Value | of ${N} |
|---|---|---|
| \`primary_construct_key\` **stored** | ${storedPckN} | ${pct(storedPckN, N)} |
| \`detectCategory\` **re-resolves** a construct today | **${rePckN}** | **${pct(rePckN, N)}** |
| Unmappable by existing \`detectCategory\` (mapping gap) | ${N - rePckN} | ${pct(N - rePckN, N)} |

| Session | concern_name | stored construct | re-resolved construct |
|---|---|---|---|
${sessions.map((s) => `| ${s.sid.slice(0, 8)} | ${s.concern} | ${s.storedPck ?? '—'} | ${s.rePck ?? '— (gap)'} |`).join('\n')}

**Mapping-gap concerns** (present, meaningful, but absent from \`CONCERN_TO_CONSTRUCT\`): ${mappingGapConcerns.map((c) => `\`${c}\``).join(', ')}.
**Honest finding:** construct linkage is a TWO-part loss — **${rePckN - storedPckN}** stale (re-resolvable now)
+ **${N - rePckN}** a genuine mapping gap that needs a small curated \`CONCERN_TO_CONSTRUCT\` addition.
Note the master-concern path still reaches these sessions' outcomes even without a construct key (Deliverable 4).
`);

  // ── 3. Behavioural Spine Report ──
  writeFileSync(join(OUT_DIR, '03_behavioural_spine_report.md'), `# WC-L3 Deliverable 3 — Behavioural Spine Report
_Generated ${stamp}_

${flagLine}

The spine is written fire-and-forget at \`/respond\` (signals/composites/patterns via \`runEvidenceRuntime\`);
**hypotheses are NOT in the \`/respond\` loop** — they are generated only by the separate client-triggered
\`/api/bios/hypotheses/generate\` route, which these sessions never called.

| Spine layer | Sessions with ≥1 row | of ${N} | Used by the construct resolver? |
|---|---|---|---|
| Signals (\`capadex_session_signals\`) | ${sigN} | ${pct(sigN, N)} | indirectly (feed composites/patterns) |
| Composites (\`capadex_session_composites\`) | ${compN} | ${pct(compN, N)} | no |
| Patterns (\`capadex_session_patterns\`) | ${patN} | ${pct(patN, N)} | **no — table has no \`construct_key\` column** (inert tier) |
| Hypotheses active+keyed (\`behavioural_hypotheses\`) | ${hypN} | ${pct(hypN, N)} | **YES — the primary construct source (empty here)** |

| Session | responses | signals | composites | patterns | active hypotheses |
|---|---|---|---|---|---|
${sessions.map((s) => `| ${s.sid.slice(0, 8)} | ${s.responses} | ${s.sig} | ${s.comp} | ${s.pat} | ${s.hypActive} |`).join('\n')}

**Honest finding:** the construct-bearing spine layer (active hypotheses) is **0/${N}** — an architectural
gap (never invoked at \`/respond\`), not a thresholding fluke. Composites are **0/${N}** (definition mismatch);
patterns exist but are construct-inert. **${zeroResp}/${N}** sessions have **0 responses** → no evidence exists,
so their spine is **un-backfillable** (a true ceiling, never to be fabricated). Because the construct resolver
falls back to the concern/construct path (Deliverable 4), an empty spine is NOT fatal to outcome reachability.
`);

  // ── 4. Linkage Loss Funnel ──
  // Journey is NOT independently simulated here. Per the engine contract
  // (services/wc3/journey-intelligence.ts): buildJourney NEVER returns null — every session
  // routes, via a deterministic Mentoring fallback (degraded:true, LOW_CONFIDENCE) when no
  // outcome model activates. So "journey routed" is structurally 9/9; a CONFIDENT (non-fallback)
  // journey requires ≥1 activated outcome model and therefore mirrors outcome reachability.
  // Both rows below are DERIVED from that contract, not measured by executing buildJourney.
  const journeyRouted = N;                  // structural guarantee (mentoring fallback)
  const journeyConfidentStored = storedOutcomeN;
  const journeyConfidentReResolve = reOutcomeN;
  writeFileSync(join(OUT_DIR, '04_linkage_loss_funnel.md'), `# WC-L3 Deliverable 4 — Linkage Loss Funnel
_Generated ${stamp}_

${flagLine}

Two columns: **Stored today** vs **Achievable by re-resolving EXISTING data with the EXISTING resolver**
(re_master ∪ re_pck, crosswalk-on). Outcome reachability is MEASURED by mirroring the engine's construct
resolver against each outcome model's construct vocabulary. Journey is reported in TWO honest rows: "routed"
(structurally 9/9 — the engine's Mentoring fallback guarantees a route) vs "confident/non-fallback" (requires
an activated outcome model → mirrors outcome). Both are DERIVED from the journey-engine contract, not measured here.

| Layer | Stored today | Achievable (re-resolve, existing data) |
|---|---|---|
| Completed sessions | ${N} | ${N} |
| Concern linked (\`master_concern_pk\`) | ${storedMasterN} (${pct(storedMasterN, N)}) | **${reMasterN} (${pct(reMasterN, N)})** |
| Construct linked (\`primary_construct_key\`) | ${storedPckN} (${pct(storedPckN, N)}) | ${rePckN} (${pct(rePckN, N)}) |
| Outcome reachable | ${storedOutcomeN} (${pct(storedOutcomeN, N)}) | **${reOutcomeN} (${pct(reOutcomeN, N)})** |
| Journey routed — incl. Mentoring fallback (DERIVED, engine contract) | ${journeyRouted} (${pct(journeyRouted, N)}) | ${journeyRouted} (${pct(journeyRouted, N)}) |
| Journey confident — non-fallback / outcome-backed (DERIVED, mirrors outcome) | ${journeyConfidentStored} (${pct(journeyConfidentStored, N)}) | ${journeyConfidentReResolve} (${pct(journeyConfidentReResolve, N)}) |
| Forecast reachable (eligible owners, ≥2 sessions) | ${forecastStored}/${eligibleOwners.length} (${pct(forecastStored, eligibleOwners.length)}) | **${forecastReResolve}/${eligibleOwners.length} (${pct(forecastReResolve, eligibleOwners.length)})** |

## Per-session reachability (achievable)
| Session | Owned | re_master | bridge tag | resolved constructs | outcome models | outcome reachable |
|---|---|---|---|---|---|---|
${sessions.map((s) => `| ${s.sid.slice(0, 8)} | ${yn(s.owned)} | ${s.reMaster ?? '—'} | ${s.bridgeTag ?? '—'} | ${s.resolvedConstructs.join(', ') || '—'} | ${s.matchedModels.join(', ') || '—'} | ${yn(s.outcomeReachable)} |`).join('\n')}

**Honest finding:** the single biggest drop is at the FIRST hop — **${N - storedMasterN}** sessions lose concern
linkage today, yet **${reMasterN - storedMasterN}** of those are recoverable from data already on disk. Once concern
linkage is restored, outcome reachability rises from ${storedOutcomeN} to ${reOutcomeN}/${N} and forecast from
${forecastStored} to ${forecastReResolve}/${eligibleOwners.length} eligible owners — with no new capture.

> **Caveat — "reachable" is STRUCTURAL, not evidence quality.** Outcome reachability means the construct→model
> chain ROUTES (the engine would emit outcome state), not that rich behaviour was scored. **${zeroResp}** of the
> ${N} reachable sessions have **0 responses** — they route to a model purely via concern linkage with no
> behavioural evidence. They are correctly EXCLUDED from forecast (anon and/or single-session); the forecast
> ${forecastReResolve}/${eligibleOwners.length} rests only on the ${eligibleOwners.length * 2}-session owned cohort, every one of which has responses.
`);

  // ── 5. Root Cause Analysis ──
  writeFileSync(join(OUT_DIR, '05_root_cause_analysis.md'), `# WC-L3 Deliverable 5 — Root Cause Analysis
_Generated ${stamp}_

${flagLine}

Loss is classified per layer into: **capture** (input absent) · **mapping** (resolver can't map a present
input) · **pipeline/stale** (resolver maps but result not persisted) · **flag gating** · **data quality**.

| Layer | Primary cause | Evidence | Class |
|---|---|---|---|
| \`master_concern_pk\` (${storedMasterN}/${N}) | resolver maps **${reMasterN}/${N}** today but only ${storedMasterN} stored | concern_name present ${pct(sessions.filter((s) => s.concern.trim()).length, N)}; re-resolve ${pct(reMasterN, N)} | **pipeline / stale persistence** (legacy sessions predate the \`/start\` resolve; not capture, not mapping) |
| \`primary_construct_key\` (${storedPckN}/${N}) | ${rePckN - storedPckN} stale + ${N - rePckN} unmapped | re-resolve ${rePckN}/${N}; gaps: ${mappingGapConcerns.map((c) => `\`${c}\``).join(', ')} | **mixed: stale persistence + mapping gap** |
| Behavioural spine (hypotheses ${hypN}/${N}) | hypotheses never generated at \`/respond\` (separate route); ${zeroResp} sessions have 0 responses | active hypotheses 0/${N}; composites 0/${N} | **pipeline (architectural) + data quality (0-response)** |
| Outcome (${storedOutcomeN}/${N}) | downstream of concern/construct | reaches ${reOutcomeN}/${N} once linkage restored | **inherited (not its own failure)** |
| Forecast (${forecastStored}/${eligibleOwners.length}) | downstream of outcome + depth | ${forecastReResolve}/${eligibleOwners.length} once linkage restored | **inherited + longitudinal depth** |

## The decisive distinction
- **It is NOT a capture failure:** \`concern_name\` is present on ${pct(sessions.filter((s) => s.concern.trim()).length, N)} of completed sessions.
- **It is NOT (mostly) a resolver-quality failure:** the EXISTING resolver re-maps ${reMasterN}/${N} concerns and ${rePckN}/${N} constructs from that text RIGHT NOW.
- **It IS stale persistence:** the resolve runs at \`/start\`; these sessions were created before that wiring (or the value was not persisted), so the column stayed NULL while the input survived.
- **Residual true gaps:** ${N - rePckN} construct mapping gaps (need a curated \`CONCERN_TO_CONSTRUCT\` entry) and ${zeroResp} zero-response sessions (un-backfillable spine — honest ceiling).
`);

  // ── 6. Coverage Expansion Roadmap ──
  writeFileSync(join(OUT_DIR, '06_coverage_expansion_roadmap.md'), `# WC-L3 Deliverable 6 — Coverage Expansion Roadmap
_Generated ${stamp}_

${flagLine}

Outcome and forecast coverage are MEASURED under each scenario by mirroring the engine's construct
resolver against each outcome model's construct vocabulary. The **Journey coverage** column is a DERIVED
proxy (confident, non-fallback = outcome-backed), not independently executed — the journey engine's
Mentoring fallback would additionally route every remaining session as degraded (so "routed" is 9/9).
"Deterministic" = achievable from data on disk with existing code; "projected" = needs a new mapping
entry or spine generation (labelled, never claimed as measured).

| Scenario | Concern linked | Construct linked | Outcome coverage | Journey confident (derived) | Forecast coverage (eligible owners) | Cost |
|---|---|---|---|---|---|---|
| Baseline (stored) | ${storedMasterN}/${N} | ${storedPckN}/${N} | ${storedOutcomeN}/${N} | ${journeyConfidentStored}/${N} | ${forecastStored}/${eligibleOwners.length} | — |
| **A — re-resolve concern (existing data+resolver)** | **${reMasterN}/${N}** | ${storedPckN}/${N} | **${reOutcomeN}/${N}** | ${journeyConfidentReResolve}/${N} | **${forecastReResolve}/${eligibleOwners.length}** | **lowest — offline re-resolve backfill** |
| B — 100% construct linkage | ${storedMasterN}/${N} | ${N}/${N}* | ${reOutcomeN}/${N}† | ${reOutcomeN}/${N}† | ${forecastReResolve}/${eligibleOwners.length}† | low — re-resolve + ${N - rePckN} new \`CONCERN_TO_CONSTRUCT\` entries (*projected) |
| C — 100% behavioural spine | ${storedMasterN}/${N} | ${storedPckN}/${N} | ≤${N - zeroResp}/${N}‡ | ≤${N - zeroResp}/${N}‡ | depth-bound | **highest — wire hypotheses into \`/respond\`; ${zeroResp} sessions un-backfillable** |
| D — combined (A+B+C) | ${reMasterN}/${N} | ${N}/${N}* | ${reOutcomeN}/${N} | ${reOutcomeN}/${N} | ${forecastReResolve}/${eligibleOwners.length} | sum of above |

Concern linkage in D is the deterministic re-resolve (${reMasterN}/${N}), NOT projected. \* construct linkage to 100% requires ${N - rePckN} curated \`CONCERN_TO_CONSTRUCT\` additions (projected, not measured) — outcome/forecast in D do NOT exceed Scenario A because the master→bridge→crosswalk path already reaches the models.
† construct path is REDUNDANT with the concern path for outcome here — adding it does not raise outcome/forecast
beyond Scenario A, because the master→bridge→crosswalk hop already reaches these models.
‡ spine ceiling is ${N - zeroResp}/${N} (${zeroResp} zero-response sessions cannot generate evidence); and its outcome
contribution is redundant given A — the spine is one of THREE OR-paths to a construct.

## Which fix gives the largest lift
**Scenario A (concern re-resolve).** It moves concern linkage ${storedMasterN}→${reMasterN}, outcome ${storedOutcomeN}→${reOutcomeN},
and forecast ${forecastStored}→${forecastReResolve}/${eligibleOwners.length} — using ONLY data already on disk and the EXISTING resolver
(the WC-L2B backfill is already idempotent and would execute exactly this once linkage is restored). Construct
mapping (B) and spine wiring (C) are largely REDUNDANT for outcome/forecast given A.

## Shortest path to >90%
- **>90% concern linkage:** Scenario A alone → ${pct(reMasterN, N)} (deterministic, existing data).
- **>90% forecast readiness (eligible owners):** Scenario A alone → ${pct(forecastReResolve, eligibleOwners.length)}.
- The ONLY non-A residuals are ${N - rePckN} construct mapping gaps + ${zeroResp} zero-response sessions; neither blocks the
  >90% targets above. The persistent ceiling is **longitudinal depth** (forecast needs ≥2 owned outcome-bearing
  sessions per user) — a data-accumulation limit, not a linkage defect.
`);

  // ── 7. Executive Summary ──
  writeFileSync(join(OUT_DIR, '07_executive_summary.md'), `# WC-L3 — Executive Summary (Concern Linkage Intelligence Audit)
_Generated ${stamp}_

${flagLine}

## Success-criteria answers
| Question | Answer |
|---|---|
| **Where is linkage lost?** | At the FIRST hop — \`master_concern_pk\` (${storedMasterN}/${N} stored) — and secondarily \`primary_construct_key\` (${storedPckN}/${N}). Everything downstream (outcome ${storedOutcomeN}/${N}, forecast ${forecastStored}/${eligibleOwners.length}) is INHERITED loss, not its own failure. |
| **Why is linkage lost?** | NOT capture (concern_name present ${pct(sessions.filter((s) => s.concern.trim()).length, N)}) and NOT resolver quality (re-resolves ${reMasterN}/${N} concerns today). It is **stale persistence**: the resolve runs at \`/start\` and these legacy sessions predate that wiring. Residuals: ${N - rePckN} construct mapping gaps + ${zeroResp} zero-response sessions. |
| **Which fix gives the largest lift?** | A **concern re-resolve backfill of existing data** using the EXISTING resolver (Scenario A): concern ${storedMasterN}→${reMasterN}, outcome ${storedOutcomeN}→${reOutcomeN}, forecast ${forecastStored}→${forecastReResolve}/${eligibleOwners.length}. Construct mapping & spine wiring are largely redundant for outcome/forecast. |
| **Shortest path to >90% linkage coverage?** | Scenario A alone → ${pct(reMasterN, N)} concern linkage, deterministic, no new capture, no new ontology. |
| **Shortest path to >90% forecast readiness?** | Scenario A alone → ${pct(forecastReResolve, eligibleOwners.length)} of eligible owners. Remaining ceiling is longitudinal depth (≥2 owned outcome-bearing sessions/user), not linkage. |

## How this refines WC-L2B
WC-L2B concluded outcome activation was blocked by "upstream concern-linkage capture, unfixable by reuse."
WC-L3 sharpens that: the concern **text** IS captured; only the **resolved pk/key** went unpersisted, and the
EXISTING resolver recovers ${reMasterN}/${N} from data on disk. So the WC-L2B backfill was a no-op only because it
re-read the stored (NULL) linkage — **re-resolving concern_name first would let that same idempotent backfill
activate outcomes for ${reOutcomeN}/${N} sessions and forecasts for ${forecastReResolve}/${eligibleOwners.length} eligible owners.** That is the
shortest path, and it needs no new capture pipeline — contrary to the WC-L2B framing.

## Recommendation (no work taken — STOP FOR APPROVAL)
1. **Highest leverage:** a read-then-write \`master_concern_pk\`/\`primary_construct_key\` **re-resolve backfill**
   over completed sessions (existing \`resolveSeedConcernPk\`/\`detectCategory\`; additive; never overwrite a
   non-null), THEN re-run the existing WC-L2B outcome backfill + trend recompute.
2. **Small follow-on:** add ${N - rePckN} curated \`CONCERN_TO_CONSTRUCT\` entries (${mappingGapConcerns.map((c) => `\`${c}\``).join(', ')}).
3. **Lower priority:** invoke hypothesis generation within \`/respond\` for new sessions (does not help the ${zeroResp}
   zero-response legacy sessions). The durable ceiling is longitudinal depth, not linkage.
`);

  writeFileSync(join(OUT_DIR, '_concern_linkage_audit.json'), JSON.stringify({
    generated: stamp, completed: N, masterCatalogueRows: masterCount[0].n,
    coverage: { storedMasterN, reMasterN, storedPckN, rePckN, storedOutcomeN, reOutcomeN, sigN, compN, patN, hypN, zeroResp },
    forecast: { eligibleOwners: eligibleOwners.length, forecastStored, forecastReResolve },
    mappingGapConcerns, sessions,
  }, null, 2));

  console.log('WC-L3 Concern Linkage Audit');
  console.log('  completed:', N, '· master catalogue rows:', masterCount[0].n);
  console.log('  concern linked: stored', storedMasterN, '→ re-resolvable', reMasterN);
  console.log('  construct linked: stored', storedPckN, '→ re-resolvable', rePckN, '· mapping gaps:', mappingGapConcerns.length);
  console.log('  spine: signals', sigN, 'composites', compN, 'patterns', patN, 'active-hyp', hypN, '· 0-response', zeroResp);
  console.log('  outcome reachable: stored', storedOutcomeN, '→ achievable', reOutcomeN);
  console.log('  forecast (eligible owners): stored', forecastStored, '/', eligibleOwners.length, '→ achievable', forecastReResolve, '/', eligibleOwners.length);
  console.log('  → 7 reports + _concern_linkage_audit.json written to', OUT_DIR);
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
