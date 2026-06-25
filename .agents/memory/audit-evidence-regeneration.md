---
name: Audit-deliverable evidence regeneration
description: When an audit task BOTH fixes defects and emits a scan/evidence artifact, regenerate the artifact after the fixes.
---

# Regenerate the evidence artifact AFTER applying fixes

When a task is both an **audit** (emits a committed scan/evidence file like `scan.json`) **and** a
**fix** (changes the code the scan measures), the evidence file MUST be regenerated as the *last*
step, after the fixes land.

**Why:** If you run the scanner first, fix the flagged items, then commit, the committed `scan.json`
still lists the now-fixed items while the human-readable certification claims "fixed." The
deliverable becomes internally inconsistent and a code review will (correctly) FAIL the task on
honesty/reproducibility grounds — even though the fixes themselves are sound.

**How to apply:**
- Order: scan → fix clear defects → **re-run scanner** → reconcile the prose deliverable's counts to
  the regenerated numbers → commit.
- Add a line to the deliverable noting the committed artifact was regenerated post-fix (so a reader
  understands why the "found N / fixed N" narrative now shows 0 remaining).
- Optional hardening: a self-check that fails if the certification says "fixed" while the scan still
  lists the item.
