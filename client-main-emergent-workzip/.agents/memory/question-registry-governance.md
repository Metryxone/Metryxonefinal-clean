---
name: Question registry governance triage
description: How lifecycle/governance buckets for a large question bank must gate "unmeasured" vs "low value", and the human-only status rule.
---

# Question Registry & Governance triage

A registry that lifecycle-tracks a large content bank (clarity questions, 20k+) and
surfaces governance triage buckets (weak / duplicate / low-signal / retirement).

## Rule: gate "never-used / unmeasured" on SYSTEM-WIDE data existing, not per-row
A "low-signal" (or "unused") bucket must NOT flag a row just because *that row* has
zero usage. Before the system has collected ANY responses, **every** row is unused,
so the bucket becomes the entire bank — useless noise, and it conflates *absent*
data with a *low* value.

**Fix:** compute a system-wide marker first (`systemHasUsage = rows.some(usage>0)`)
and only treat "never asked" as a low-signal concern once that marker is true.
Measured-low (signal_value not null AND below threshold) can fire independently.

**Why:** this is the deepening of the broader memory lesson "gate absent on a
real-data marker, not a neutral fallback" — here the marker is *system-wide*, not
per-row, because a brand-new bank legitimately has zero usage everywhere.

**How to apply:** any triage/quality bucket whose predicate includes "0 uses / no
data / never seen" needs a presence-of-data gate, or it floods on a cold start.

## Rule: status transitions are HUMAN-ONLY + must enforce the row invariant
No job, refresh, or route ever auto-transitions lifecycle status (esp.
deprecate/retire). The metric-snapshot path skips status entirely; a single
status-writer function is the only one that mutates it. Algorithmic retirement is
a *suggestion* bucket, always labelled "needs human review — not auto-retired".

The status writer uses `INSERT ... ON CONFLICT`, so it MUST first verify the id
exists in the source content table — otherwise a PATCH typo mints an orphan
governance row (one-row-per-real-question invariant). Reject unknown ids → 404.

## Perf shape for a large bank
- Duplicate detection: bucket by a grouping key (here `master_bridge_tag`) so it's
  Σ small-n² instead of N², before any pairwise Jaccard.
- Metrics are SNAPSHOTTED into registry columns by a manual admin refresh, then
  read fast + server-paginated at request time. Don't recompute on the read path.
  Row-by-row upsert scales linearly — go chunked/set-based if latency matters.
- quality_score is human-overridable: refresh must skip rows where
  `quality_overridden` is true.
