# WC-L0F · Executive Summary — Behaviour Capture Remediation
_Generated 2026-06-10T02:58:51.179Z. Additive · flag-gated · reversible · STOP FOR APPROVAL (no deploy)._

## What was actually true (measured, not assumed)
The "~22% behaviour coverage" premise was **stale**. The WC-L0E signal backfill is already applied (5 sessions stamped), so coverage was already **77.8%** when WC-L0F began. WC-L0F honestly reconciles this rather than claiming a 22%→78% lift it did not perform.

## What WC-L0F did (reuse only — no new ontology/dim/model)
1. **Graph backfill (idempotent):** 0 sessions activated; 2 refused as un-backfillable (0 responses). Coverage was already at its ceiling, so this was a confirming no-op.
2. **Re-persistence WITH namespace alignment ON:** 9/9 sessions stable, 0 changed — proving the deficit dims were NOT regressed to NULL (the trap of re-persisting without the alignment flag).
3. **Behaviour-trend activation (the genuine lift):** persisted behaviour-trend rows **5 → 5** across 2 owner(s), because WC-L0E graphed both sessions of returning owners.

## Honest ceilings (reported, never inflated)
- **Coverage ceiling = 77.8%** (2 zero-response sessions are permanently un-backfillable). **80%+ is not reachable on this base without fabrication.**
- **Trend confidence = 0.33 (low)** — every series is 2 points.
- **Behaviour-forecast (risk) readiness unchanged** — the forecast surface consumes only the sparse `risk` dim.

## The real binding constraint
Not persistence, not the projection, not trend math — it is **upstream behaviour-signal CAPTURE volume**: more completed, response-bearing, *returning-user* sessions (and, for forecasts, richer `risk`-dim capture). That is a data-collection lever, not an engineering one.
