---
name: Competency → EI dimension mapping (Phase 3.2)
description: Lessons from building the competency→employability-readiness dimension layer (3 config tables + composing engine).
---

# Competency → EI dimension mapping

Additive, flag-gated under `competencyEi`/FF_COMPETENCY_EI. Three config tables
(`dimension_weight_rules`, `competency_ei_mapping`, `dimension_calculation_rules`)
+ a composing engine that turns Phase-2 domain_proxy competency scores into
5 employability readiness dimensions. Coverage and Confidence are separate axes;
domain_proxy measurement CAPS confidence at 60; unmeasured competencies are never
imputed (a dimension below its min-component gate returns score=null + a reason,
never a fabricated 0).

## pg "inconsistent types deduced for parameter $1"
An `INSERT ... SELECT $1, ... WHERE EXISTS (SELECT 1 FROM t WHERE id = $1)` fails
at runtime with *inconsistent types deduced for parameter $1* when the SAME bind
param feeds two columns of different types — here the INSERT target
`competency_id` is `varchar(120)` but `onto_competencies.id` is `text`.
**Why:** Postgres infers one type per parameter; two conflicting inferred types abort.
**How to apply:** cast every occurrence to one type (`$1::text`, `$3::numeric`).
Manual psql with string LITERALS hides the bug (no params) — reproduce with a
parameterized query, not a literal one.

## never-throws engine = wrap EVERY db read
A "never-throws" compute engine must wrap ALL its DB reads, not just the first
couple. The config + profile reads were guarded but the later edges/join query
wasn't, so a failure there returned 500. Each read's catch should degrade to an
honest non-measurable payload with a `notes` entry.

## lazy ensure-schema must mirror migration CHECK constraints
Byte-identical-OFF / migration-parity isn't only columns: the lazy
`ensure*Schema()` must also carry the migration's CHECK constraints, or a
freshly-provisioned env lacks the canonical guards. Tables already created by an
earlier (constraint-less) ensure-schema won't get them from `CREATE TABLE IF NOT
EXISTS` — `ALTER TABLE ... ADD CONSTRAINT` them when the existing data complies.
