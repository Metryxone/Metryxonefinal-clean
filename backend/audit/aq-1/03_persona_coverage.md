# AQ-1 · Output 3 — Persona Coverage

**Investigation only.** Persona is derived from `capadex_concerns_master.primary_persona` via the bridge tag, then bucketed into the six canonical personas. A bridge tag maps to **avg 1.4 persona buckets**, but the distribution is skewed — **53.9% of questions resolve to >1 bucket**, so the majority are ambiguous.

## Coverage across the six required personas
"Any-bucket" = questions whose bridge tag touches that persona (overlapping). "Single-bucket present" = questions where that persona is the **only** bucket the tag resolves to (unambiguous).

| Persona | Any-bucket reach | % of bank | Unambiguous (single-bucket) |
|---|---:|---:|---:|
| Student | 17,789 | 58.1% | 1,865 |
| Professional | 15,543 | 50.7% | 1,318 |
| Teacher | 13,399 | 43.7% | 265 |
| Parent | 8,687 | 28.4% | 90 |
| Counselor | 8,337 | 27.2% | 7,101 |
| **Entrepreneur** | **0** | **0%** | **0** |

Note: Parent overlaps heavily with other buckets — only 90 questions resolve to Parent alone (the rest share their tag with Counselor/Teacher/Student).

## Completeness classification (persona field)
| Class | Count | % |
|---|---:|---:|
| Present (exactly one bucket) | 10,639 | 34.7% |
| Ambiguous (2+ buckets) | 16,510 | 53.9% |
| Missing (no persona on tag) | 3,489 | 11.4% |
| Conflicting | 0 | 0% |

## Critical findings
1. **Entrepreneur = 0 coverage (RED).** The entire concern ontology the bank derives from contains **no** Entrepreneur/Founder/Business-owner persona. No question in the bank can serve an entrepreneur persona. This is a hard gap, not a derivation artifact.
2. **Persona is ambiguous for the majority (53.9%).** Because one bridge tag serves many personas, a question tagged `EXAMINATION_STRESS` is simultaneously a Student, Parent, Teacher and Counselor question. Only 34.7% resolve to a single persona.
3. **Counselor coverage is real but skewed** — 7,101 of its 8,337 reach is single-bucket, meaning a sizeable curated set of counselor-specific concerns exists, unlike Parent/Teacher which are almost always shared.

## Verdict — RED for persona
- One of the six required personas (Entrepreneur) is completely uncovered.
- Persona is unambiguous for only ~1 in 3 questions. A per-question persona tag (or persona-scoped bridge tags) is required to make persona targeting reliable.
