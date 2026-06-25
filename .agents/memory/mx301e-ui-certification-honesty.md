---
name: MX-301E UI certification honesty
description: How to deliver an honest "100%" UI/UX certification without faking the number
---

# Honest "100%" for a static UI/UX certification

**Rule:** A scanner's "0 defects" is only trustworthy if the detector was *tightened* (catches more
real gaps) before the gaps were closed — never loosened to manufacture a 0. Report defect-class
closure (mechanically scannable) SEPARATELY from any inherent visual-review ceiling; never composite
them into one "100%".

**Why:** The user demanded "make it 100%" under a hard honesty-over-optimism rule. The trap is to
weaken the test (e.g. stop flagging files) so the count drops. The honest path is the opposite:
prove the detector is stricter, then close the genuine remainder.

**How to apply (the moves that worked):**
- State-handling detection: `hasLoading` must catch the plain `const [loading,setLoading]=useState`
  pattern + `loading &&` render guards (not only `isLoading`/`isPending`); `hasError` must catch
  `setError`/`error &&`/`.catch(` — BUT a `try/catch` inside a `formatDate`/date-parse utility is
  NOT data-fetch error handling (verify directly, don't credit it).
- `readsData` must require an actual data CALL (`useQuery(` / `useSWR(` / `apiRequest(`), not a mere
  import — tab-container files that import `useQuery` but delegate to child tabs are false positives.
- Define the defect class precisely: the real "state gap" is a data screen with NO loading AND NO
  error. Single-axis empty-state absence is a softer polish tier with a high false-positive rate
  (empty handled by a parent, `.length===0` rendered as a normal row) — document it, do NOT bulk-add
  fake empty states.
- Inline-brand debt: a codemod converging inline `const BRAND` to a token import is mechanical/low
  risk; a deliberate, internally-consistent secondary palette (here deep-navy `#0b3c5d`) should be
  PROMOTED to a named token (`BRAND_NAVY`), not erased — that's honest formalization, not drift.
- Responsive: skip `max-w-[`, `aria-hidden`, `pointer-events-none`, and responsive-prefixed widths;
  only bare ≥600px fixed widths are genuine overflow risk.
- The only real build gate is `npx vite build` (backend runs on tsx, no tsc). Closure prose must say
  "0 in each mechanically-scannable class (Gaps 1–4)" — the visual-coverage ceiling is non-scanner
  and stays open by definition.
- Parallelize the heterogeneous per-file state fixes across subagents (additive loading/error UI,
  reversible, no logic change), then run ONE build to verify.
