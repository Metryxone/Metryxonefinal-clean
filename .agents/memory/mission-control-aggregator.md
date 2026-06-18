---
name: Mission Control aggregator honesty math
description: Coverage/activation axis math for read-only dashboard aggregators that compose nullable counts across many tables.
---

# Mission Control aggregator (Enterprise Command Center landing)

Read-only never-throws aggregator at `GET /api/admin/mission-control` composes counts from ~45 tables into 8 KPI widgets + alerts + actions. Guarded `count()` returns **null** when a table is unmaterialized.

## The honesty distinction that bites: null (absent) ≠ 0 (empty)
- A guarded count of `null` means the table does not exist in this environment; `0` means it exists but is empty. These are DIFFERENT honest states and must stay distinct end-to-end.
- **Never `(C.a || 0) + (C.b || 0)`** when summing nullable runtime counts — that collapses "absent" into "0 activity". Use a `sumN(...xs)` that returns `null` iff EVERY input is null, else the numeric sum.
- **Coverage denominator = ALL declared sources, not just the present (non-null) ones.** Computing `present.filter(rows>0)/present.length` silently drops unavailable sources and can show 100% coverage while half the sources are unmaterialized. Use `sources.filter(n!=null && n>0).length / sources.length`.
- Per-source label cascade (most→least informative): `>0 → "N live"` · `ref data present → "reference only"` · `run==null → "unavailable"` · else `"idle"` (materialized, empty).
- Surface `sources_present/sources_total` in the UI so unavailability is visible, not hidden inside an averaged bar.

**Why:** user pref is honesty over optimism — Coverage (data exists) and Activation (live runtime/commercial data) are SEPARATE axes, never composited, and unknown must never be reported as zero.

**How to apply:** any future aggregator/audit that folds many nullable table counts into a readiness % — keep null distinct from 0, denominator over all declared sources, and a code-level definition that matches the prose definition in the file header.

## Environment note
This dev DB materializes ~167 of 1305 code-defined tables; most "missing" product tables actually EXIST with 0 rows (so they read as `idle`, not `unavailable`). Reference tables (cg_roles, ti_signal_master, frp_*, lip_*, competency_dna_master) are row-rich; runtime/commercial (employer_*, eios_*, payments) are empty → coverage can be high while activation is 0. That is the honest state, not a bug.
