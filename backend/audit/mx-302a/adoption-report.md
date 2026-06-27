# MX-302A — Career Launchpad Adoption (read-only measurement)

_Generated: 2026-06-27T02:22:04.646Z_

> **Two independent axes, never composited.** The *structural* axis below is the
> routing-contract certification (read verbatim from `validation-results.json`).
> The *adoption* axis is measured live against the DB. A green structural verdict
> says the routing is correct; it says **nothing** about how many real users have
> picked a stage. `null` means *cannot measure* (the surface was never provisioned
> here) and is kept distinct from `0` (*wired, but nobody has done it yet*).

## Flag
- `FF_CAREER_LAUNCHPAD` enabled in this measurement process: **true**
- Adoption only accrues when the flag is ON in the **live Backend API workflow**
  (turning it on in this script alone does not register users).

## Structural axis (context only — not merged into adoption)
- Verdict: **PASS** (10/10 checks)

## Provisioning probes (null ≠ 0)
- `career_seeker_profiles` table present: **true**
- `career_stage` column provisioned: **false**
  _(column is created lazily only on the flag-ON path / via migration — absent here means the flag has never run ON against this DB)_
- `platform_audit_log` table present: **true**

## Adoption axis — verdict: **UNMEASURABLE**
> The stage surface has not been provisioned against this DB, so adoption is **`null` (unmeasurable)** — explicitly NOT zero. Re-run after launch with the flag ON.

### Real seekers who chose a stage
- Count: **null (unmeasurable)**

### By career stage
- null — not measurable (table/column absent)

### By effective experience landed on
- null — not measurable (table/column absent)

### Registration routing trail (audit: `career_stage` creates)
- Total routed at sign-up: **0**
- (all zero — surface is wired but no real user has done this yet)

### Experience switching (audit: `career_experience` updates)
- Total switches: **0**
- Distinct users who switched: **0**
- Switches per switching user: **null (unmeasurable)**
- Switched TO, by experience:
- (all zero — surface is wired but no real user has done this yet)

---
_Read-only. Demo/@example.com rows excluded from every count. PII never written —
only stage/experience aggregates._
