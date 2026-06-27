# MX-302B — Career Discovery & AI Guidance: Architecture & Composition Map

_Generated 2026-06-27T02:51:34.832Z · read-only · flag `careerDiscovery` currently **ON**_

Career Discovery is an **additive, flag-gated orchestration layer** that runs BEFORE
Career Builder. It is overwhelmingly composition over engines that already exist — the
only net-new captured data is a light Values inventory.

## Composition map (what each surface reuses)
| Surface | Reuses (existing engine) | Net-new? |
|---------|--------------------------|:--------:|
| Values inventory | — (the ONE net-new assessment: 6 dims, 12 Likert items) | **yes** |
| Discovery battery | competency runtime (`onto_competency_profiles`), CAPADEX, MEI | no |
| Discovery profile | career **match** engine + stored Values + MEI (composed) | no |
| Career Explorer | career **match** + **simulation** engines | no |
| AI Guidance | **recommendation** + **roadmap** + **development** engines + AI coach | no |

## Honesty axes (kept separate, never composited)
- **Coverage** (does the data exist) ⟂ **Confidence** (is it trustworthy/sufficient).
- `null` is never rendered as `0`; an unmeasurable compatibility/match stays `null`.
- Empty states are explicit ("complete the competency assessment to unlock matches").

## Net-new Values inventory
- Dimensions (6): Impact & Purpose, Autonomy & Freedom, Growth & Mastery, Stability & Security, Collaboration & Belonging, Recognition & Status.
- Items: 12 Likert (1..5), 2 per dimension. Pure scorer (no DB, no IO).
- Scorer honesty self-check: **PASS** (empty→measurable=false & all-null; partial→exact coverage, unanswered dims stay null).
