---
name: Platform Intelligence OS Constitution (MX-800 Phase 2.1)
description: The constitution/audit-only phase that froze a coordination contract over the existing intelligence engines; what it measured and the traps of auditing a huge mature platform honestly.
---

# Platform Intelligence Operating System Constitution (MX-800 Phase 2.1)

First phase of the MX-800 program. ENHANCEMENT-ONLY / governance deliverable: produce a measured audit +
a Constitution that gives the existing intelligence engines ONE coordination contract. NO engine, NO
business-logic change, NO duplication, NO persistence, NO flag, nothing activated. Implementation is a
future Phase 2.2; the Constitution freezes after approval.

## Durable lessons

- **An "audit" deliverable must be backed by a deterministic measurement script, not prose.** The
  honesty contract (never fabricate/estimate) means every number in the Constitution comes from
  `scripts/mx800-2.1-platform-intelligence-audit.ts` — a pure read-only fs scan emitting JSON + MD. No DB,
  no flags, no DDL. **Why:** a hand-written audit of a 422-service platform drifts from reality instantly;
  a re-runnable scan is the only defensible source.

- **Map the 9 constitutional domains with a CURATED, file-existence-verified anchor map — never a forced
  exhaustive partition.** Each domain points at representative engines that are confirmed to exist on
  disk; a declared anchor that's missing is reported `present:false`, not assumed. **Why:** force-fitting
  all 422 services into 9 buckets manufactures false precision; "representative anchors + honest residual"
  is truthful. **How to apply:** keep the anchor map as data in the script so the classification is
  auditable, and report observed engine families by name-pattern with an explicit "patterns overlap, not
  a disjoint partition" caveat.

- **`-v2` variants are duplication CANDIDATES, not asserted duplicates.** The scan flags `-v2` service
  files for human review; several are deliberate flag-gated successors. Never auto-conclude redundancy.

- **The central honest finding is the activation gap: built ≠ activated.** The large majority of flags
  default OFF — most intelligence is dormant by design. Capability ≠ runtime adoption; report separately.
  (Exact counts live in the regenerable `phase-2.1-platform-intelligence-audit.json`, not here.)

- **Maturity ceiling is "Managed", NOT "Self-Optimizing".** Ladder Operational→Guided→Managed→
  Intelligent→Self-Optimizing with human approval mandatory. Engines are read-only, flag-gated,
  human-in-the-loop → Managed. Some forecast/predictive engines reach toward Intelligent in isolation but
  it's not orchestrated platform-wide, so don't claim it as a platform level. Self-Optimizing (autonomous,
  unreviewed) is out of scope by the honesty contract — never auto-claim it.

- **Honesty ladder for this program:** Intelligence Exists ≠ Connected ≠ Orchestrated · Data ≠ Knowledge
  ≠ Intelligence ≠ Reasoning ≠ Decision ≠ Automation · Coverage ⟂ Confidence ⟂ Evidence. The platform is
  Connected but NOT Orchestrated — that coordination layer is exactly what 2.2+ will add (composing, never
  rebuilding; precedent = MX-700 1.37→1.43 tiers compose each other).

- **Deliverables** live in `backend/audit/mx-800/`: `phase-2.1-platform-intelligence-audit.{json,md}`
  (measured) + `phase-2.1-platform-intelligence-constitution.md` (governing doc, freeze-after-approval).
  A legacy `backend/audit/phase-2.1/` (just VALIDATION.md) is from the old 98x/100x program — unrelated;
  use `mx-800/`.
