---
name: Certification flag-set must match the live workflow
description: How to honestly raise a flag-gated cert's Activation / journey-reachability / Adoption axes
---

# A flag-gated certification composer must run with the LIVE workflow's flag-set

A flag-gated cert composer reads `isFlagEnabled` off `process.env` AT RUN TIME.
Running it with a *truncated* `FF_*` set makes Activation, employer-journey
reachability, and Adoption read artificially low — a measurement artifact, not a
real gap.

**Why:** `isFlagEnabled` resolves a camelCase key to `FF_`+UPPER_SNAKE
(`key.replace(/([A-Z])/g,'_$1').toUpperCase()`). If a built subsystem's flag is
absent from the process env, its subsystem reads "not activated" and any
stage/journey gated on it reads unreachable.

**How to apply (the only honest levers — never fabricate to move these):**
- **Activation** = a subsystem's gating flag is ON. To raise it for real, the flag
  must be ON in the *actual* backend workflow command (not just the composer run),
  so the running app is genuinely activated; then run the composer with the SAME
  flag-set so the cert mirrors reality. Built-but-dormant additive subsystems are
  the legitimate rollout candidates (they are structurally PASS, byte-identical-OFF).
- **Journey reachability** = ALL stage flags ON AND every required table present.
  Probe `to_regclass` first — if the schema already exists, reachability is purely
  flag-capped.
- **Flipping a flag must NOT seed data.** Verify dormant adoption pipes stay at 0
  after activation; any Adoption rise must trace to pre-existing genome/config rows,
  never to flag-triggered writes.

**Axes that cannot reach 100% without fabrication (report honestly, refuse to force):**
- Assessment approval depth — human approval is the only coverage-changing op (no
  bulk auto-approve).
- Employer/realized adoption — needs real customer usage.
- Knowledge content depth — needs `OPENAI_API_KEY` or an SME; no machine source to
  invent indicators from.
- Outcome confidence — abstains below k_min realized {pred,outcome} pairs by design.

**Reversibility:** flag additions live in the workflow command (`.replit` /
`configureWorkflow`), not code. Restart the backend via
`configureWorkflow({waitForPort:8080, outputType:"console"})` — a plain restart
false-fails `DIDNT_OPEN_A_PORT` without the 8080 port mapping.
