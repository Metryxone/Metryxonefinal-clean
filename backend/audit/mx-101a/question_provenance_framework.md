# MX-101A — Question Provenance Framework

_Generated 2026-06-24T09:18:39.826Z · population engine mx101a-1.0.0 · all numbers measured live._

Every question in the bank carries an immutable provenance stamp and a review status. Generated drafts are `template_generated`; nothing is approved without an explicit human action.

## Provenance breakdown (all bank questions)
| Provenance | Questions |
|---|---|
| template_generated | 2524 |
| human_authored | 44 |
| imported | 34 |

## Review status breakdown
| Review status | Questions |
|---|---|
| pending_review | 2545 |
| approved | 57 |

**Reversibility:** every MX-101A row carries `provenance='template_generated'` and `template_key LIKE 'qf-%'` — a single `DELETE` predicate fully reverses the population run without touching human-authored or imported content.
