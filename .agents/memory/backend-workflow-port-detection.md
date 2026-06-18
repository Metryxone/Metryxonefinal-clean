---
name: Backend API workflow port-detection failure
description: Why restart_workflow false-fails the Node backend on port 8080, and the configureWorkflow cure.
---

# `Backend API` workflow won't stay up (false DIDNT_OPEN_A_PORT)

`restart_workflow` (and the `restart_workflow` tool) kept reporting
`DIDNT_OPEN_A_PORT` and SIGKILLing the Node backend even at long timeouts —
**even though the server boots fast (~7–15s) and prints `Server listening on 8080`.**

**Root cause:** the port the workflow waits on must have a matching `.replit`
`[[ports]]` entry for detection to work. The other workflows that detect fine
(5000, 8000) each have a `[[ports]]` mapping; 8080 had none. Direct `.replit`
edits are **blocked** ("port mappings owned by a different tool").

**Why:** port mappings are owned by the managed workflow tooling, not hand-editable.

**How to apply:** re-register the workflow through `configureWorkflow`
(workflows skill, via code_execution) with `waitForPort: 8080`,
`outputType: "console"` — this registers the port mapping the managed way and the
workflow then starts and is detected correctly. Do NOT spam `restart_workflow`;
do NOT try to hand-edit `.replit [[ports]]`. Background bash-launched backends do
NOT survive (the tool reaps them) — only a real workflow persists. Supported
console ports: 3000–3003, 4200, 5173, 6000, 6800, 8000, 8008, 8080, 8099, 9000.
