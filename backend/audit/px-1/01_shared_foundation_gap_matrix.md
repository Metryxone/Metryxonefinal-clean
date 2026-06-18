# P-X1 · Deliverable 1 — Shared Foundation Gap Matrix
_Generated 2026-06-10T14:38:00.263Z_
_READ-ONLY · AUDIT ONLY · STOP FOR APPROVAL_

## Method
Each cell reports whether the gap exists in that product on two axes:
- **Structural**: does the code / schema / route exist?
- **Activation**: is it producing real data outputs?

Gaps are grounded in measured audit scores (WC-P1/P2/P3) and live DB probes.

---

## DB State (live probe 2026-06-10T14:38:00.263Z)

| Table | Rows / Exists |
|---|---|
| `career_seeker_profiles` | 2 rows |
| `capadex_sessions` (total / completed) | 27 / 9 |
| `ei_snapshot_versions` | 0 rows |
| `career_memory_snapshots` | 0 rows |
| `wcl5_memory` | 94 rows (7 distinct types) |
| `wcl0_user_intelligence` | 9 rows |
| `wc3_outcome_state` | 14 rows |
| `wc3_journey_state` | 9 rows |
| `wc3_stage_state` | 9 rows |
| `wc7b_decision_state` | 9 rows |
| `lbi_scores` | 0 rows |
| `lbi_score_history` | ❌ TABLE ABSENT |
| `lbi_report_types` | ❌ TABLE ABSENT |
| `lbi_subdomain_report_map` | ❌ TABLE ABSENT |
| `career_recommendations` | 24 rows (user_id col: ❌) |
| `capadex_intervention_recommendations` | 73 rows |
| `intervention_library` | 140 rows |
| `career_behavioural_memory` | -1 rows |
| `capadex_reports` | 39 rows |
| `subscription_packages` | 13 rows |
| `student_subscriptions` | 0 rows |
| `capadex_payments` | 6 rows |
| `wc7c_*` tables | 0 tables exist |
| `behavioural_hypotheses` | 0 rows |
| `capadex_session_patterns` | 6 rows |

---

## Capability 1 — Snapshot Framework

> Does a product have an AUTOMATED snapshot written to a DB table at the end of each session/computation cycle?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** (Employability Index) | ⚠️ PARTIAL | ❌ ZERO | `takeSnapshot()` fn exists in `ei-engine.ts`; `ei_snapshot_versions`=0 rows. No cron, no hook trigger. |
| **LBI** | ❌ ABSENT | ❌ ZERO | No snapshot concept in `lbi-engine.ts`. `lbi_scores` is a single-row UPSERT (overwrites prior score). |
| **Career Builder** | ⚠️ PARTIAL | ❌ ZERO | `career_memory_snapshots` = 0 rows. `career-memory.ts` uses in-memory Map (not DB). |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | `wcl5_memory`=94 rows (WC-L5 post-completion hook). Pattern is the reuse model. |

**Products blocked**: EI, LBI, Career Builder  
**Shared root cause**: No post-computation snapshot trigger. CAPADEX (WC-L5) already implements the pattern.

---

## Capability 2 — Longitudinal Persistence

> Does the product write historical records (not overwrites) so trends can be computed later?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ⚠️ PARTIAL | ❌ ZERO | `ei_snapshot_versions`=0. WC-P1 D10 Longitudinal: **15% / 10%** (CRITICAL). No history table. |
| **LBI** | ❌ ABSENT | ❌ ZERO | `lbi_score_history` = **TABLE ABSENT**. `lbi_scores` UPSERT overwrites. WC-P2 D08 Longitudinal: **0% / 0%**. |
| **Career Builder** | ❌ ABSENT | ❌ ZERO | `career_memory_snapshots`=0 rows (empty). WC-P3 D07 Longitudinal: **15% / 5%**. |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | `wc3_stage_state`=9, `wc3_outcome_state`=14, `wc7b_decision_state`=9. History-per-session model. |

**Products blocked**: EI, LBI, Career Builder  
**Impact**: Without history, no trend is possible regardless of trend-engine quality.

---

## Capability 3 — Trend Engine

> Can the platform compute a per-user trend line from longitudinal data?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ ABSENT | ❌ ZERO | No EI-specific trend engine. No input data (0 snapshots). |
| **LBI** | ❌ ABSENT | ❌ ZERO | No LBI trend engine. No history table. |
| **Career Builder** | ⚠️ PARTIAL | ❌ ZERO | `progressLedger` pure fn in useCareerBrain; returns null on 0 snapshots. |
| **CAPADEX** (reference) | ✅ REAL | ⚠️ DATA-STARVED | WC-L1 trend engine real. `trendIntelligence` flag OFF in workflow. 2/9 users trend-eligible. |

**Products blocked**: EI, LBI, Career Builder  
**Shared root cause**: Trend computation blocked by Capabilities 1+2 (no snapshots). CAPADEX WC-L1 engine can be adapted as the shared trend primitive.

---

## Capability 4 — Recommendation Persistence

> Are product recommendations written to a DB table keyed by user_id (not session)?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ⚠️ PARTIAL | ❌ INACTIVE | `ref_review_queue`=69 rows (69 unresolved). Not user-keyed. |
| **LBI** | ❌ ABSENT | ❌ ZERO | `generateInsights()` returns hardcoded 4-band text. No persistence. WC-P2 D06 Recs: **15% / 0%**. |
| **Career Builder** | ⚠️ PARTIAL | ❌ INACTIVE | `career_recommendations`=24 rows; user_id column: ❌ absent (session-keyed only). Bridge exists but inactive. |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | `capadex_intervention_recommendations`=73 rows. `intervention_library`=140 rows. Career-behavior-adapter bridge available. |

**Products blocked**: EI, LBI, Career Builder  
**Shared root cause**: No unified user-keyed recommendation write path. CAPADEX recommendation engine already supports user-level persistence.

---

## Capability 5 — Personalization Consumption Layer

> Does the product read from the platform's user intelligence store (`wcl0_user_intelligence`) to personalise content?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ ABSENT | ❌ ZERO | No connection to `wcl0_user_intelligence`. Band label split (6-dim vs 8-dim). WC-P1 D09 Personalization: **30% / 25%**. |
| **LBI** | ❌ ABSENT | ❌ ZERO | All inputs missing. WC-P2 D07 Personalization: **30% / 0%**. |
| **Career Builder** | ⚠️ PARTIAL | ⚠️ DATA-STARVED | `useCareerBrain` calls `/api/career/behavior-profile/:userId`. `wcl0_user_intelligence`=9 rows (CAPADEX-sourced). Degrades gracefully. WC-P3 D09 Personalization: **55% / 25%**. |
| **CAPADEX** (reference) | ✅ REAL | ⚠️ CEILING | WC-L0E: Personalization readiness 77.8%. `wcl0_user_intelligence` built. Ceiling = 2/9 zero-response sessions. |

**Products blocked**: EI (absent), LBI (absent), CB (partial, data-starved)  
**Shared root cause**: `wcl0_user_intelligence` built but not consumed by EI or LBI product layers.

---

## Capability 6 — User Intelligence Store

> Is there a persistent, queryable user intelligence store that aggregates persona + behaviour + segment across products?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ NO LINK | ❌ ZERO | No read path from EI engine to `wcl0_user_intelligence`. |
| **LBI** | ❌ NO LINK | ❌ ZERO | No read path from LBI engine to `wcl0_user_intelligence`. |
| **Career Builder** | ⚠️ PARTIAL | ⚠️ DATA-STARVED | `career-behavior-adapter` bridges via `user_id`. |
| **Platform (CAPADEX)** | ✅ REAL | ✅ ACTIVE | `wcl0_user_intelligence`=9 rows. Persona 100% coverage, behaviour 22.2%, snapshot 100%. |

**Products blocked**: EI (completely disconnected), LBI (completely disconnected)  
**Shared root cause**: The store is built for CAPADEX users. EI and LBI have no API consumer endpoint pointing to it.

---

## Capability 7 — Memory Consumption Layer

> Is there a cross-session memory layer that persists intelligence between sessions and surfaces it in the product?

| Product | Structural | Activation | Evidence |
|---|---|---|---|
| **EI** | ❌ ABSENT | ❌ ZERO | No memory concept in EI product. |
| **LBI** | ❌ ABSENT | ❌ ZERO | No memory concept in LBI product. |
| **Career Builder** | ⚠️ PARTIAL | ❌ INACTIVE | `career-memory.ts` in-memory Map. `career_behavioural_memory`=-1 rows. DB tables exist but not driving product. |
| **CAPADEX** (reference) | ✅ REAL | ✅ ACTIVE | `wcl5_memory`=94 rows, 7/7 types. 100% of completed sessions. Retrieval engine ready. |

**Products blocked**: EI, LBI, Career Builder (inactive)  
**Shared root cause**: WC-L5 memory layer is fully operational for CAPADEX. No adapter surfaces it to EI or CB product layers.

---

## Capability 8 — Product-to-User Identity Resolution

> Is there a reliable mapping that connects a CAPADEX session to an EI computation to a Career Builder profile for the same user?

| Bridge | Exists | Rows | Gap |
|---|---|---|---|
| CAPADEX session → user_id | ✅ | 27 sessions | user_id NULL for anonymous (4/9) |
| user_id → career_seeker_profiles | ✅ | 2 profiles with user_id | Only 2 profiles total |
| career_seeker_profiles → EI score | ❌ ABSENT | — | EI computed at query time, not stored per-user |
| career_seeker_profiles → LBI score | ⚠️ PARTIAL | 0 lbi_scores | 0 rows — engine never called |
| CAPADEX → Career Builder bridge | ⚠️ PARTIAL | — | `career-behavior-adapter` exists; data-starved |
| CAPADEX → LBI bridge | ❌ ABSENT | — | G2 gap: calculateLBI() never called after completion |

**Products blocked**: LBI (G2, zero scores), CB (bridge inactive), EI (no stored per-user score)  
**Shared root cause**: No post-completion hook that (a) resolves cross-product identity, (b) triggers EI/LBI/CB score writes.

---

## Capability 9 — Report Data Integrity

> Do product reports derive scores from a single source of truth with no formula divergence?

| Product | Gap | Severity | Evidence |
|---|---|---|---|
| **EI** | **3 divergent formulas** (6-dim live vs 8-dim documented vs hybrid). Gauge ≠ Modal score. | **CRITICAL** | WC-P1 GAP-1. `ei_calculation_logs`=200 — all using 6-dim formula. |
| **LBI** | 2 tables missing (`lbi_report_types`, `lbi_subdomain_report_map`). AI report fabricates 60–95 hardcoded range. | **CRITICAL** | WC-P2 G3. Tables: lbi_report_types=**ABSENT**, lbi_subdomain_report_map=**ABSENT**. |
| **Career Builder** | No dedicated career report surface. Intelligence threads to tabs but no per-user career report. | MEDIUM | WC-P3 D08 Report: 35% / 20%. |
| **CAPADEX** (reference) | ✅ CLEAN | — | `capadex_reports`=39. Single source, 39 reports. |

**Products blocked**: EI (credibility), LBI (data integrity), CB (product completeness)

---

## Capability 10 — Product Auth & Security Hardening

| Gap | Products affected | WC-C8A status |
|---|---|---|
| SESSION_SECRET unset in production | ALL | ⚠️ Config fix pending (owner action) |
| FF_* flags OFF in production | ALL | ⚠️ Config fix pending (owner action) |
| LBI admin routes unauthenticated (5 routes) | LBI | ❌ Unresolved (WC-P2 G5) |
| CB routes missing requireAuth (12/15 with user data) | Career Builder | ❌ Unresolved |
| EI commercial guard absent | EI | ❌ Not implemented |
| OTPs stored plaintext | CAPADEX | ⚠️ Documented, not fixed |

**Products blocked**: All products for production launch. LBI and CB have code-level gaps.  
**Note**: WC-C8A resolved security headers, OTP attempt cap, seed-demo guard, MFA handlers. The remaining items above are **code-level** (LBI/CB routes) or **config-level** (owner actions).

---

## Summary Matrix

| Capability | EI Gap | LBI Gap | CB Gap | Products blocked | Shared fix exists? |
|---|---|---|---|---|---|
| 1. Snapshot Framework | 0 rows | No concept | Table absent | 3 | ✅ WC-L5 pattern |
| 2. Longitudinal Persistence | 0 rows | No history table | 0 rows | 3 | ✅ Post-hook pattern |
| 3. Trend Engine | No engine | No engine | Pure fn, 0 data | 3 | ✅ WC-L1 adaptable |
| 4. Recommendation Persistence | Not user-keyed | Static text | Session-keyed | 3 | ✅ Career-behavior-adapter |
| 5. Personalization Layer | Disconnected | Disconnected | Partial | 3 | ✅ wcl0_user_intelligence |
| 6. User Intelligence Store | No link | No link | Partial | 2 full + 1 partial | ✅ Built (WC-L0) |
| 7. Memory Layer | Absent | Absent | Inactive | 3 | ✅ WC-L5 retrieval engine |
| 8. Identity Resolution | No stored score | Never called | Data-starved | 3 | ⚠️ Bridge exists, needs trigger |
| 9. Report Data Integrity | Formula split | Tables missing | No report surface | 3 | ❌ Product-specific fixes |
| 10. Auth & Security | Commercial guard | 5 unauth routes | 12 unauth routes | 3 | ⚠️ Pattern exists (requireAuth) |
