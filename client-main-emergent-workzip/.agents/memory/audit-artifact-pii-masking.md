---
name: Audit-artifact PII masking
description: WC-* measure/audit scripts write committed .md files — they must never contain raw user emails
---

Any audit/measure script that writes report files into `backend/audit/<phase>/` is writing to
files that get **committed to the repo**. Those reports must never carry raw user PII (emails).

**Rule:** mask user emails to an irreversible, deterministic pseudonym before writing them into any
audit markdown. Use `createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0,10)` →
`user_<hash>` (stable across regenerations, one-way).

**Why:** committed audit artifacts persist in git history; a leaked gmail identity there is a real
privacy violation. The architect honesty pass FAILs a WC deliverable purely on this even when the
measurement logic is correct.

**How to apply:** when modelling a new `wcl*-measure.ts` on an existing one, grep the output for
`@` / known email fragments after regenerating — the per-user trend lists and per-user matrices are
the usual leak sites. Console output is ephemeral (not committed) so masking there is optional, but
anything passed to `writeFileSync` must be masked.
