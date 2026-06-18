# Competency Assessment — World-Class Roadmap

**Audit:** MX-COMPETENCY-WORLDCLASS-LAUNCH-CERTIFICATION-100X · 18 Jun 2026
**Premise:** ~70% of the gap to world-class is **evidence + population**, not engineering. The architecture is largely built; it must be **activated and validated** with real data. This roadmap sequences the path from **Beta/Pilot → Launch → World Class.**

---

## Guiding principle: the Validity Flywheel

```
Activate live data ─► Run real pilots ─► Capture responses + OUTCOMES
        ▲                                          │
        │                                          ▼
   Publish norms ◄─ Compute α/IRT/DIF ◄─ Reach N≥300 / k≥30 cohorts
```
Each turn lifts Activation and Validity — the only two axes capping the composite. No amount of new code lifts them.

---

## Stage 0 — Pre-Pilot Activation (weeks 0–4) → unlock Pilot

| Action | Lifts | Done when |
|---|---|---|
| Populate a governed item bank live (retire static-bank dependence) | Question, Engine activation | `competency_question_templates > 0` live, adaptive engine drawing from DB |
| Import O*NET into live DB | Ontology, Role Mapping | `ont_*`/`map_role_competency` populated; >50 roles weighted |
| Activate LBI/SDI taxonomy live | Framework | `lbi_clusters`/SDI hierarchy > 0 |
| Activate Employability Index | EI Dependency | `mei_scores > 0` for pilot cohort |
| Isolate dev/prod DB; add email redundancy; add crisis human-notify | Operational/Scale/Safety | prod DB separate; MFA fallback; crisis alert routed to a human |

## Stage 1 — Institution + Gated Employer Pilots (months 1–3) → gather evidence

| Action | Lifts |
|---|---|
| Run 1–2 paid institution concierge pilots (full cohorts) | Institution Value, Commercial proof |
| Run 1 gated employer talent-intelligence pilot (no hiring verdicts) | Employer Value |
| Instrument outcome capture (placement/EI-lift/hire) from day 1 | Outcome Validation |
| Reach k≥30 in ≥1 cohort | Benchmark activation |
| Reach N≥300 responses on priority competencies | Calibration readiness |

## Stage 2 — Empirical Validation (months 3–6) → reach Launch

| Action | Lifts |
|---|---|
| Compute & **publish** Cronbach α, SEM, IRT calibration on real sample | Assessment Science → Validity |
| Run DIF / measurement-invariance / adverse-impact on real data | Fairness validity |
| Build segment norms (now that k≥30 exists) | Benchmark, Norm-referencing |
| First criterion-validity analysis (scores ↔ early outcomes) | Outcome Validation |
| Convert pilots to paid subscriptions; observe first renewals | Commercial readiness |
| Produce a technical/validity manual for buyers | Competitive, Enterprise |

## Stage 3 — Scale & Enterprise Hardening (months 6–12) → approach World Class

| Action | Lifts |
|---|---|
| Async scoring pipeline, read replicas, migration-led deploy, caching | Scale (10k→100k) |
| SOC2/ISO/DPA, RBAC hardening, SLAs, ticketing, /health + alerting | Operational, Enterprise |
| ESCO + LinkedIn-style market-graph interoperability | Competitive parity |
| Expand calibrated bank to thousands of items; AI/Green/Future packs | Question/Framework depth |
| Independent third-party psychometric review | Validity credibility |
| Publish outcome-correlation study with real N | Predictive validity (the world-class unlock) |

---

## Milestone → Verdict mapping

| Milestone | Resulting verdict |
|---|---|
| Stage 0 complete | Institution & Employer **Pilot Ready** (activated) |
| Stage 1 complete | Pilots producing evidence; Student/Professional **Pilot Ready** |
| Stage 2 complete | **Launch Ready** (published α/validity, norms, first outcomes, first renewals) |
| Stage 3 complete | **World Class** candidate (scaled, compliant, outcome-validated, independently reviewed) |

---

## The three things that actually decide world-class

1. **Realised outcomes** (criterion/predictive validity) — without these, never world-class.
2. **Published reliability/validity + norms** on a real sample.
3. **Activated, calibrated bank + ontology + EI** in the live DB.

Everything else (scale, compliance, depth) is necessary but secondary. **Build less; validate more.**
