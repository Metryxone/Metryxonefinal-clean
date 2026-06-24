# Section 2 — Architecture Certification

**Verdict: PASS (architecture) — with one structural caution (sprawl).**
Architecture is certified on integrity, scalability, extensibility, and maintainability. The caution
is breadth: 1,360 tables is a large surface to operate, and a meaningful fraction is dormant.

> Architecture ≠ Outcomes. This section certifies that the platform is *built well*, not that it is
> *producing outcomes* (it is not yet — see usage axis in Section 1).

## 2.1 Data integrity — PASS
- **Canonical namespaces are disciplined.** Competency genome (`onto_*`), O*NET library (`ont_*`),
  CAPADEX runtime (`capadex_*`), workforce (`m5_*`), employer (`employer_*`/`tig_*`) are cleanly
  separated. Two competency ontologies (`onto_*` curated TEXT ids vs `ont_*` O*NET INTEGER ids) are
  **disjoint by design** and bridged only by explicit crosswalk tables — no id-space coercion.
- **Type coverage is complete** where it matters most: `onto_competency_type_map` = 419/419 (100%).
- **Append-only ledgers** are honored for history (competency profiles, EI snapshots, career history)
  — no in-place mutation of historical rows.
- **Honest emptiness.** Empty tables are genuinely empty (0), not corrupted or partially written.

## 2.2 Relationship integrity — PASS (with reachability ceilings)
- **O*NET crosswalk is dense and consistent:** 52,362 role↔competency edges over 1,021 roles × 159
  competencies. TIG graph is internally consistent (72 nodes / 1,680 edges, single org).
- **Documented disjointness is intentional, not breakage:** e.g. CAPADEX `concern_id` is disjoint
  from `concerns_master` (bridge-tag join is the supported path); `ont_` O*NET has no industry→
  competency dimension (only exact-name crosswalk is reachable). These are *reachability ceilings*,
  correctly disclosed rather than fabricated over.
- **Caution:** several user-facing graphs (cg_user_*, career_seeker_*) have **0 rows**, so their
  relationship integrity is *structurally* sound but *operationally* unexercised.

## 2.3 Dependency / flag integrity — PASS
- **Flag-gated additive discipline is real and consistently applied.** New phases ship behind
  feature flags; flag-off is designed to be byte-identical to legacy (DDL gated too). The live
  `Backend API` workflow command enables ~60 `FF_*` flags explicitly — activation is configuration,
  not code-forking.
- **Read-only / never-throws** conventions protect aggregators (null = missing, never fabricated 0).
- **Caution:** the breadth of flags (60+) is itself an operational dependency surface; flag state is
  the de-facto activation contract and must be governed (see governance section).

## 2.4 Scalability — PASS (architecture) / UNPROVEN (load)
- Schemas are indexed and the largest live table (52k crosswalk) queries cleanly. Aggregators are
  read-only with caching (60s admin cache, `?refresh=1`).
- **Honest limit:** with 2 users and 0 completed sessions, scalability is **architecturally sound but
  empirically unproven**. No load/outcome data exists to certify runtime scale.

## 2.5 Extensibility — PASS (strong)
- The additive-phase pattern (new namespace + lazy ensure-schema mirroring a migration + flag gate +
  compose-don't-recompute) is the platform's core extensibility mechanism and is applied uniformly
  across dozens of phases. New intelligence is added by *composing* already-computed data, which
  keeps prior surfaces byte-identical. This is a genuine architectural strength.

## 2.6 Maintainability — PASS (with sprawl risk)
- Strong: single-source documentation (`docs/`, `.agents/memory/`), canonical migrations + lazy
  ensure-schema, code-split admin UI behind one Suspense.
- **Risk — surface sprawl:** 1,360 tables, ~14 domains, 60+ flags, multiple overlapping ontologies
  (`onto_*`, `ont_*`, assessment bank, CAPADEX). Several subsystems are dormant or demo-only. This is
  not a defect, but it is a **maintenance and cognitive-load liability** that the simplification
  report (Section 16) addresses with KEEP/MERGE/HIDE/ARCHIVE recommendations.

## 2.7 Certification summary
| Axis | Verdict | Basis |
|---|---|---|
| Data integrity | PASS | clean namespaces, 100% type-map, append-only history, honest 0s |
| Relationship integrity | PASS | dense O*NET crosswalk, disclosed reachability ceilings |
| Dependency / flags | PASS | consistent flag-gated additive discipline |
| Scalability | PASS (arch) / UNPROVEN (load) | indexed schemas; zero usage to load-test |
| Extensibility | PASS (strong) | compose-don't-recompute additive pattern |
| Maintainability | PASS (sprawl risk) | strong docs/conventions; large dormant surface |

**Net architecture verdict: PASS.** The platform is engineered to a high, consistent standard. The
single strategic risk is breadth versus activation — addressed in Sections 16–18.
