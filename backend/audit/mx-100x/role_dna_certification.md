# Section 4 — Role DNA Certification

**Verdict: PARTIAL (governance framework PASS; content depth FAIL).**

Role DNA (the curated competency "signature" of a role) has a sound governance design — the MX-100X P1
Role DNA Governance phase established Coverage⟂Confidence separation, write-once reversible decisions,
and honest abstention for unlinked roles. The limitation is **content depth**: the curated DNA set is
very small in the live DB.

## 4.1 Curated DNA content — FAIL (depth)
- `onto_dna_profiles` = **5**, `onto_roles` = **5**, `onto_role_weights` = **44**,
  `onto_role_competency_profiles` = **14**.
- Five curated roles is a credible *seed*, not an enterprise role library. Role DNA as a curated,
  high-confidence artifact is therefore **demonstrated but not populated at scale**.

## 4.2 Governance framework — PASS
- Coverage (does the role have a DNA profile?) and Confidence (is the linkage trustworthy?) are kept
  on **separate axes**. A role with no competency link correctly **abstains** on Confidence and
  Quality (null) while still reporting partial Completeness — divergent axes are not fabrication.
- No role↔industry link exists, so any industry-conditioned DNA correctly **always abstains** rather
  than inventing an industry signal.
- Decisions are **write-once and reversible by provenance** (POST-only); GET handlers are read-only.

## 4.3 The O*NET escape hatch — PARTIAL (Estimated, not curated)
- Where curated DNA is absent, the platform can derive role expectations from the O*NET crosswalk
  (`map_role_competency`, 52,362 edges) via `bridgeOnetDerivedWeights`, surfaced with an **Estimated**
  badge. This is the right honest design: it never upgrades Estimated to curated Confidence.
- But O*NET-derived weights are **stuck at LOW confidence** by construction, so they extend Coverage
  without extending Confidence.

## 4.4 Confidence vs Coverage
- **Coverage:** can reach ~1,000+ roles via O*NET derivation (Estimated).
- **Confidence:** HIGH only for the **5 curated** roles; LOW everywhere else.

## 4.5 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Curated DNA depth | FAIL | 5 roles / 14 role-competency profiles |
| Governance (Coverage⟂Confidence, abstention, reversibility) | PASS | P1 governance phase, write-once provenance |
| O*NET-derived extension | PARTIAL | Estimated badge, LOW confidence, no curated upgrade |
| Industry-conditioned DNA | PASS (abstains) | no role↔industry link → honest abstain |

**Net: PARTIAL.** The governance and honesty machinery is enterprise-grade and correct. Role DNA needs
a **curated content investment** (or an explicit decision to operate primarily on Estimated O*NET DNA)
before it can be certified as an enterprise role-intelligence asset.
