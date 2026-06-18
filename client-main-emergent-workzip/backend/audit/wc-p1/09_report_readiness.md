# WC-P1 — D9: Report Readiness

**Coverage**: 65% | **Confidence**: 55%

---

## Evidence

| Report Surface | State |
|---|---|
| EI breakdown modal (8-dim) | ✅ Fully implemented — score + rationale + evidence + CTA per dimension |
| EIGauge (circular gauge) | ✅ Live in Career Builder dashboard |
| EIProvenanceCard | ✅ "Why this score" breakdown with provenance notes |
| Admin EI calculation logs | ✅ HTTP 401 — 199 rows in DB |
| Admin ruleset management | ✅ HTTP 401/401 — CRUD + preview |
| EI Passport (shareable) | ⚠️ Routes registered; flag DISABLED |
| PDF export (EI Passport) | ✅ html2canvas + jsPDF in `PassportOwnerModal` |
| Public passport (/public/passport/:token) | HTTP 404 (route present) |
| Admin snapshot trajectory | HTTP 401 |
| Longitudinal trend chart | ❌ No data (0 snapshots) — renders empty |
| Email EI summary | Not found as standalone; CAPADEX email exists |

---

## Integrity Issue: Two EI Numbers

The EI breakdown modal shows the doc-accurate 8-dimension score. The EIGauge shows the 6-dimension engine score. **These two numbers will diverge** for any user who has taken the assessment or has education data — the modal shows a higher number. This is potentially confusing and undermines report credibility.

---

## What Works Well

- The EI breakdown modal is the most polished report surface: per-dimension card with actual/max points, progress bar, rationale text, evidence detail, and a CTA with the target tab. This matches the documentation spec exactly.
- Admin governance suite: full CRUD on rulesets, preview/compare across versions, calculation log audit trail.
- 198 calculation logs confirm the resolver is actively recording EI computations.

---

## What Doesn't Work

- Longitudinal trend: 0 snapshots → trend chart is empty for all users.
- Percentile is hardcoded (lookup table, not from real cohort data).
- EI Passport: flag-dependent; snapshot assembly is best-effort (behavior graph data likely absent for most users).

---

## Actions to Reach 95%

1. Resolve formula divergence (D5 action 1) so modal and gauge show the same number.
2. Trigger at least one snapshot per user on first EI resolution to seed the longitudinal chart.
3. Enable `employabilityPassport` flag once data quality is sufficient.
4. Replace hardcoded percentile lookup with real cohort percentiles (requires ≥30 career profiles).
