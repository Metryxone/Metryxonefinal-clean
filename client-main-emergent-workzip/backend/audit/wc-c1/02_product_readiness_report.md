# WC-C1 · Deliverable 2 — Product Readiness Report
_Generated 2026-06-10T05:14:29.718Z. Build maturity of each product (distinct from monetization wiring — see deliverable 04 §monetization & the Product Monetization metric)._

**Product Readiness (build maturity): Structural 91.4% (32/35 over 7 products).** Build maturity is HIGH; this is independent of whether a purchase path is wired (it mostly is not).

| Product | Structural | Runtime surface | Activation path | Reporting path | Live data |
|---|---|---|---|---|---|
| CAPADEX (entry assessment) | real (5/5) | ✅ | ✅ | ✅ | 27 sessions / 9 completed |
| LBI | real (5/5) | ✅ | ✅ | ✅ | lbi_sessions=0 |
| Employability Index | real (5/5) | ✅ | ✅ | ✅ | career_seeker_profiles=2 |
| Employability Passport | gated-real (4/5) | ✅ | ✅ | ✅ | flag-gated; snapshot in profile JSONB |
| Career Builder | real (5/5) | ✅ | ✅ | ✅ | career_seeker_profiles=2 |
| Mentor Intelligence | partial (3/5) | ✅ | ❌ | ❌ | mentor_profiles=0; mentor_bookings table ABSENT |
| Longitudinal (repeat-assessment trend) | real (5/5) | ✅ | ✅ | ✅ | repeat-session users drive the longitudinal trend; "Mastery" itself is the CAP_MAS stage code, not a separate product |

## Honest findings
- **LBI, Employability Index, Career Builder, Mastery/Longitudinal, CAPADEX entry are REAL** (full engines + activation + reporting). **Mentor Intelligence is PARTIAL** — a matching interface over static catalogs; the live booking substrate (`mentor_bookings`) is **ABSENT** and `mentor_profiles=0`.
- **"Curiosity / Growth / Mastery Intelligence" are NOT separate products** — they are CAPADEX **stage codes** (CAP_CUR/CAP_GRW/CAP_MAS), the gears inside the assessment runtime.
- **Build maturity ≠ live usage.** Several real engines have thin live data (`lbi_sessions=0`, `career_seeker_profiles=2`) — a cold-start, not a build gap.

## Coverage vs Confidence
- **Coverage** (engine exists): HIGH (91.4%). **Confidence** (proven at live scale): LOW–MEDIUM — most products carry little live data.
