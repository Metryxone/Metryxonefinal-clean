---
name: Certification flag-set must match the live workflow
description: Why MX-301J Activation/Functional-Readiness/Adoption read low, and the honest lever to raise them
---

# Certification flag-set must mirror the LIVE Backend API workflow

A flag-gated certification composer (e.g. `mx301j-final-certification.ts`) reads
`isFlagEnabled` off `process.env` AT RUN TIME. If you run it with a *truncated*
`FF_*` set, Activation / employer-journey reachability / Adoption all read
artificially low — that is a measurement artifact, not a real gap.

**The two honest levers (never fabricate to move these):**
1. **Activation** = a subsystem's gating flag is ON. To raise it for real, the flag
   must be ON in the *actual* Backend API workflow command (not just the composer
   run), so the running app is genuinely activated. Then run the composer with the
   SAME flag set so the cert reflects reality.
2. **Employer journey reachability** = ALL stage flags ON **AND** every required
   table present. With the full workflow flag set, all 9 stage-flags are ON; the
   only remaining gate is table presence (probe `to_regclass` first — all 18
   required tables already existed).

**Built-but-dormant subsystem flags that were missing from the workflow**
(camelCase → `FF_`+UPPER_SNAKE via `key.replace(/([A-Z])/g,'_$1').toUpperCase()`):
`roleDnaGovernance`, `onetCrosswalkGovernance`, `questionFactory`,
`adaptiveDifficultyActivation`, `ecosystemActivation`. Adding these 5 to the
workflow (plus the already-present `competencyRuntime`, `careerPassport`,
`liveEmployerEcosystem`, `careerIntelligenceActivation`, `outcomeIntelligenceActivation`)
took Activation 8/15 → 15/15 and employer journey 3/9 → 9/9 reachable.

**Why this is honest, not gaming:** these subsystems are structurally PASS; the
flags are the intended rollout lever. Turning them on did **NOT** seed any data —
the dormant pipes (`cra_scores`, `employer_candidates`, `validation_loop_outcomes`)
stayed at 0 after activation. Adoption rising to 11/15 was pre-existing genome/config
data (Role DNA 318, `map_role_competency` 12,452, genome 422), never flag-seeded.

**What CANNOT reach 100% without fabrication (report honestly, refuse to force):**
- Assessment Quality — needs human approval (the ONLY coverage-changing op); ~120
  approved vs 419 mapped competencies. No bulk auto-approve.
- Employer Intelligence — needs real employer adoption (live `employer_candidates`).
- Knowledge Completion — content depth needs `OPENAI_API_KEY` (missing) or SME;
  ~13/422 competencies carry indicators. No machine source = refuse to fabricate.
- Outcome Confidence — abstains <k_min=30 realized {pred,outcome} pairs by design.

**Reversibility:** the flag additions live in the workflow command (`.replit` /
configureWorkflow), not code. Backend restart via `configureWorkflow({waitForPort:8080,
outputType:"console"})` (plain restart false-fails DIDNT_OPEN_A_PORT without the 8080
mapping).
