---
name: Launch-validation evidence integrity
description: Honesty traps in an evidence-driven GO/NO-GO certification script (verdicts must flow from live evidence, not silently corrupted or auto-cleared).
---

# Launch-validation evidence integrity

A validation/certification script whose whole value proposition is "verdicts derived from
live evidence, not asserted" can still inflate or corrupt itself in subtle ways. When the
script IS the deliverable, audit these traps:

**Rule:** every PASS/CONDITIONAL/GO must be re-derivable from a live probe at run time, and
no failure may silently masquerade as a finding.

**Why:** three real defects surfaced in one such script —
1. A read query selected a column that does not exist on the table (`users.updated_at`). The
   query threw, the `catch` stuffed the error string into the field, and the PII mask then
   fell through to its SHA-sentinel fallback. The corrupted lookup printed as if it were a
   real finding (`0 rows` / opaque `user_<sha>`), hiding that the row actually existed.
   → Only SELECT columns you have confirmed exist; treat a caught query error as a HARD
     script failure, never as a data value to render.
2. A blocker was cleared by an env flag that only meant "a test email was *sent*" — not that
   a human *received* it. On the certificate's own "re-run to re-certify" instruction, a
   re-run with that flag set would have auto-flipped CONDITIONAL → GO. A blocker that needs
   human confirmation must clear ONLY on an explicit owner-attestation flag, never on a
   side-effecting send attempt (whose success is also ignored).
3. Rows hardcoded as `✅ PASS (code-verified)` contradict "derived from evidence" — they
   print PASS regardless of source state, so a future code change goes undetected. Either
   re-derive at runtime, or annotate as a static one-time assertion with the verification date.

4. HTTP method trap: a probe using GET on a POST-only route returns 404, making the handler
   appear absent ("❌ Missing") even though it exists. The audit then derives a wrong NO-GO.
   Always confirm the method from the route definition before writing the probe; test
   POST-only routes with `fetch(url, { method:"POST", body:"{}",
   headers:{"Content-Type":"application/json"} })` — an HTTP 400/401 (not 404) is the correct
   "handler present" signal.
5. Verdict strings in a "re-certifiable" audit script must use template variables, never string
   literals. A hardcoded `"⚠️ CONDITIONAL GO"` in a cert template contradicts the re-run
   instruction — on the next run (after blocking items are cleared) the cert header changes but
   the table rows still say FAIL. Wire every verdict cell to the probe variable that determined
   it (e.g. `${seedPwLive ? "❌ OPEN" : "✅ Set"}`).

**How to apply:** before certifying, grep the script for (a) DB columns against the live
schema, (b) any blocker/verdict that clears from an env flag — confirm the flag means
attestation not attempt, (c) literal `PASS`/`GO` strings not gated on a probe variable,
(d) probe methods — all POST-only routes must be probed with POST not GET.
Also: "rotation has occurred" derived from secret-presence is wrong when rotation only runs
at restart — label it "mechanism armed (restart required)". And mask a PII identifier
*everywhere*, including hardcoded instruction prose, or the masking elsewhere is cosmetic.
