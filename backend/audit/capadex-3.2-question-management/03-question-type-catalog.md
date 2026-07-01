# CAPADEX 3.0 · Program 3 · Phase 3.2 — Question Type Catalog (29 types)

> Deliverable 03 · Generated 2026-07-01T07:48:38.862Z · Source of truth: `scan.json` (read-only repo+DB scan, sha256:ad51a1f32457, written 2026-07-01T07:48:38.866Z).
> Honesty: the EIGHT certification dimensions (platform · library · metadata · governance · version_management · workflow · apis · frontend) are reported SEPARATELY and NEVER composited. Adoption is a SEPARATE usage axis, never a gap. Coverage⟂Confidence⟂Adoption; null ≠ 0; never fabricated.

ONE canonical catalog of **29 question types**. Status is honest: **SUPPORTED** = a real renderer/bank authors + scores this type today; **PARTIAL** = registered in the canonical catalog (the platform accepts + validates the type via the metadata standard) but no dedicated renderer authors it yet — an ADOPTION gap, never fabricated as rendered. Per-type PARTIALs are a sub-inventory under `platform` and do NOT create dimension gaps.

**Status:** 14 SUPPORTED · 15 PARTIAL · 0 DEAD_END · 0 MISSING.

| Type | Family | Status | Note |
|---|---|---|---|
| **Likert scale** (`likert`) | behavioural | SUPPORTED | Clarity + psychometric banks. |
| **Multiple choice (single answer)** (`mcq_single`) | selected_response | SUPPORTED | Competency + exam banks. |
| **Multiple choice (multi-select)** (`mcq_multi`) | selected_response | SUPPORTED | Competency/exam banks. |
| **True / False** (`true_false`) | selected_response | SUPPORTED | Exam bank. |
| **Scenario** (`scenario`) | behavioural | SUPPORTED | Psychometric + clarity. |
| **Situational judgment (SJT)** (`situational_judgment`) | behavioural | SUPPORTED | Psychometric bank. |
| **Rating scale** (`rating_scale`) | behavioural | SUPPORTED | Clarity confidence scale. |
| **Open text / free response** (`open_text`) | constructed_response | SUPPORTED | Interview + narrative. |
| **Short answer** (`short_answer`) | constructed_response | SUPPORTED | Interview. |
| **Numeric entry** (`numeric`) | constructed_response | SUPPORTED | Exam bank. |
| **Forced choice (ipsative)** (`forced_choice`) | behavioural | SUPPORTED | Persona / SJ. |
| **Semantic differential** (`semantic_differential`) | behavioural | PARTIAL | Catalog-registered; no dedicated renderer yet. |
| **Ranking / prioritisation** (`ranking`) | selected_response | PARTIAL | Catalog-registered. |
| **Slider / continuous** (`slider`) | behavioural | PARTIAL | Catalog-registered. |
| **Essay / long response** (`essay`) | constructed_response | PARTIAL | Catalog-registered. |
| **Fill in the blank / cloze** (`fill_blank`) | constructed_response | PARTIAL | Catalog-registered. |
| **Matching** (`matching`) | selected_response | PARTIAL | Catalog-registered. |
| **Ordering / sequencing** (`ordering`) | selected_response | PARTIAL | Catalog-registered. |
| **Matrix / grid** (`matrix`) | selected_response | PARTIAL | Catalog-registered. |
| **Image choice** (`image_choice`) | selected_response | PARTIAL | Catalog-registered. |
| **Hotspot / region select** (`hotspot`) | performance | PARTIAL | Catalog-registered. |
| **Drag & drop** (`drag_drop`) | performance | PARTIAL | Catalog-registered. |
| **Code / programming** (`code`) | performance | PARTIAL | Employability MCQ exists; sandboxed exec deferred. |
| **Audio response** (`audio_response`) | performance | SUPPORTED | Voice screening (employer). |
| **Video response** (`video_response`) | performance | SUPPORTED | Avatar interview channel. |
| **File upload / portfolio** (`file_upload`) | performance | PARTIAL | Portfolio exists; not a scored item type yet. |
| **Case study (multi-part)** (`case_study`) | constructed_response | PARTIAL | Catalog-registered. |
| **Adaptive / branching** (`adaptive_branching`) | adaptive | SUPPORTED | Adaptive questioning engine. |
| **Composite / testlet** (`composite`) | adaptive | PARTIAL | Catalog-registered. |
