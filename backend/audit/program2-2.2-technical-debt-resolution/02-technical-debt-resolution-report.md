# Program 2 · Phase 2.2 — 02 · Technical Debt Resolution Report

**What was changed in this phase, with repository evidence.** All changes are enhancement-only, behavior-preserving on success paths, add no business functionality, and reuse the canonical `lib/logger.ts` introduced in Phase 2.1.

## 1. Resolution applied this phase

**Category:** Missing error handling / Missing logging (inventory report 01 §2).
**Change:** 6 runtime code sites that **silently swallowed errors** on *rare but important* paths were converted from empty `catch {}` to **logged best-effort** blocks via `lib/logger`. The catch still degrades gracefully (control flow unchanged); it now records *why* the path degraded.

| # | File | Site | Before | After | Level |
|---|---|---|---|---|---|
| 1 | `routes/career-pathways-intelligence.ts` | `/api/career/pi` ensureSchema middleware | `catch {}` | log + continue | `warn` (schema-ensure failure is rare + important) |
| 2 | `routes/career-pathways-intelligence.ts` | `/api/admin/career/pi` ensureSchema middleware | `catch {}` | log + continue | `warn` |
| 3 | `services/lbi-unifier.ts` | System B (`lbi_scores`) source read | `catch {}` | log + treat source absent | `debug` |
| 4 | `services/lbi-unifier.ts` | System A (wcl0/behavioural) source read | `catch {}` | log + treat source absent | `debug` |
| 5 | `services/lbi-unifier.ts` | System C (domain scores) source read | `catch {}` | log + treat source absent | `debug` |
| 6 | `routes/capadex-enterprise.ts` | report recommendation enrichment read | `catch (_err){}` | log + report continues | `debug` |

Plus 3 one-line `import { logger }` additions (one per file).

## 2. Why these and not the other 46 empty catches
The other empty `catch {}` blocks were **deliberately left untouched** because they are intentional, and logging them would inject noise (which is itself a regression of the codebase's clean style):
- **Safe-parse fallbacks** — `JSON.parse(...) } catch {}` with a default already assigned (`routes/import-export.ts`, `routes/pragati.ts`). A log would fire on every malformed row.
- **Per-row / per-request never-throws read composers** — `patterns = rows; } catch {}` (`routes/career-intelligence-hub.ts`, `routes/eios-intelligence.ts`, `routes/eios-workforce.ts`, `routes/talent-scoring.ts`, `routes/paie-intelligence.ts`, `routes/lbi-engine.ts`). These implement the documented `null ≠ 0` honesty contract; logging would be hot-path noise.
- **Smoke / audit / test cleanup** — `try { await pool.end(); } catch {}` etc. in `scripts/**`, `audit/**`, `tests/**`. Dev tooling; best-effort by nature.

Selecting by **failure rarity + importance** (not blanket coverage) is the honest, low-noise resolution.

## 3. Verification (no regression)
- **Clean boot:** backend runs on `tsx` (no compile gate); after the edits the **`Backend API` workflow restarted cleanly** (no syntax/boot error).
- **Authz smoke:** `scripts/program2-2.1-authz-smoke.ts` → **3/3 PASS** (seed endpoint 401, `/hr/jobs/:id` 401, `/hr/jobs/published` 200) — the 2.1 security invariants still hold.
- **Behavior-preserving:** each catch still swallows-and-continues; success paths are byte-identical. At the prod default `LOG_LEVEL=info`, the 4 `debug` lines are suppressed → prod output is unchanged; the 2 `warn` lines fire only on a genuine schema-ensure failure.
- **No new functionality, no API change, no DB/schema change, no frontend change.**

## 4. Resolution carried by Phase 2.1 (not re-done here)
For completeness, the previously-identified debt already resolved (do not re-count): D1 seed-auth gate, D2/D3 duplicate/shadowed route removals (9 pairs), D4 mei-v2 transaction, D8 unguarded handlers, D9 logger introduction, D11 dead-registration cleanup. D5/D6/D7/D10 are policy-bound (report 07).
