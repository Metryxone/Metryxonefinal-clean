# WC-L0D Deliverable 1 — Namespace Alignment Report
_Generated 2026-06-09T14:43:30.470Z_

WC-L0C established the root cause: the behaviour **projection** matches construct dimensions by regex
over **positive-construct / `self_*` signal keys**, but the activation **runtime** emits ONLY
concern-diagnostic signal keys. The two vocabularies never intersect, so motivation / confidence /
engagement / adaptability are structurally NULL. WC-L0D aligns the two namespaces by ROUTING the
EXISTING concern signal keys to the EXISTING construct dimensions as a **polarity-aware DEFICIT**.

## The map (polarity-aware, deficits only)
A present concern signal can only **lower** a construct: `value = min(50, round(100 − strength))`.
The neutral cap (50) is the canon guard — a concern signal can mark a construct as impaired
(≤ neutral) but can NEVER assert an above-neutral strength; positive strengths continue to come
exclusively from the positive regex path / CSI `positive_factors`. NO new construct / dimension /
ontology / scoring model is introduced — only existing signals routed to existing dims.

| Runtime signal key | Construct dimension | Polarity | Provenance |
|---|---|---|---|
| `avoidance_pattern` | motivation | deficit (value = min(50, 100 − strength)) | spec-mandated |
| `career_confusion` | motivation | deficit (value = min(50, 100 − strength)) | spec-mandated |
| `social_withdrawal` | confidence | deficit (value = min(50, 100 − strength)) | spec-mandated |
| `placement_anxiety` | confidence | deficit (value = min(50, 100 − strength)) | spec-mandated |
| `cognitive_blocking` | adaptability | deficit (value = min(50, 100 − strength)) | spec-mandated |
| `emotional_overload` | engagement | deficit (value = min(50, 100 − strength)) | spec-mandated |

## Live runtime signal inventory (what the runtime actually emits) + routing decision
| signal_key | rows | rows w/ strength | avg strength | routing |
|---|---|---|---|---|
| `rapid_answer` | 7 | 0 | — | UNMAPPED — emitted with NULL strength (no deficit magnitude to inverse-code) |
| `rapid_answer_pattern` | 1 | 0 | — | UNMAPPED — emitted with NULL strength (no deficit magnitude to inverse-code) |
| `GENERAL_CONCERN` | 1 | 1 | 1.000 | UNMAPPED — non-specific catch-all (no single construct) |
| `cognitive_blocking` | 1 | 1 | 0.600 | → **adaptability** (deficit) |
| `placement_anxiety` | 1 | 1 | 0.565 | → **confidence** (deficit) |
| `emotional_overload` | 1 | 1 | 0.677 | → **engagement** (deficit) |
| `prolonged_hesitation` | 1 | 0 | — | UNMAPPED — emitted with NULL strength (no deficit magnitude to inverse-code) |
| `career_confusion` | 1 | 1 | 0.562 | → **motivation** (deficit) |
| `social_withdrawal` | 1 | 1 | 0.558 | → **confidence** (deficit) |
| `avoidance_pattern` | 1 | 1 | 0.820 | → **motivation** (deficit) |

### Why the unmapped keys are NOT mapped (honesty, not omission)
- **`GENERAL_CONCERN`** — a non-specific catch-all that does not identify a single construct;
  mapping it to any dimension would fabricate a signal. Left UNMAPPED.
- **`rapid_answer` / `rapid_answer_pattern` / `prolonged_hesitation`** — latency telemetry
  emitted with **NULL strength**, so there is no deficit magnitude to inverse-code. Left UNMAPPED as
  future *curated* candidates (they would need a real strength before they could deficit-code a dim).

> The 6 mapped keys cover **100% of the SPECIFIC concern signals that carry a readable strength** on
> the live base. `GENERAL_CONCERN` is excluded *despite* having a readable strength because it is a
> non-specific catch-all that identifies no single construct — so the conservative map loses no
> measurable construct coverage while staying fully grounded.

## Reversibility
Gated by `FF_BEHAVIOUR_NAMESPACE_ALIGNMENT` (default OFF). Flag OFF → the deficit block is skipped →
`projectBehaviour` is byte-identical to legacy (construct dims NULL). This report is a **read-only
simulation** of flag-ON over the live graphs; nothing was written.
