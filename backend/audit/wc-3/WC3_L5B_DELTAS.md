# WC-3 L5B — Context Intelligence — Implementation Deltas

L5B of the user-approved WC-3 design, grounded on `WC3_L5B_CONTEXT_INTELLIGENCE.md`.
Derives a **life-CONTEXT axis** per clarity question (the second axis of L5
Question Intelligence, mirroring **L5A Stage Intelligence**). Strictly additive,
flag-gated (default OFF), fully reversible, **byte-identical when the flag is OFF**,
and **never fabricates** — the large context-neutral mass is stamped `GENERAL`, not
force-tagged. No ontology / signal / concern data is modified.

---

## 1. Architecture delta

| Layer | New module | Integration point | Behaviour |
|-------|-----------|-------------------|-----------|
| L5B Context Intelligence | `backend/services/wc3/question-context-intelligence.ts` | Offline builder `scripts/wc3/build-question-context.ts` writes the sidecar; `GET /api/capadex/question-intelligence/context/metrics` reads | Pure, deterministic derivation of Primary/Secondary life-context per clarity question from a tightened, sense-disambiguated **question** lexicon, corroborated by the joined concern ontology. Never recomputes at request time. |
| Schema | `backend/services/wc3/wc3-schema.ts` → `ensureWc3QuestionContextSchema()` | lazy ensure (cached per-process), mirrors the canonical migration | Idempotent DDL; one row per clarity question. |

The clarity↔concern join is **bridge-tag only**
(`clarity.master_bridge_tag = capadex_concerns_master.relational_bridge_tag`), the
single working ontology bridge (per AQ-1: `concern_id` is disjoint). Domain is a
**booster only** — it can never tag a context on its own (prevents domain smear).

## 2. Schema delta (canonical migration `backend/migrations/20261210_wc3_l5b_question_context.sql`)

New table **`wc3_question_context`** (additive → reversible via `DROP`):

- PK `id` = the clarity row's SERIAL `id` (one context record per clarity question).
- `primary_context`, `secondary_context` — taxonomy keys (or `GENERAL` / `UNRESOLVED`).
- `context_confidence` (numeric), `context_band`
  (`HIGH_CONFIDENCE` / `MODERATE_CONFIDENCE` / `LOW_CONFIDENCE` / `UNRESOLVED` / `GENERAL`).
- `context_explicit` bool — `true` when the tag was anchored in the **question** text
  (vs inherited from the concern's `common_indian_context`).
- `relevance_risk` (`NONE` / `LOW` / `MEDIUM` / `HIGH`) — surfaces noise-prone tags.
- `coverage` (sources/3), `context_distribution` jsonb, `signals_used` jsonb, `computed_at`.
- 3 indexes (`primary_context`, `context_band`, `relevance_risk`).

No existing table is touched.

## 3. Taxonomy & derivation algorithm (pure `deriveQuestionContext`)

**Taxonomy:** 10 Tier-1 contexts (PLACEMENT_ANXIETY, COMPETITIVE_EXAM_PRESSURE,
CAREER_CLARITY, CAREER_TRANSITION, FAMILY_PRESSURE, FINANCIAL_PRESSURE,
HIGHER_EDUCATION_CHOICE, EMPLOYABILITY, WORKPLACE_ADJUSTMENT, LEADERSHIP) + 6 Tier-2
(PEER_SOCIAL_COMPARISON, DIGITAL_BEHAVIOUR, AI_FUTURE_OF_WORK, RELOCATION_MIGRATION,
IDENTITY_BELONGING, ENTREPRENEURSHIP) + the reserved `GENERAL` / `UNRESOLVED` keys.

**Sense-disambiguation:** lexicons are tight and exclusion-guarded — e.g. LEADERSHIP
excludes the connective "lead to / leads to / leading to"; DIGITAL uses a tight
phrase set; noise-prone tags (LEADERSHIP, DIGITAL_BEHAVIOUR) carry `relevance_risk`.

**Scoring per candidate context:** `W_QUESTION 0.6` (question/clarity-concern text,
explicit) + `W_CONCERN 0.3` (inherited from the bridge tag's sparse, genuine
`common_indian_context`) + `W_DOMAIN 0.1` (booster — never tags or breaks ties alone),
capped at 1.

**Two-stage resolution (keeps UNRESOLVED meaningful, avoids bridge-tag smear):**
1. **Explicit first.** If ≥1 question-anchored context fired, it decides the tag. A
   genuine score tie between two explicit contexts → `UNRESOLVED` **regardless of tier**
   (the Tier-1-before-Tier-2 order never fabricates a primary under genuine ambiguity).
2. **Clean inherited fallback.** Only when NO explicit context fired do we consider
   inherited (`common_indian_context`) contexts, and tag **only when exactly one**
   inherited context matches. Inherited multi-match is bridge-tag aggregation smear,
   not genuine ambiguity → **`GENERAL` (untagged)**, never a fabricated primary or
   false tie.
3. No candidate at all → `GENERAL`.

> ⚠️ Design correction during build: corroboration text was first taken as
> `string_agg(display_label + concern_search + common_indian_context)` per bridge tag.
> Because one tag aggregates many concerns, that blob matched many lexicons at once
> and manufactured **7,797 false UNRESOLVED ties (25%)** — the exact "ambient smear"
> the audit warned about. Restricting corroboration to the sparse `common_indian_context`
> and adding the explicit-first two-stage resolver collapsed UNRESOLVED to **74 (0.24%)**,
> in line with the audit's ~1% genuine cross-context overlap.

## 4. Builder delta (`backend/scripts/wc3/build-question-context.ts`)

Own `pg.Pool`; calls `buildQuestionContextIntelligence` (ensure-schema → load the
bridge map in one query → derive per clarity row → bulk upsert into
`wc3_question_context`). Idempotent (re-run overwrites by `id`). Prints the full
validation metrics block. Run from inside `backend/` (else `pg` MODULE_NOT_FOUND).

## 5. Route delta (`backend/routes/capadex.ts`)

`GET /api/capadex/question-intelligence/context/metrics`, registered as a literal
sub-path before the session `/:id` handlers:
- flag OFF → `{ ok:true, enabled:false }` (byte-identical legacy).
- flag ON + sidecar not built / read failure → `{ ok:true, enabled:true,
  degraded:true, reason:'no_context_index' }`. Never 500s.
- flag ON + built → `{ ok:true, enabled:true, metrics }` (read-only aggregate via
  `getContextMetrics`; `?top=N` bounds the lowest-coverage backlog, 1–20, default 10).

## 6. Feature flag delta (`backend/config/feature-flags.ts`)

Added `wc3ContextIntel: false` (env `FF_WC3_CONTEXT_INTEL`) + `isWc3ContextIntelEnabled()`.
Default OFF.

## 7. Validation (build metrics + HTTP OFF/ON smoke)

**Builder over the full clarity pool (`30,638` rows, all written):**

| Metric | Value | Reading |
|--------|-------|---------|
| GENERAL (context-neutral) | 22,581 (73.7%) | honest neutral mass (≈ audit's ~80%); never force-tagged |
| Resolved (coverage) | 7,950 (25.9%) | tagged to a real context |
| Explicit (question-anchored) | 5,088 | `context_explicit=true` |
| UNRESOLVED (genuine question ambiguity) | 107 (0.35%) | ≈ audit's ~1% cross-context overlap (incl. cross-tier explicit ties) |
| Relevance risk HIGH | 335 | LEADERSHIP/DIGITAL noise made visible (not hidden) |
| Mean confidence (resolved) | ~0.55 | — |
| QIS context delta | ~1.4 | bounded by the large neutral mass (context weight 0.10) |

**Deterministic engine test matrix** (`deriveQuestionContext`, throwaway harness, 8/8
pass): no-match → GENERAL · single explicit → tagged+explicit · cross-tier explicit tie
→ UNRESOLVED · inherited single → tagged+`explicit=false` · inherited multi → GENERAL ·
domain-only → GENERAL · deterministic (same input twice identical) · "lead to"
connective excluded from LEADERSHIP.

Largest resolved contexts: LEADERSHIP 2,498 · CAREER_CLARITY 1,314 · PLACEMENT_ANXIETY
677 · DIGITAL_BEHAVIOUR 594 · COMPETITIVE_EXAM_PRESSURE 571.

**HTTP smoke:**
- OFF (live backend, flag unset): `GET …/context/metrics` → `{"ok":true,"enabled":false}`.
- ON (one-off instance, `FF_WC3_CONTEXT_INTEL=1`, port 8090): `{"ok":true,"enabled":true,
  "metrics":{…}}` — full coverage/band/relevance-risk payload returned; instance killed
  after the smoke.

## 8. Reversibility

- Flag OFF (default) → route returns `enabled:false`; the engine module is never
  imported on that path. **Byte-identical legacy behaviour.**
- Full removal: `DROP TABLE wc3_question_context;` (no residue in existing tables).
  Migration + ensure-schema are the single source; the migration header documents the
  reverse.

## 9. Post-review fixes (architect)

Architect review (`includeGitDiff`) flagged two honesty/contract issues, both fixed:
1. **Degraded contract** — `getContextMetrics` no longer calls ensure-schema (which would
   auto-create the table and mask "not built" as zeroed metrics). It now checks
   `to_regclass` + non-empty count and returns `null` when absent/empty, so the route
   emits `{degraded:true, reason:'no_context_index'}`.
2. **Ambiguity honesty** — the explicit-tie test no longer requires same tier; any genuine
   explicit score tie → `UNRESOLVED` (cross-tier ties no longer fabricate a primary).
   UNRESOLVED moved 74 → 107 (still 0.35%).

## 10. NOT done (per scope — STOP for approval)

- Not deployed. No frontend changes. No ontology/signal/concern changes.
- L5C+ axes / consumption of the context axis in the live picker: not started.
- `proposeFollowUpTasks` NOT called (already consumed for an earlier task).
