---
name: Candidate CRA → precise competency ledger bridge
description: How the candidate-facing CRA assessment populates onto_competency_score_runs so the Precise Competency Scores section shows for live candidates.
---

# Candidate CRA → precise competency ledger bridge

The candidate assessment (`POST /api/competency/run-assessment` in
`backend/routes/competency-assessment-runtime.ts`) writes only `cra_scores`
(domain-grained, keyed by user id). The Precise Competency Scores section
(`GET /api/competency/precise-scores`) reads `resolveUnifiedCompetencyProfile`,
which surfaces ONLY competency-granularity rows from `onto_competency_score_runs`
keyed by EMAIL. So precise scores stayed hidden for every live candidate until a
bridge wrote that ledger.

The bridge: after the `cra_scores` INSERT, additively write ONE
`onto_competency_score_runs` row (source `candidate_cra_crosswalk`) from the
just-submitted CRA scores.

**Why the crosswalk is honesty-critical:** CRA bank codes (COG01…) are a SEPARATE
namespace from the `comp_*` genome. A precise score must be a genuine genome
competency. Two kinds of mappings qualify (both hand-verified): EXACT name match
modulo hyphen/case, and CURATED synonym match (a different name for the SAME
construct). **17 of 20 are mapped** (Task #143 added 5 curated synonyms on top of
the original 12):
- Original 12 (exact): critical_thinking, problem_solving, decision_making,
  written_communication, active_listening, team_leadership, project_management,
  accountability, learning_agility, resilience, self_awareness, conflict_resolution.
- Task #143 curated synonyms: Analytical Reasoning→`comp_analytical_thinking`,
  Innovation Mindset→`comp_innovation`, Self-Regulation→`comp_emotional_regulation`
  (Goleman EI), Technical Expertise→`comp_technical_competence`,
  Coaching & Mentoring→`comp_coaching` (dominant construct).

The remaining 3 are DOCUMENTED OMISSIONS (no genuine genome equivalent — mapping
would misrepresent, so they show in the domain breakdown but never as a precise
score): **Verbal Communication** (genome has only the umbrella "Communication" +
channel-specific "Written Communication", no verbal/oral comp), **Change
Leadership** (genome has only "Change Management"/"Change Advocacy", distinct
constructs), **Digital Fluency** (genome has only "Technology Adoption", a
different construct). Existence is re-verified at write time (skip stale ids); a
"close but different" construct is NEVER mapped just to raise the count.

**How to apply / traps:**
- The write subject and the precise-scores read subject MUST resolve identically
  (session `username` if it contains `@`, else DB `users.email`/`username`) — use
  ONE shared `resolveSubjectEmail`, or a candidate writes a row they can't read.
- Gate the write behind `isCompetencyRuntimeEnabled()` (same flag as the read) AND
  conditionally-spread the `precise` response field so flag-OFF is byte-identical.
- Never-throws: the row is additive and `cra_scores` is already persisted, so a
  bridge failure must not fail the submission.
- The resolver reads the LATEST run per subject, so re-submission just appends
  (latest wins) — no dedup needed.
- `competency_scores` entry fields the resolver reads: `competency_id`,
  `competency_name`, `normalized_score`, `level`, `level_label`, `level_status`;
  overall jsonb uses `overall_score`/`overall_level`. `source` is varchar(30).
