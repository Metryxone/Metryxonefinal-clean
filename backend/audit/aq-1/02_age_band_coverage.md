# AQ-1 · Output 2 — Age Band Coverage

**Investigation only.** Age is **not** stored on the question; it is inherited from the question's bridge tag via `capadex_concerns_master.age_min/age_max` (min across all concerns sharing the tag → max). Taxonomy = `['6-14','14-17','17-24','24-45','45+']`; youth↔adult boundary = age 18.

> **Boundary convention:** the taxonomy labels overlap at 14/17/24. This audit applies a half-open assignment — a boundary age belongs to the band where it is the **lower** bound (14→`14-17`, 17→`17-24`, 24→`24-45`), so each integer age maps to exactly one band.

## Per-question age derivation
| Outcome | Count | % |
|---|---:|---:|
| **Crosses youth↔adult (18) boundary** | 29,118 | **95.0%** |
| Spans multiple adjacent bands (same side of 18) | 1,395 | 4.6% |
| Resolves to a single clean band | **0** | **0%** |
| Age unknown (tag has no age data) | 125 | 0.4% |
| Youth-only (max < 18) | 535 | 1.7% |
| Adult-only (min ≥ 18) | 860 | 2.8% |

## Band coverage (a question counts toward every band its inherited range overlaps)
| Band | Questions overlapping |
|---|---:|
| 6-14 | 25,818 |
| 14-17 | 29,533 |
| 17-24 | 30,393 |
| 24-45 | 18,059 |
| 45+ | 14,284 |

**No band is missing** — every band is overlapped by tens of thousands of questions. The problem is the inverse: bands are *over*-claimed because ranges are enormous (avg span ≈ 14 years).

## Adult-on-youth / youth-on-adult mismatches
The audit explicitly looked for "adult questions assigned to youth concerns" and vice-versa. **This cannot be determined per question**, because:
1. The question carries no intended age of its own.
2. The inherited tag range is so wide (95% straddle 18) that almost every question is *simultaneously* "youth" and "adult".

What **is** determinable:
- **535** questions sit on strictly youth-only tags (max < 18) and **860** on strictly adult-only tags (min ≥ 18). Only these 1,395 (4.6%) have an unambiguous life-stage.
- The remaining **95%** are structurally ambiguous: a single tag (e.g. one mapping concerns for both a 12-year-old and a 40-year-old professional) lends the same questions to children and adults alike.

## Verdict — RED for age
- Clean single-band coverage: **0%**.
- Age is a derived, tag-inherited attribute with a ~14-year average span; 95% cross the most important developmental boundary. Per-question age targeting is **not achievable** from the current data model. A per-question `age_min/age_max` (or per-question band) is required to make age a first-class, auditable attribute.
