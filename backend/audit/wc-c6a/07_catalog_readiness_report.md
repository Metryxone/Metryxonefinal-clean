# WC-C6A · Deliverable 7 — Catalog Readiness Report
_Generated 2026-06-10T08:50:05.250Z. read-only._

> Catalog Readiness is reported as **measured COUNTS + per-axis verdicts**, NOT a percentage — there is no defensible denominator for "% of a catalog" when the catalog is empty (0% of *what target*? would be fabricated). Derived fractions over the package population are **0/0 → not_measurable**.

## Two catalogs
### A. Ladder catalog (code-defined B2C SKUs)
- **Count**: 3 SKUs, all priced. **Live**: true.
- Structural: real (3 priced SKUs in code). Activation: presentable; capture demo (Razorpay unconfigured). Confidence: one-time model — cannot recur by design.

### B. Package catalog (DB `subscription_packages`)
- **Count**: **0 products defined (EMPTY)** — active=0, priced=0, with_validity=0.
- Structural: real (schema + admin CRUD). Activation: cannot sell — 0 products; seed is a STUB (unpriced/null-validity rows). Confidence: no catalog exists.
- Derived fractions: populated **not_measurable** (0/0 — not_measurable: empty denominator (0/0)); priced **not_measurable** (0/0 — not_measurable: empty denominator (0/0)).

## The seed is a STUB (critical)
The admin seed (`/api/admin/subscription-packages/seed`) inserts **13 packages with NO price, NO validity_days, NO question_count**; the schema leaves all three nullable with no default. So even if seeded, the catalog would be **13 unpriced, null-expiry products → not sellable, not renewable** (renewal requires `expiry_date IS NOT NULL`; null validity → null expiry → 0 renewable). **"Just run the seed" is not a fix** — the seed must first be corrected to emit price + validity_days + question_count.

## Verdict
The catalog **mechanism** (schema + CRUD) is real; the catalog **content** does not exist. A renewable product catalog is the first missing asset.
