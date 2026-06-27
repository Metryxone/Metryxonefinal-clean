# MX-302J — Performance & UI/UX Evidence

## Performance (measured — node HTTP harness, no load tools)
- **Built frontend (dist):** 16407.4 KB total · JS 12979.1 KB (350 files) · largest JS chunk 1576.4 KB
- **API p95 latency (ms):**
  - health (trivial): 2.721 ms (status {"200":150})
  - capadex_concerns (read): 4.918 ms (status {"200":150})
  - report_factory_templates (AUTH-gated): 3.925 ms (status {"401":150})
  - launchpad_suite (AUTH-gated): 3.329 ms (status {"401":150})
  - outcome_intel_enabled (flag probe): 3.617 ms (status {"200":150})

> Auth/flag-gated compose paths (launchpad suite) are reported as **PARTIAL** — gate latency (401) only; the authed 8-report compose is not measurable over HTTP without a super-admin session (it is exercised in-process above).

## UI/UX (mechanically-scannable defect classes — honesty-first)
- **TRUE state gaps (no loading AND no error):** 0 []
- **Rendered-defect placeholders:** 0 []
- **Off-brand primary/accent:** 0/0

> The remaining placeholder is EmployerPortal's **honest-unavailable** phone-screening disclosure (browser recording is fully active) — kept, not hidden. Visual/subjective criteria are an explicit ceiling covered by manual review, not this scanner.
