# WC-L1A — Remediation Results (R1 · R3 · R2 executed)
_Approved scope: "safe coverage steps only" — R1 verify live hook, R3 stage backfill, R2 journey backfill. **R4 (source/flag changes) and R5 (re-trend) intentionally NOT run.**_

## What was run (no source/flag changes; flags set in-process only, mirroring the workflow)
| Step | Script | Outcome |
|---|---|---|
| **R1** verify live hook | `scripts/wc3/wcl1a-r1-verify-hook.ts` | Self-cleaning probe drove a synthetic completed session through the EXACT WC-3 gated block under live flags. **Stage ✅, Longitudinal ✅, Journey ✅ written; Outcome ⚪ none (expected).** Probe + all its rows deleted afterward (verified 0 leftovers). |
| **R3** stage backfill | `scripts/wc3/wcl1a-r3-stage-backfill.ts` | **9/9** completed sessions → `wc3_stage_state` (sourced from snapshots; UPSERT + skip-if-exists so progression never duplicates). |
| **R2** journey backfill | `scripts/wc3/wcl1a-r2-journey-backfill.ts` | **9/9** completed sessions routed → `wc3_journey_state`, **all 9 degraded** (route_confidence ≈ 0.2, mentoring fallback). |

## Coverage — before → after
| Table | Before | After | Coverage (of 9 completed) |
|---|---|---|---|
| wc3_stage_state | 0 | **9** | 100% |
| wc3_journey_state | 0 | **9** | 100% (all degraded) |
| wc3_outcome_state | 0 | **0** | 0% (unchanged — blocked at source; that is R4) |

## The R1 finding (narrows, not fully closes, the audit's open ambiguity)
The hook is **fire-and-forget + never-throws**, so the audit could not distinguish "never fired" from
"fired but wrote nothing." R1 shows that under the live flags the gated WC-3 block **does write** stage +
journey rows — so it **rules OUT** "the WC-3 block fires but is intrinsically unable to write." The
production 0-row state is therefore consistent with EITHER (i) no qualifying completion since the flags
went live, OR (ii) the hook firing but **aborting upstream** — before the WC-3 block (§14) — on an
exception swallowed by `postCompletionHooks`' outer try/catch. R1 does NOT exercise the full HTTP
completion path, so it cannot adjudicate between (i) and (ii); both remain open, but a *defective WC-3
writer* is excluded. (Outcome legitimately stays empty — no behavioural constructs to classify; honest
UNCLASSIFIED, never fabricated.) To separate (i) from (ii), drive a single synthetic completion through
the HTTP endpoint with entry/pre-WC3/WC3 telemetry (a heavier probe, not run under this approved scope).

## Honesty caveats (do NOT overstate)
- **Journey coverage rose, quality did not.** All 9 routes are the degraded mentoring fallback because
  `wc3_outcome_state` (journey's scoring input) is empty. Journey becomes meaningful only after R4.
- **No trend recompute (R5) was run**, so journey/outcome trend coverage is unchanged. Even if R5 were
  run now, a journey trend would be a flat, information-free constant (≈0.2 for every session) — not a
  real direction. Trend value for journey is gated on R4, not on this backfill.
- **Outcome remains 0%** and is unaffected by these steps. Meaningful Outcome coverage requires R4
  (behavioural-spine capture and/or enabling `FF_WC3_OUTCOME_CROSSWALK`), which was deliberately excluded.

## Still open (proposed, not executed — would need separate approval)
- **R4** — unblock Outcome at the source (behavioural-spine capture and/or crosswalk flag).
- **R5** — re-run WC-L1 trend backfill + re-measure once Outcome/Journey carry real (non-degraded) rows.
- Going forward, while the workflow flags remain on (and the hook reaches §14), NEW completions
  populate **stage + journey automatically**; **Outcome only when the session carries behavioural
  constructs** (spine present and/or crosswalk enabled) — otherwise it stays honestly UNCLASSIFIED.
  No recurring backfill is needed for fresh stage/journey data.
