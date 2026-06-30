# 10 · Remaining Persona Gaps (classified)

Gap severity: **Launch-Critical · High · Medium · Low · Future.** Honesty: a gap is only Launch-Critical if it
**breaks a live flow / crashes / mis-routes a real user / fabricates data**. Content-depth and granularity gaps are
High/Medium; cosmetics are Low; blueprint-deferred verticals are Future. Coverage ⟂ Confidence kept separate.

## 🔴 Launch-Critical — NONE (honest)

No persona gap meets the Launch-Critical bar. Specifically, the audit found **no orphan persona, no duplicate
*product*, no broken/crashing reference, and no mis-routing** of a real user:
- The 14 UI sub-personas → 6 `PersonaKey`s mapping is **total** (`IntroPhase.tsx:137-168`).
- Unmatched `cohort-gating` keys fall back safely to `'professional'` (`cohort-gating.ts:111`) — no crash.
- Legacy label variants are **display-only** (`CapadexRegisterPhase.tsx:122-124`) — no routing impact.

*(Stating "none" honestly rather than manufacturing a critical gap.)*

## 🟠 High

| ID | Gap | Evidence | Impact |
|---|---|---|---|
| G-H1 | **Exam-aspirant behavioural collapse** — JEE/NEET/CUET/Competitive all → generic `student` behavioural bank | `IntroPhase.tsx:147`, `behavioural-insights.ts:247` | Marketed distinct exam personas are behaviourally identical; no exam-tailored insight |
| G-H2 | **CUET has no UI label** — folded into "JEE/NEET/UPSC aspirant" | `IntroPhase.tsx:146-148` | A named spec persona is not selectable |
| G-H3 | **Career-Transition collapse** — `career_transition_professional` & `career_explorer` → `jobseeker` bank | `IntroPhase.tsx:148,158` | Fresher / Job-Aspirant / Career-Transition share one bank |

## 🟡 Medium

| ID | Gap | Evidence | Impact |
|---|---|---|---|
| G-M1 | **Counsellor collapse** — `academic_counsellor`/`placement_cell` → `teacher` bank; PIL has a distinct `counselor` lens but no bank | `IntroPhase.tsx:167-168`, PIL | Lens↔bank asymmetry; no counsellor-specific items/report |
| G-M2 | **Cohort-key drift** — `SUB_PERSONA_TO_TRACK` (16 entries) keys ⧣ IntroPhase sub-persona ids (dead keys; `career_transition_professional` absent) | `cohort-gating.ts:38-46` vs `IntroPhase.tsx:137-168` | Harmless fallback today; latent confusion / silent mis-cohorting if a key is reused |
| G-M3 | **DB-adaptive persona breadth** — `adaptive_question_bank.persona` ∈ {student,parent,professional} only | DB schema | campus/jobseeker/teacher get static-only (no adaptive) — Coverage gap, not a break |
| G-M4 | **AI lens granularity** — `campus`/`jobseeker` borrow professional/student PIL lens (5 lenses < 6 keys) | `runtime-guidance-engine.ts` | Borrowed AI voice for 2 personas |

## 🔵 Low

| ID | Gap | Evidence | Impact |
|---|---|---|---|
| G-L1 | **Legacy display-label sprawl** — `job_seeker`/`jobseeker`/`individual` | `CapadexRegisterPhase.tsx:122-124` | Cosmetic; one canonical label map would tidy |
| G-L2 | **Label inconsistency** — IntroPhase "Parent" vs `PERSONAS` "Parent / Guardian" | `IntroPhase.tsx:165`, `behavioural-insights.ts:208` | Minor copy drift |

## ⚪ Future (blueprint-deferred — DO NOT CLAIM until built)

| ID | Gap | Blueprint status |
|---|---|---|
| G-F1 | **Enterprise personas as first-class** (Manager / Leadership / L&D dedicated surfaces) | PARTIAL (`07:121-122`) |
| G-F2 | **Faculty first-class** (currently nested in institute) | PARTIAL / GAP-J3 (`07:119`) |
| G-F3 | **Teacher/Counsellor downstream journey** (dead-end today) | GAP-J1 (`07:120`) |
| G-F4 | **Parent & Mentor journey tail** (support-action / engagement loop) | GAP-J2 (`07:123-124`) |
| G-F5 | **Realized-outcome capture** per persona (placement/hire/promotion/exam) | forward-work, k_min=30 (`08`) |
| G-F6 | **Dedicated verticals: Government · Healthcare · Psychologist/Clinical** | MISSING — **DO NOT CLAIM** (`07:127-128`) |

## Final validation statement

**Repository ≈ Product Blueprint for Personas on the structural axis:** ONE canonical market model (P1–P9) + ONE
runtime enum (6 `PersonaKey`) with a total mapping, Persona≠Role honored, no orphan/duplicate-product/broken
reference. **Remaining divergences are content-depth (High), granularity/drift (Medium), cosmetics (Low), and
blueprint-deferred verticals (Future).** No Launch-Critical persona gap exists. **STOP — human approval required**
before implementing any alignment from `09`.
