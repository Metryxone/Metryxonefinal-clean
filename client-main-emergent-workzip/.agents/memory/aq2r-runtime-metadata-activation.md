---
name: AQ-2R runtime metadata activation
description: Why a per-question metadata re-rank inside the clarity picker gives only bounded deltas, and how to measure it honestly.
---

# AQ-2R — runtime metadata re-rank value is bounded by the metadata layer's granularity

The AQ-2 per-question metadata (`capadex_question_metadata`, 100% join to clarity
rows) was consumed inside the LIVE clarity picker (`pickQuestionsFromMaster`) to
age/persona/stage/behavior/capability/signal-rank the curated pool, flag-gated
(`runtimeMetadataActivation`, default OFF → byte-identical legacy).

**Key durable finding (measured):** a dimension can only move a *within-pool* re-rank
if it VARIES across that pool. AQ-2 derived `signal_confidence`, `age_band`,
`primary_behavior`, `primary_capability` at **bridge-tag / family granularity** — i.e.
every clarity row under one tag shares the same value (e.g. all `employability` rows
have `signal_confidence = 0.773`; ~44% of the bank has signal 0). Since a concern's
candidate pool is drawn from ONE tag, those dimensions are constant within the pool
and CANNOT change the selection. Only `question_intelligence_score` (QIS), `dev_stage`,
and (partly) `persona_primary` vary per-question. So the honest measured deltas were
Trust +3.8, Relevance +0.7, AIS +0.2, and **Signal 0 / Construct 0 — zero by
construction, not by failure.**

**Why:** raising signal/construct selection-deltas is a DATA-layer change (re-derive
those dims per-question in AQ-2), not a runtime-ranking change. Don't "fix" the 0
deltas by tuning weights — that would fabricate movement the data can't support.

**How to apply:**
- Before claiming a re-rank improves dimension X, measure *within-pool
  differentiability* (% of candidate pools where X has >1 distinct value). If ~0%, X
  is tag-fixed and a within-pool re-rank is a no-op on X — report that honestly.
- Keep ONE shared scorer (`services/question-metadata-ranking.ts`) imported by both
  the runtime picker and the audit harness; the harness shares the scorer + candidate
  gate but deliberately holds the picker's topical-relevance partition / youth-demotion
  constant (orthogonal to the metadata re-rank). Don't overclaim "byte-faithful" beyond
  the scorer math.
- Label SELECTION-AIS as distinct from the AQ-2 BANK-AIS (73.9 = coverage×confidence
  of the whole bank) — they are different units, never compare directly.
- Flag-OFF byte-identical is achieved by making the SQL metadata fragments
  (`metaCols`/`metaJoin`) empty strings when off, so the query text / candidate set /
  ordering are unchanged; join-miss rows score 0 and sort last but are never dropped.
