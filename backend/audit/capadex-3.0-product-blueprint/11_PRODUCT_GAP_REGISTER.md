# 11 · Product Gap Register

Consolidated product gaps (not engineering bugs). Each: ID, gap, evidence, classification, severity. Carried
and de-duplicated from the prior 20-gap cert register, re-cut to the **product-blueprint** lens. Honest:
MISSING ≠ broken; DORMANT = built-but-OFF (not debt); null ≠ 0.

## Tier-0 — launch-critical (carried from cert; product-blocking)
| ID | Gap | Evidence | Class | Sev |
|---|---|---|---|---|
| GAP-E1 | Demo/super-admin lockout & demo-data purge before pilot | shared dev/prod DB, @example.com seed | PARTIAL | **CRITICAL** |
| GAP-E2 | Security-scan triage outstanding (SAST/deps/secrets) | security_scan skill, prior cert | PARTIAL | **CRITICAL** |
| GAP-E3 | DPDP / minor-consent compliance (K-12 + parent) | consent flow exists, compliance unverified | PARTIAL | **CRITICAL** |

## Tier-1 — close-the-loop (the systemic root theme)
| ID | Gap | Evidence | Class | Sev |
|---|---|---|---|---|
| GAP-O1 | **Realized-outcome capture absent** (D13) | MX-102X machinery present, data null | MISSING (as realized) | **HIGH** |
| GAP-K1 | **KPIs not bound to capabilities** | 09 KPI column ✗/~ | MISSING | **HIGH** |
| GAP-A4 | **Exit + Continuous assessment types absent** | 07 taxonomy | MISSING | **HIGH** |
| GAP-P1 | **Progress not systematically re-administered** | scoring_runs deltas exist, no re-run loop | PARTIAL | **HIGH** |
| GAP-P2 | **Growth→Mastery not evidence-gated** (criteria vs monetization) | 05 stage quality | PARTIAL | **MEDIUM** |

## Tier-2 — persona/journey completeness
| ID | Gap | Evidence | Class | Sev |
|---|---|---|---|---|
| GAP-J1 | Teacher/Counsellor survey dead-ends | 08 | DEAD-END | MEDIUM |
| GAP-J2 | Parent & Mentor/Coach journey tails thin | 06/08 | PARTIAL | MEDIUM |
| GAP-J3 | Faculty / L&D not first-class | 06 | PARTIAL | MEDIUM |
| GAP-S1 | Government/Healthcare/Clinical personas absent | 06 | MISSING (dedicated) | LOW (scope choice) |

## Tier-3 — terminology/documentation (from 10)
| ID | Gap | Class | Sev |
|---|---|---|---|
| GAP-T1 | CAP_INS Insight/Clarity label split (C1) | CONFLICT | MEDIUM |
| GAP-T2 | 5-vs-4 stage documentation mismatch (C2) | CONFLICT | MEDIUM |
| GAP-T3 | Outcome/Growth/Development conflation (C3) | CONFLICT | MEDIUM |

## Tier-4 — activation/maturity
| ID | Gap | Evidence | Class | Sev |
|---|---|---|---|---|
| GAP-M1 | 158/190 flags OFF — large built-but-dormant surface (D12) | flag registry | DORMANT (not debt) | INFO |
| GAP-M2 | Maturity ceiling Managed/L3 (Progression + Outcome at Guided/L2) | maturity matrix | KNOWN CEILING | INFO |
| GAP-AI1 | LLM output quality not validated (AI-inert without key) | AI services | PARTIAL | MEDIUM |
| GAP-C1 | Subscription package → entitlement gap | memory: pkg-entitlement-gap | PARTIAL | MEDIUM |

## Root-cause synthesis
> **One root theme dominates: the product's front half (assess → diagnose → recommend → report) is mature; the
> back half (re-measure → exit → realized outcome → KPI) is the systemic gap.** GAP-O1/K1/A4/P1/P2 are facets of
> the SAME close-the-loop deficiency, and they are also what caps maturity at Managed (GAP-M2). Tier-0 (E1–E3)
> are independent launch-safety gates. Everything else is completeness within already-built substrate.

**Counts:** 3 critical (Tier-0) · 5 high/medium close-the-loop · 4 persona/journey · 3 terminology · 4
activation/maturity. **No fabricated gaps; DORMANT ≠ MISSING ≠ broken kept distinct.**
