# MetryxOne Peer Benchmarking System

**Methodology version:** `1.0.0`
**Endpoint:** `GET /api/ei/peer-benchmark`
**Status:** Production-ready (v1)

---

## 1. Purpose

The Peer Benchmark tile on the Career Builder dashboard answers three questions a candidate naturally asks the moment they see their Emotional Intelligence (EI) score:

1. **Where do I stand?** — what percentile am I in?
2. **How far is the next stage?** — concrete points-to-next-band.
3. **Can I trust this number?** — what cohort, what version, what statistical method, and what does the law say?

The system is designed to be **scientifically rigorous**, **legally defensible**, and **competitively motivating** — without ever leaking any other user's data.

---

## 2. Data Source & Cohort Construction

| Property | Value |
| --- | --- |
| Source table | `ei_calculation_logs` |
| Row filter | `source = 'resolve'` AND `fallback_used = false` |
| Version pin | `ei_version` AND `ruleset_version` must match the requester's exact pair |
| Opt-out filter | `user_id NOT IN (SELECT user_id FROM benchmark_exclusions)` — enforced in SQL `WHERE`, not in policy |
| Primary scope | **Stage band** — users in the same EI band as the requester |
| Widening scope | **All stages** — same ruleset, full score range |
| Forbidden scope | "Global" / cross-version — never used |

### Stage bands
| Band | Range |
| --- | --- |
| Starter | 0–24 |
| Builder | 25–49 |
| Career-Ready | 50–74 |
| Hire-Ready | 75–100 |

The cohort starts at the requester's stage band. If that group is below the k-anonymity floor, the system widens to **all stages on the same ruleset** — but **never** relaxes the version pin. You are never compared against scores produced by a different model.

---

## 3. k-Anonymity (k = 30)

The benchmark is computed only when the eligible cohort has **n ≥ 30** rows. Below that floor, the service performs **hard redaction**:

| Field | Returned when k met | Returned when k not met |
| --- | --- | --- |
| `cohort.n` | integer | `null` |
| `cohort.mean`, `cohort.std` | numeric | `null` |
| `cohort.p25 / p50 / p75 / p90` | numeric | `null` |
| `cohort.scope`, `cohort.scope_label` | always returned | always returned |
| `percentile` | integer 0–100 | `null` |
| `people_ahead_in_band` | integer (when scope = stage_band) | `null` |
| `confidence_interval_low / high` | numeric | numeric (clamped) |
| `score` | always returned | always returned |
| `current_stage`, `next_stage`, `pts_to_next_stage` | always returned | always returned |

The redaction is enforced in the **service layer**, not the UI. The frontend cannot un-redact what was never sent.

### `suppression_reason`
| Value | Meaning |
| --- | --- |
| `null` | Cohort met k, percentile is real |
| `"insufficient_cohort"` | n < 30 — distribution withheld |
| `"zero_variance"` | n ≥ 30 but σ = 0 — percentile undefined |

These two reasons are kept **distinct** so the UI can show meaningfully different copy.

---

## 4. Statistical Method

| Step | Formula / Source |
| --- | --- |
| Percentile | Abramowitz & Stegun rational approximation of the normal CDF: `pct = round(100 × Φ(z))` where `z = (score − μ) / σ` |
| Confidence interval | `score ± 1.96 × SE`, where `SE = σ / √n`, then clamped to `[0, 100]` |
| Rank label | `"Top X%"` where X = `100 − percentile` (only emitted when k met) |
| Points to next stage | `nextBand.min − score`, integer ≥ 0 |
| Position in band | `(score − band.min) / (band.max − band.min)` ∈ [0, 1] |

All formulas are deterministic. Given the same `(score, ei_version, ruleset_version)` and the same DB state, the same output is produced — required for legal reproducibility.

---

## 5. Privacy & Security Controls

### 5.1 Aggregates-only boundary
Nothing about any other user — name, ID, profile, individual score — ever crosses the service boundary. The only data leaving the benchmark service is aggregate statistics (n, μ, σ, percentile anchors), and only when k is met.

### 5.2 In-query opt-out
Users registered in the `benchmark_exclusions` table are excluded at the SQL layer:

```sql
WHERE user_id NOT IN (SELECT user_id FROM benchmark_exclusions)
```

This is a structural guarantee, not a policy promise. A user's own personal benchmark is still computed for them; only their contribution to **other** users' cohorts is suppressed.

| Table | `benchmark_exclusions` |
| --- | --- |
| `user_id` | text PRIMARY KEY |
| `reason` | text |
| `excluded_at` | timestamptz default `now()` |

Migration: `backend/migrations/20260520_benchmark_exclusions.sql`.

### 5.3 Anti-enumeration rate limit
The endpoint is public (renders on the unauthenticated dashboard), so it must resist adversaries who probe across `(score, version)` tuples to reconstruct the score distribution.

| Property | Value |
| --- | --- |
| Window | 60 seconds |
| Cap | 60 requests |
| Identity key | `req.socket.remoteAddress` — TCP peer **only** |
| Excluded from key | X-Forwarded-For, User-Agent, Cookie, any client header |
| Response on overflow | `429` + `Retry-After` header |
| Bucket GC | Periodic sweep of expired entries |

Because the key is the TCP peer that opened the connection, no client-side header rotation (XFF, UA) can mint fresh buckets. **Verified:** 70 requests rotating both XFF and UA → 429 fires at request 61.

The trade-off: users behind a shared NAT/proxy may share a bucket. For a public read-only aggregate endpoint with idempotent GET semantics, this is acceptable.

---

## 6. Legal Posture

| Regulation | Posture |
| --- | --- |
| **GDPR Art. 6(1)(f)** | Legitimate interest — aggregate, non-identifying analytics. With k ≥ 30 the result is outside personal-data scope. |
| **GDPR Art. 22** | No automated decisions. The benchmark is descriptive only; no hiring, lending, or eligibility decision is made by the system. |
| **DPDP Act 2023 §7(c)** | Necessary for specified purpose (career development context the user opted into). |
| **Reproducibility** | Methodology version pinned (`1.0.0`); model version pinned (`ei_version` + `ruleset_version`); deterministic formulas; outputs are traceable to inputs. |

---

## 7. API Contract

### Request
```
GET /api/ei/peer-benchmark?score=72&ei_version=4.0&ruleset_version=1.0.0
```

| Query param | Required | Description |
| --- | --- | --- |
| `score` | yes | The user's EI score, 0–100 |
| `ei_version` | yes | Engine version the score was produced with |
| `ruleset_version` | yes | Ruleset version the score was produced with |

### Response (k met, happy path)
```json
{
  "ok": true,
  "methodology_version": "1.0.0",
  "benchmark": {
    "score": 72,
    "z_score": 0.84,
    "percentile": 80,
    "rank_label": "Top 20%",
    "position_in_band": 0.88,
    "cohort": {
      "n": 142, "mean": 58.4, "std": 16.2,
      "p25": 47, "p50": 60, "p75": 71, "p90": 82,
      "scope": "stage_band",
      "scope_label": "Career-Ready band (EI v4.0 · ruleset v1.0.0)"
    },
    "cohort_anonymity_met": true,
    "min_cohort_size": 30,
    "suppression_reason": null,
    "confidence_interval_low": 69.3,
    "confidence_interval_high": 74.7,
    "current_stage": { "label": "Career-Ready", "min": 50, "max": 74 },
    "next_stage":    { "label": "Hire-Ready",   "min": 75, "max": 100 },
    "pts_to_next_stage": 3,
    "people_ahead_in_band": 28,
    "ei_version": "4.0",
    "ruleset_version": "1.0.0"
  }
}
```

### Response (k not met — current production state)
```json
{
  "ok": true,
  "methodology_version": "1.0.0",
  "benchmark": {
    "score": 72,
    "percentile": null,
    "rank_label": "Provisional",
    "cohort": {
      "n": null, "mean": null, "std": null,
      "p25": null, "p50": null, "p75": null, "p90": null,
      "scope": "all_stages",
      "scope_label": "All stages (EI v4.0 · ruleset v1.0.0)"
    },
    "cohort_anonymity_met": false,
    "min_cohort_size": 30,
    "suppression_reason": "insufficient_cohort",
    "people_ahead_in_band": null,
    "ei_version": "4.0",
    "ruleset_version": "1.0.0"
  }
}
```

### Methodology metadata
```
GET /api/ei/peer-benchmark/methodology
```
Returns the methodology version, k floor, stage band definitions, formulas, and changelog — for the modal's Methodology tab and for any external audit.

---

## 8. Frontend Surface

### Tile
`Top X%` or `Provisional` chip on the EI dashboard card. Clickable.

### `PeerBenchmarkModal` — 4 tabs
1. **Where you stand** — score · 95% CI · stage · percentile · distribution bar (only when k met; otherwise a privacy notice replaces the bar).
2. **Cohort** — n, μ, σ, version pins, scope. Sub-k fields render as "Withheld".
3. **Methodology** — A&S percentile, k floor, version pinning, formulas, change log.
4. **Privacy & Legal** — k-anonymity, aggregates-only with hard redaction, in-query opt-out, anti-enumeration rate limit, GDPR/DPDP posture, no-automated-decisions, contact for opt-out.

The `usePeerBenchmark` hook clears stale data on version/score transitions so a stale `Top X%` is never shown for a different ruleset.

---

## 9. Operational Notes

- **Current cohort:** ~17 rows on the live ruleset → system correctly serves the "Provisional" state with all distribution fields redacted.
- **Unlock condition:** as soon as the cohort grows past 30 same-version assessments, percentile + distribution unlock automatically with no code change.
- **Re-version policy:** every change to the EI engine or ruleset bumps its version pin, which intentionally resets the cohort to "Provisional" until 30 new same-version assessments accumulate. This is required for scientific defensibility — you can't compare scores produced by different models.
- **Opt-out flow:** add row to `benchmark_exclusions(user_id, reason)`. Effect is immediate on the next request — no cache to invalidate.

---

## 10. Change Log

| Version | Date | Change |
| --- | --- | --- |
| 1.0.0 | 2026-05-20 | Initial release: cohort-based percentile, k=30 hard redaction, version pinning, in-query opt-out, TCP-peer rate limit, 4-tab modal. |
