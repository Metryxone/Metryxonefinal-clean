# P-X1 · Deliverable 6 — Priority Sequencing
_Generated 2026-06-10T14:38:00.263Z_

## Ranking Methodology
Capabilities are ranked by: **Impact** (coverage uplift × products affected) ÷ **Effort** (engineering days),
with three additional flags:
- 🔐 **Security blocker** — must complete before anything else
- 🔗 **Dependency enabler** — other capabilities depend on this
- ⚡ **Quick win** — ≤1 day, immediate measurable effect

---

## Tier 1: Immediate (Week 1) — Security + Foundation

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 1 | **S10.1: LBI auth hardening** (5 unauth routes → requireAuth + requireSuperAdmin) | LBI | 0.5 days | Security blocker removed | 🔐 ⚡ |
| 2 | **S10.2: CB route auth backfill** (requireAuth on user-data routes + IDOR guard) | CB | 0.5 days | Security blocker removed | 🔐 ⚡ |
| 3 | **S10.3: Config actions** (SESSION_SECRET, FF flags in production) | ALL | Owner, <1h | P0 launch blocker removed | 🔐 ⚡ |
| 4 | **S9.LBI.partial: LBI report tables** (create 2 missing tables + AI guard) | LBI | 1 day | D05 Report 20%→40% | ⚡ |
| 5 | **S8.LBI: calculateLBI trigger** (post-completion hook item) | LBI | 1 day | D03 Scoring 0%→15% confidence | ⚡ 🔗 |

**Tier 1 output**: Security blockers resolved. LBI can safely recalculate scores. CAPADEX sessions now generate LBI scores automatically. ~2 days total.

---

## Tier 2: High Priority (Week 2–3) — Snapshot + Persistence

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 6 | **S1.EI: EI snapshot cron trigger** (call takeSnapshot daily / post-compute) | EI | 1 day | D10 Longitudinal 15%→35% | 🔗 |
| 7 | **S2.LBI: lbi_score_history table** (INSERT model) | LBI | 1 day | D08 Longitudinal 0%→20% | 🔗 |
| 8 | **S1+S2.CB: DB-backed career-memory** (wire to career_memory_snapshots) | CB | 2 days | D07 Longitudinal 15%→40% | 🔗 |
| 9 | **S4.CB: career_recommendations bridge** (user_id keying + adapter activation) | CB | 2 days | D03 Recommendations 35%→50% | |
| 10 | **S8.EI: per-user EI score persistence** (store score post-compute) | EI | 1 day | Enables S5, S6, S7 for EI | 🔗 |

**Tier 2 output**: All three products have a snapshot/history layer. Cross-product identity resolved. ~7 days total.

---

## Tier 3: Intelligence Activation (Week 3–4)

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 11 | **S6.EI+LBI: wcl0 consumer APIs** (read wcl0_user_intelligence in EI + LBI scoring paths) | EI, LBI | 2 days | D09 Pers. EI 30%→55%; LBI D07 30%→48% | |
| 12 | **S5: Personalization wire-up** (EI band-by-segment; LBI age-band from wcl0) | EI, LBI | 2 days | Confidence uplift in D09 | |
| 13 | **S5.CB: Personalization depth** (all tabs receive full behaviour context) | CB | 1 day | D09 Personalization 55%→70% | |
| 14 | **S3: Enable trend flags** (trendIntelligence + longitudinalAutomation in workflow) | ALL | 0.5 days | Trend computations activate | ⚡ |
| 15 | **S7.EI: EI memory surface** (WC-L5 retrieval → EI history panel) | EI | 1 day | D08 Reporting improvement | |
| 16 | **S7.CB: CB memory surface** (career_behavioural_memory + WC-L5 → progressLedger) | CB | 1.5 days | D07 Longitudinal 40%→65% | |

**Tier 3 output**: Personalization is live. Trend flags on. Memory surfaces visible. ~8 days total.

---

## Tier 4: Report Integrity (Week 4–5) — Can run partly parallel to Tier 2/3

| # | Capability | Products | Effort | Impact | Flags |
|---|---|---|---|---|---|
| 17 | **S9.EI: Formula reconciliation** (unify 6-dim + 8-dim; competency→gauge wire) | EI | 3 days | D04 65%→80%, D03 20%→45%, GAP-1 closed | 🔐 CRITICAL |
| 18 | **S9.LBI: Report seed + AI guard** (seed report types; guard AI fabrication) | LBI | 2 days | D05 20%→55% | |
| 19 | **S9.CB: Career report surface** (dedicated per-user career report) | CB | 3 days | D08 35%→60% | |

**Tier 4 output**: Report integrity closed for EI (CRITICAL) and LBI. CB has a report product. ~8 days total.

---

## Product-Specific Actions NOT in Shared Capabilities

These gaps are blocking but have no shared-platform equivalent — they require product-specific investment:

| Product | Gap | Effort | Impact |
|---|---|---|---|
| EI | Occupation graph expansion (30 → 300+) | Owner data action | D05/D07 Career Routing |
| LBI | Framework seeding (19 domains, 3 age bands, questions) | 3–5 days content + eng | D01 Framework 5%→75% |
| LBI | System B domain seeding (conceptual alignment decision first) | 5–7 days | D04 Learning Pattern |
| CB | Job postings supply (0 postings → employer pipeline) | Market/BD action | Jobs tab activation |
| CB | Mentor profiles supply (0 mentors → mentor recruitment) | Market/BD action | Mentors tab activation |

---

## Shortest Path to 70% Readiness

The 70% threshold requires shared capabilities (Tiers 1–4) PLUS the product-specific actions above.
Engineering work alone reaches: EI ~49%, LBI ~50%, CB ~53%.

### To push EI to 70%: (after Tier 1–4 completes)
1. Occupation data expansion → D05 25%→60%, D07 20%→60%
2. Real assessment completions (user volume)
3. Estimated: **3–4 additional product sprints** after Tier 4

### To push LBI to 70%: (after Tier 1–4 completes)
1. **Framework seeding — G1** (single largest gap): 19 domains, age bands, questionnaires
2. Real LBI sessions flowing
3. Estimated: **1–2 additional product sprints** after Tier 4 (LBI has the clearest path)

### To push CB to 70%: (after Tier 1–4 completes)
1. Job postings supply (market action)
2. Mentor profiles supply (market action)
3. Estimated: **Depends on market execution, not engineering**

---

## Cross-Product Impact Score (by capability, evidence-grounded)

| Rank | Capability | Products impacted | Dims unblocked | Eng days | Score |
|---|---|---|---|---|---|
| 1 | S10 Auth Hardening | 3 | 4 | 2 | **2.0** |
| 2 | S8 Identity Resolution | 3 | 6 | 3 | **2.0** |
| 3 | S6 User Intelligence Store | 2+1partial | 4 | 2 | **2.0** |
| 4 | S3 Trend Engine | 3 | 3 | 1 | **3.0** (low effort) |
| 5 | S5 Personalization Consumption | 3 | 3 | 3 | **1.0** |
| 6 | S1 Snapshot Framework | 3 | 3 | 3 | **1.0** |
| 7 | S2 Longitudinal Persistence | 3 | 3 | 3 | **1.0** |
| 8 | S7 Memory Layer | 3 | 3 | 3 | **1.0** |
| 9 | S4 Recommendation Persistence | 3 | 3 | 4 | **0.75** |
| 10 | S9 Report Integrity | 3 | 3 | 6+ | **0.5** |

**Top single action by score**: Enable trend flags in workflow (~30 minutes, S3 step 14 above).  
**Top multi-product unlock**: S8 Identity Hook (LBI scoring fires, EI stores per-user score, CB bridge activates) — 1 day of work.  
**Highest-ROI product-specific action**: LBI G1 framework seeding (~3 days, D01 from 5% to 75%).
