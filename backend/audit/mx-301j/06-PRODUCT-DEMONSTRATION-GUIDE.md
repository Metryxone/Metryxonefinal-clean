# MX-301J — Product Demonstration Guide

_Generated 2026-06-26T03:26:43.088Z · how to demonstrate each certified capability live_

> This guide walks an evaluator through the platform so each of the 14 dimensions can be
> seen first-hand. Where a dimension is honestly dormant/abstained, the guide says so.

## 0. Access

- **Frontend:** the running web app (preview pane).
- **Super Admin login:** username `user_masked` / password `admin123`.
  - Login is **always 2FA-gated**. A 6-digit code is emailed (Zoho) when configured; in dev with no email channel the code is logged to the `Backend API` workflow console as `[DEV MFA] …` (never returned in the HTTP response). Enter it to complete login.

## 1. Platform Implementation & Super Admin
- Open the **Super Admin Dashboard** → the panels (frameworks, modules, ontology, reports) demonstrate the structural surface that scores 100% structural readiness.

## 2. Assessment Quality (CAPADEX + Competency)
- Run the **Free Assessment** (CAPADEX) flow: intro → analyse → clarify → preview → questions → result → report.
- In Super Admin → **Question Factory** see the draft pipeline vs human-approved (assessment-ready) split — the Coverage ⟂ Confidence story.

## 3. Career Intelligence
- Open **Career Builder** → Assessment, Gap Analysis, Roadmap, Jobs, Mentors tabs; the Career Passport surfaces a shareable snapshot (contact never published).

## 4. Employer Intelligence
- Open the **Employer Portal** → post a job, view candidate matching, interview & hiring intelligence. _Live adoption is honestly 0 — demonstrate with the seeded demo employer/candidate, which is @example.com-isolated._

## 5. Report Quality (Report Factory)
- In Super Admin → **Reports Console** generate/preview reports; all 16 report types compose with the 9 required sections and pass the no-empty guard.

## 6. Security & Governance
- Demonstrate the **2FA-gated super-admin login** (password alone is never sufficient). Governance console shows RBAC roles/permissions and the audit trail.

## 7. Outcome Confidence (honest abstention)
- Show the **Outcome Intelligence** panel: it ABSTAINS (no accuracy claim) until ≥30 realized outcomes accrue. This is the honesty-over-optimism principle made visible.

## 8. Where to see the certification itself
- The six MX-301J deliverables live in `backend/audit/mx-301j/`. Start with `01-FOUNDER-EXECUTIVE-REPORT.md`.
