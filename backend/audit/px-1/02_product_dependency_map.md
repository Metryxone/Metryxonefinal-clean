# P-X1 · Deliverable 2 — Product Dependency Map
_Generated 2026-06-10T14:38:00.263Z_

## How to Read This Map
- **→** = "must be resolved before": the capability named on the left MUST exist before the target on the right can fire.
- **[CAPADEX-only]** = capability exists for CAPADEX but is not consumed by the named product.
- Readiness percentages are from published audit scorecards (WC-P1/P2/P3).

---

## Dependency Chain — Full Platform View

```
PLATFORM FOUNDATION
│
├── S10: Auth & Security Hardening  ← PREREQUISITE for all products
│    Must pass before: LBI admin recalculate-all (G2 depends on G5)
│    Must pass before: CB protected routes (IDOR risk)
│    Config gate: SESSION_SECRET + FF flags (all products)
│
├── S8: Product-to-User Identity Resolution
│    Must pass before: S4 (recs need user_id), S5 (personalization needs user_id),
│                      S6 (intelligence store link needs user_id)
│    Key bridge: capadex_session.user_id → career_seeker_profiles.user_id
│
├── S9: Report Data Integrity   (product-specific but blocks confidence entirely)
│    EI: formula reconciliation → blocks D04/D08 confidence (currently 40%/55%)
│    LBI: missing tables + AI guard → blocks D05 confidence (currently 0%)
│    CB: report surface → improves D08 (currently 20%)
│
├── S1: Snapshot Framework
│    Must pass before: S2, S3, S5 (personalization quality), S7 (memory)
│    CAPADEX reference: WC-L5 post-completion hook → wcl5_memory (94 rows, READY)
│    EI gap: takeSnapshot() fn exists, no trigger → ei_snapshot_versions = 0
│    LBI gap: no concept → lbi_scores UPSERT (overwrites, no history)
│    CB gap: career_memory_snapshots = 0 rows
│
├── S2: Longitudinal Persistence
│    Depends on: S1 (snapshot schema)
│    Must pass before: S3 (trend engine needs ≥2 history points)
│    EI gap: no cron / post-computation trigger
│    LBI gap: lbi_score_history = TABLE ABSENT
│    CB gap: career-memory.ts uses in-memory Map (not DB)
│
├── S3: Trend Engine
│    Depends on: S1 + S2 (need ≥2 history snapshots per user)
│    CAPADEX reference: WC-L1 trend engine real; trendIntelligence flag OFF (data-starved)
│    Honest ceiling: 2 users have ≥2 sessions (WC-L1B). Any trend today is low-confidence.
│
├── S6: User Intelligence Store (consumer APIs)
│    Pre-built: wcl0_user_intelligence = 9 rows (CAPADEX users only)
│    EI gap: no API consumer endpoint linking EI computation to wcl0_user_intelligence
│    LBI gap: no API consumer endpoint; blocks S8 (LBI scoring trigger needs user context)
│
├── S5: Personalization Consumption Layer
│    Depends on: S6 (intelligence store must be queryable per product)
│    Depends on: S8 (user_id must resolve across products)
│    EI gap: band label split + no store link → D09 30%/25%
│    LBI gap: all inputs missing → D07 30%/0%
│    CB gap: partially wired → D09 55%/25% (degrades gracefully)
│
├── S4: Recommendation Persistence
│    Depends on: S8 (user_id key for persistence)
│    EI: ref_review_queue = 69 (not user-keyed)
│    LBI: no persistence engine
│    CB: career_recommendations user_id col = ABSENT; bridge inactive
│    CAPADEX reference: capadex_intervention_recommendations = 73 rows (READY)
│
└── S7: Memory Consumption Layer
     Depends on: S1 + S2 (needs historical snapshots as memory source)
     CAPADEX reference: wcl5_memory = 94 rows, 7/7 types (READY)
     EI gap: no memory concept (absent entirely)
     LBI gap: no memory concept (absent entirely)
     CB gap: career_behavioural_memory = -1 rows; not driving product UI
```

---

## Per-Product Dependency Map

### EI (Employability Index) — Coverage 32% / Confidence 23%

Critical path to unblock:
```
S10 Auth (commercial guard)
  → S8 Identity (stored per-user EI score)
    → S9 Report Integrity (formula unification: GAP-1 CRITICAL)
      → S1 Snapshot (takeSnapshot trigger / cron)
        → S2 Longitudinal (history table)
          → S3 Trend (EI velocity)
            → S5 Personalization (from wcl0_user_intelligence)
```

Parallel (no dependencies on above):
- S6 (connect EI computation to wcl0_user_intelligence read API)
- S4 (user-keyed EI improvement recommendations)

### LBI (Learning Behavior Index) — Coverage 25% / Confidence 0%

Critical path to unblock:
```
S10 Auth (MUST FIRST — G5: 5 unauth routes expose all users)
  → S8 Identity (trigger calculateLBI() after CAPADEX completion — G2 QUICK WIN)
    → S9 Report Integrity (create lbi_report_types + lbi_subdomain_report_map — G3)
      → S6 User Intelligence (connect CAPADEX behaviour to LBI framework)
        → S1+S2 Snapshot (lbi_score_history table — G4)
          → S3 Trend (LBI learning trajectory)
            → S5 Personalization (age-band + behaviour from wcl0)
```

Parallel (no dependencies on above):
- LBI framework seeding (19 domains, age bands — G1 PRODUCT-SPECIFIC, not shared)

### Career Builder — Coverage 37% / Confidence 17%

Critical path to unblock:
```
S10 Auth (requireAuth on 12 unauth routes — CB-specific)
  → S8 Identity (career-behavior-adapter trigger on session completion)
    → S4 Recommendation Persistence (user_id column + bridge activation)
      → S1+S2 Snapshot (DB-backed career-memory snapshots)
        → S7 Memory (career_behavioural_memory → progressLedger feed)
          → S3 Trend (career progress trajectory)
            → S5 Personalization (from wcl0_user_intelligence)
```

Parallel (no dependencies on above):
- S9 Report (dedicated career report surface)
- S6 (career-behavior-adapter already partial — wire wcl0 read fully)

---

## Cross-Product Critical Path (shortest path to simultaneous lift)

The three capabilities that unblock the most product dimensions simultaneously, in order:

1. **S10 Auth** — must precede G2 (LBI) and CB route fixes. Config-only: SESSION_SECRET + FF flags. Code: requireAuth additions.
2. **S8 Identity + post-completion hook** — feeds LBI scoring (G2), career-behavior-adapter, EI stored score. Single hook, three products benefit.
3. **S1+S2 Snapshot + Persistence** — same pattern (CAPADEX WC-L5) adapted for EI (cron trigger), LBI (history table), CB (DB-backed career-memory). Unblocks the entire longitudinal chain for all three.
