---
name: WC-3 L5B Context Intelligence audit
description: What the question bank looks like along the "life-context" axis, and the traps in auditing it.
---

# WC-3 L5B — Context Intelligence (auditing the life-context axis)

"Context" = the real-world situation a learner is in (AI Job Disruption, Career Transition,
Placement, Family Pressure, Competitive Exam, Entrepreneurship, Leadership, Digital
Behaviour, Employability, Career Clarity) — **orthogonal to** concern (what they struggle
with) and stage (L5A). Audited read-only over clarity (30,638) + concerns_master (2,489).

## Durable findings / decisions
- **There is NO explicit context field.** `domain` is a 351-value fragmented long tail
  (most size-1); `contextual_modifier` is capability-flavoured; `common_indian_context` is
  genuine but sparse free-text. Context must be a DERIVED sidecar (like L5A stage), keyed by
  clarity SERIAL `id` (not the non-unique `question_id`), flag-gated, byte-identical OFF.
- **~80% of questions match ZERO context** — the bank is generic behavioural/emotional items.
  This is the dominant fact. Most of that 80% is *legitimately* context-neutral; force-tagging
  it would be fabrication. So any context layer's coverage ceiling is structurally ~half.
- **Relevance risk is real and lexicon-driven.** Broad keywords over-count badly: Leadership
  loose `lead|manage|influence` = 2,803 but tight `leadership|leader|team lead|delegate` ≈
  1,154 (~59% noise, incl. "lead to"); Digital `phone|online|digital` ~44% low-relevance.
  Always probe tight-vs-loose and carry a `context_explicit` flag — never report the loose
  count as coverage.
- **Two drift modes:** ambient (Leadership/Exam/Family/Clarity/Employability) are smeared
  across 100–428 concerns with <7% top-concern share → fix is TAGGING not content; shallow
  (AI/Career Transition/Entrepreneurship) are concentrated but near-empty → genuine AUTHORING
  gaps. Entrepreneurship + AI are absent from almost every major domain.

## Method that worked
- Word-boundary regex (`~* '\y…\y'`) over `question||concern` and
  `display_label||concern_search||common_indian_context||domain`; never bare substring
  (`ai` matches `fail`). Bridge tag = routing unit for "availability" (picker joins on it).
- **Top-N gap matrix** = (concern domains with ≥8 concerns) × contexts, joined to clarity via
  `master_bridge_tag = relational_bridge_tag`, list zero-coverage cells ranked by domain size.
- QIS Context dim weight = 0.10 (L5 master §1.4). Honest projection: ~1.0→~4.2 of 10 pts
  (+3–4 system-wide) — bounded BECAUSE of the 80% legitimately-neutral mass; don't inflate.

## Implementation lessons (L5B built)
- **Bridge-tag corroboration text MUST be `common_indian_context` ONLY.** First cut aggregated
  `string_agg(display_label || concern_search || common_indian_context)` per bridge tag — but
  one tag fans out to many concerns, so that blob matches many context lexicons at once and
  manufactured **7,797 false UNRESOLVED ties (25%)** (the "ambient smear" the audit predicted).
  Restricting to the sparse `common_indian_context` killed it.
- **Resolve in two stages, explicit-first.** (1) Question-anchored ("explicit") contexts decide
  the tag; a genuine explicit *score* tie → UNRESOLVED **regardless of tier** (don't let the
  Tier-1-before-Tier-2 tiebreak fabricate a primary under ambiguity). (2) Only when NO explicit
  fired, use inherited `common_indian_context`, and tag ONLY when exactly ONE inherited context
  matches; inherited multi-match → GENERAL (decline, never fabricate). This put the final mix at
  GENERAL 73.7% / UNRESOLVED 107 (0.35%) / resolved 25.9% over 30,638 — matching the audit's
  ~80%-neutral / ~1%-overlap expectation. Domain stays booster-only (never tags or breaks ties).
- **Read-metrics fn must NOT ensure/auto-create the table.** A read endpoint that calls
  ensure-schema masks "not built yet" as zeroed metrics. Detect via `to_regclass` + non-empty
  count; return null when absent/empty so the route emits the honest `degraded` envelope.

## How to apply
Built: flag `FF_WC3_CONTEXT_INTEL` default OFF, table `wc3_question_context`, engine
`services/wc3/question-context-intelligence.ts`, builder `scripts/wc3/build-question-context.ts`,
read route `GET /api/capadex/question-intelligence/context/metrics`. Doc at
`backend/audit/wc-3/WC3_L5B_CONTEXT_INTELLIGENCE.md`; deltas at `…/WC3_L5B_DELTAS.md`.
