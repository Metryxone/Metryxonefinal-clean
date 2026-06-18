---
name: WC-1C-Y YELLOW signal grounding
description: How the YELLOW band is grounded on top of GREEN, the new evidence-weighted composites, and the transactional hard-gate pattern these grounding engines should use.
---

# WC-1C-Y — YELLOW Signal Grounding

Activates the WC-1A YELLOW bridge tags (121) the SAME additive way WC-1B grounded GREEN — reuse-linking existing atomic signals into `capadex_bridge_tag_{family,signal}_grounding`, but provenance `wc1a_yellow`. Reuse only; no new signals/concerns/tags; reversible via `DELETE WHERE provenance='wc1a_yellow'`. See `wc1b-signal-grounding.md` for the shared storage/measurement rules — this file only records what is DIFFERENT for YELLOW.

## Band is enforced in code, not trusted from labels
- Ground `(tag,family)` pairs in the declared YELLOW band `[TAU_LOW=0.0963, TAU_HIGH=0.2139)` (TAU_LOW = 0.45×TAU_HIGH). A YELLOW-classified tag whose family ≥ TAU_HIGH would be a GREEN — that class-band inconsistency must HARD-STOP the run, never be silently absorbed under yellow provenance.
- **Why:** WC-1A labels and the similarity column are produced separately; a defense-in-depth band check catches drift between them. (In practice all yellow families are < TAU_HIGH because the tag's *best* family defines its class, so the guard drops nothing — but it must exist.)
- All YELLOW grounds at evidence `moderate` (band is entirely below TAU_HIGH).

## Honest composites — they rise LESS than raw coverage by design
- **Trust Score** = evidence-weighted TAG grounding over the 328 concern tags (strong=1.0, good=0.8, moderate=0.5; native=strong). YELLOW activates 100% raw coverage but Trust only rises to ~73 — the coverage−Trust gap IS the quantified "moderate-confidence cost" of YELLOW. Do NOT hide it; surface the gap as the finding.
- **Assessment Intelligence Score** = evidence-weighted QUESTION coverage (same weights). It is a DIFFERENT metric from AQ-2's question-metadata AIS — label it so, don't conflate.
- Resolver-confidence impact stays DIRECTIONAL (runtime wiring out of scope); only the counts (concerns/questions on newly-grounded tags) are measured.

## Pattern: mutation + verification in ONE transaction, hard-gate rollback
- Run ensure-schema + DELETE(yellow) + inserts + AFTER-measurement + ALL guardrail queries on a single `PoolClient` inside `BEGIN`…`COMMIT`. Collect the invariant booleans (no_fabrication / no_dup / no_new_bridge_tags / no_new_signals / immutability fingerprints / no_green_mutation / no_green_yellow_overlap); if ANY is false, throw → ROLLBACK → non-zero exit. COMMIT only when all pass. No partial writes can persist.
- **`--dry-run` takes the SAME path then ROLLBACKs** — so dry-run is a true projection from the in-memory candidate rows AND exercises every guardrail, instead of reading ambient DB state (which is misleading once prior yellow rows exist).
- **Why:** an audit engine that reports guardrail booleans but still "succeeds" + writes deliverables when a guardrail breaks is not actually enforcing anything. The transaction makes enforcement real and atomic.

## Consistency proof
Implementing exactly the approved YELLOW set reproduces the WC-1A health forecast to the decimal (67.8 → **72.4**). That exact match is the signal the mapping is faithful, not re-derived.
