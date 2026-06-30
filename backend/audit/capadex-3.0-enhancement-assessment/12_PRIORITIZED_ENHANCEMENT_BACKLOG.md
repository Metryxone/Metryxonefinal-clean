# 12 · Prioritized Enhancement Backlog

Ranked enhancement backlog for CAPADEX 3.0, scored on **customer/enterprise value × launch impact ÷ effort &
risk**. Priority bands: **Launch Critical · High · Medium · Low · Future.** All items are enhancement-only
(no redesign, no new architecture, no business-logic change). **This is a recommendation set — STOP for human
approval before any implementation.**

## Tier 0 — Launch Critical (must precede go-live)
| Rank | ID | Enhancement | Effort | Why launch-critical |
|---|---|---|---|---|
| 1 | SE-1 | **Disable demo-mode / placeholder credentials in production** (Razorpay demo, default UPLOAD_SERVICE_TOKEN, @example.com seeds) | S | a live demo-payment or weak token path in prod is a direct trust/financial risk |
| 2 | SE-2 | **Run security scan suite (dependency + SAST + secrets) and triage criticals/highs** | S | cannot sell to enterprise without a clean scan |
| 3 | SE-7 | **DPDP / minor-consent completeness audit** (student/parent) | M | legal gate for the platform's core minor-user base in India |

## Tier 1 — High (greatest value; do early in the enhancement program)
| Rank | ID | Enhancement | Effort | Value |
|---|---|---|---|---|
| 4 | CJ-1 / AC-1 | **Close the assess → intervene → re-test → growth → completion loop** (compositional, no new engine) | M–L | turns a strong diagnostic into a proven-outcome product; #1 retention + differentiation lever |
| 5 | AIE-3 | **AI quality-measurement harness** (uses existing governance tables) | M | converts "validated AI?" from null to measured — the core enterprise-trust gap |
| 6 | AIE-1 | **Consistent AI degradation** for `aiTestGenerator.ts` | S | cheap reliability fix; removes a hard-fail outlier |
| 7 | UXE-1 / TD-1 / PE-1 | **Decompose Employer (10k) & Career (8.7k) monoliths + route code-split** | L | maintainability + regression-safety + first-load perf in one behavior-preserving move |
| 8 | UXE-2 | **WCAG 2.1 accessibility pass** | M | hard enterprise/government procurement gate |
| 9 | PE-2 | **Standardized load-test gate** | M | makes performance measurable before customers arrive (today null) |
| 10 | TD-2 | **CI + coverage gate** (lint + build + isolation + tests) | M | prevents regressions across a 4,000-endpoint surface; enterprise expectation |
| 11 | SE-3 | **Remove residual hardcoded secrets in latent/mirror code** | S | eliminates latent bypass even if dormant |
| 12 | CJ-2 | **Honest empty states across data-dependent stages** | M | protects launch-day trust (no fabricated/zero values) |

## Tier 2 — Medium (post-launch / pilot window)
PC-1 faculty first-class · PC-3 honest "no cohort yet" states · OV-2 deprecate old adaptive · AIE-4 uniform
confidence/evidence · AIE-5 prompt provenance · AIE-6 (= PE-6) AI timeouts+caps · AIE-7 personalization depth ·
UXE-3 mobile QA · UXE-4 bundle reduction · UXE-5 report polish · UXE-6 nav consistency · UXE-7 state
consistency · PE-3 index/N+1 · PE-4 caching · PE-5 scale-readiness · SE-4 rotation evidence · SE-5
pentest/threat-model · SE-6 isolation CI gate · CJ-3 journey continuity · CJ-4 nudges · AC-2 coding-MCQ ·
AC-3 employability retest · TD-3 -v2 cleanup · TD-4 schema canonicalization.

## Tier 3 — Low / Future
PC-2 psychologist lens · PC-4 exec packaging · OV-1 CAPADEX⟂SDI doc · AIE-2 audio-key 503 · TD-5 trim
replit.md · TD-6 dependency hygiene · TD-7 dead-code sweep · PE-7 build-budget alert. **Future (do NOT do
now):** activating any of the 158 OFF flags / MX-700 & MX-800 dormant meta-intelligence engines — governance
only, never force-on.

## Recommended sequencing
1. **Pre-launch (Tier 0 + the cheap Tier-1 wins):** SE-1, SE-2, SE-7, AIE-1, SE-3, CJ-2. Mostly S effort,
   directly gate go-live.
2. **Enhancement program wave 1 (Tier-1 structural):** CJ-1/AC-1 growth loop · AIE-3 AI quality harness ·
   UXE-1/TD-1 monolith decomposition · UXE-2 WCAG · PE-2 load gate · TD-2 CI gate.
3. **Pilot window (Tier 2):** tune perf, polish UX/reports, complete partial personas/journeys — now backed
   by *measured* evidence from the wave-1 harnesses.

---

## The program's core question — answered honestly
> *Is CAPADEX a complete, mature, enterprise-ready, world-class platform — or does it need enhancement first?*

**It is a structurally complete, L3-Managed, honesty-engineered platform that is broad and genuinely strong —
but it is NOT yet "validated, enterprise-proven, world-class," and a focused set of enhancements should
precede that claim.**

- **Complete (breadth): largely YES.** 11/15 personas first-class, 8/9 journey stages built, all major
  assessment/AI/report/security capabilities present. Very little is *missing*.
- **Mature (depth): L3 Managed, NOT higher.** L4/L5 are honestly **WITHHELD** — no runtime-adoption or
  autonomous-optimization evidence exists. That is correct, not a failure.
- **Enterprise-ready: NOT YET — but the gap is small and operational, not architectural.** The blockers are
  demo-mode lockout, a clean security scan, DPDP/minor-consent, WCAG, a load gate, and a CI gate — all
  **enhancement/verification**, none requiring redesign.
- **World-class: ASPIRATIONAL, gated on validation.** Genuinely world-class requires *measured* AI quality,
  *measured* performance under load, and *measured* outcomes from a closed assess→retest→growth loop. The
  enhancements above **instrument exactly that evidence**; world-class can be *claimed only after it is
  measured*, never before.

**Bottom line:** Do **not** redesign. Execute the **Tier 0 launch-critical** items before go-live, then run
the **Tier 1** enhancement wave (growth loop · AI quality harness · monolith decomposition · WCAG · load gate
· CI gate). These mature CAPADEX from "broad and structurally strong" to "validated and enterprise-proven"
**without changing a single business rule.**
