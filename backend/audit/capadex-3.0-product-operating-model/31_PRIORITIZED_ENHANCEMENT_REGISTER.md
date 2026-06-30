# 31 · Prioritized Enhancement Register

Repository-evidence-based prioritization of the 19 gaps. All enhancement-only (strengthen what exists, reuse
before build). Effort is relative (S/M/L), grounded in "machinery exists → wire it" vs "net-new".

## Tier 0 — Launch-Critical (must clear before ANY public launch; not product-maturity)
| Prio | Gap | Action (reuse-first) | Effort |
|---|---|---|---|
| 0.1 | GAP-E1 | Enforce production demo-mode lockout; @example.com purge gate before prod traffic | S |
| 0.2 | GAP-E2 | Run + triage security scan (security_scan/threat_modeling skills already exist) | M |
| 0.3 | GAP-E3 | Verify DPDP + minor-consent completeness against existing consent flows | M |

## Tier 1 — Maturity-defining (Managed → Intelligent; the "close the loop" theme)
| Prio | Gap | Action (reuse-first) | Effort |
|---|---|---|---|
| 1.1 | GAP-P1 + GAP-A4 | Close growth loop: re-administer existing assessments at **exit + interval**; persist delta | M |
| 1.2 | GAP-O1 | Instrument realized-outcome + recommendation-effectiveness capture (reuse MX-102X composer, outcome models) | M-L |
| 1.3 | GAP-P2 | Add readiness **guards** to lifecycle state machine (readiness already computed — wire as gate; separate from monetization gate) | M |
| 1.4 | GAP-AI1 | Build AI quality/accuracy harness for LLM layer (golden sets, hallucination checks) | M-L |
| 1.5 | GAP-K1 | Bind each capability to a success KPI (17,26); define outcome KPIs once 1.2 lands. **No composite score.** | M |

## Tier 2 — Credibility & reach (Intelligent → Enterprise)
| Prio | Gap | Action | Effort |
|---|---|---|---|
| 2.1 | GAP-A2 | Publish psychometric reliability/validity stats | M |
| 2.2 | GAP-A3 | Broaden item-bank difficulty distribution (unlock adaptive depth) | M |
| 2.3 | GAP-X1 | WCAG accessibility audit + remediation | M |
| 2.4 | GAP-X3 | Notification/continuous-engagement system | M |
| 2.5 | GAP-M1 | Mature faculty/teacher/counsellor/coach journeys (close dead-ends) | M-L |
| 2.6 | GAP-C1 | Resolve package→entitlement mapping (commercial activation) | M |
| 2.7 | GAP-S1 | Load/scalability test (write Node http harness — no load tooling exists) | M |

## Tier 3 — Enterprise activation & hygiene
| Prio | Gap | Action | Effort |
|---|---|---|---|
| 3.1 | GAP-G1 | Deliberately activate RBAC v2 + governance intelligence tiers (default-OFF → ON, staged) | L |
| 3.2 | GAP-X2 | Verify + complete multilingual content coverage | M |
| 3.3 | GAP-D1 | Decompose routes.ts + 3 monoliths; schema-sprawl cleanup | L |
| 3.4 | GAP-M2 | (Future) government/healthcare/NGO — net-new segment work; **do not claim until built** | L |

## Prioritization rationale (honest)
- **Tier 0 is sequenced first because it is launch-blocking regardless of maturity** — operational, not product.
- **Tier 1 is one coherent program ("close the loop")** — it converts the product from "measures inputs" to
  "measures outcomes," lifting Progression + Outcome/KPI from Guided→Managed and enabling an honest Intelligent
  claim. Most of it is *wiring existing engines*, hence M not L.
- **Tier 2/3 broaden credibility, reach, and enterprise activation** — valuable but not launch-gating.
- **GAP-M2 is explicitly deferred** — building new segments is out of the enhancement-only scope; flagged for
  roadmap, never claimed as present.
