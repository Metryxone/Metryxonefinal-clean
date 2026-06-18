# WC-P2 — D02: Concern Intelligence Readiness
Generated: 2026-06-10T13:48:42.822Z

## Verdict: ✅ STRUCTURAL (via CAPADEX) / ❌ NOT WIRED TO LBI FRAMEWORK

LBI has no dedicated concern intelligence layer. Concern mapping exists in the CAPADEX
system (capadex_concerns_master, ~2,489 rows) but is not referenced by any LBI route or
calculation. System A derives LBI from CAPADEX session metadata only — not from
concern-level intelligence.

## CAPADEX Concern Bridge (System A)

The CAPADEX engine in lbi-engine.ts uses concern data indirectly:
- **concern_name** field from capadex_sessions → used for persistence scoring (revisit counting)
- **stage_code** (CAP_CUR/CAP_INS/CAP_GRW/CAP_MAS) → used for adaptability scoring
- No semantic concern classification applied
- No concern severity or domain weighting

## CAPADEX Session Basis
- Total CAPADEX sessions: 27
- Unique users: 5
- Completed sessions: 9
- Users scoreable by System A: 5 (if calculateLBI() called)
- Users actually scored: 0 (lbi_scores rows)

## System B Concern Architecture
The Psychometric Framework (System B) has no explicit "concern" layer — the architecture
uses **domains → subdomains → questions** as the assessment spine. There is no
concern-level routing or concern intelligence engine in the LBI framework.

## Gap Assessment
| Dimension | State | Impact |
|-----------|-------|--------|
| Concern-to-domain mapping | Not defined | Cannot cross-reference CAPADEX concerns with LBI domains |
| Domain concern weighting | No scoring rules | No formula for deriving concern severity from domain scores |
| Concern intelligence API | None | No `/api/lbi/concerns` or equivalent |
| CAPADEX↔LBI bridge | Not implemented | Two separate assessment systems, no data handoff |

## Finding
Concern intelligence is absent as a defined LBI capability. The closest proxy is
CAPADEX session concern names used for persistence counting in System A — this is
a very thin proxy, not a genuine concern intelligence layer.
