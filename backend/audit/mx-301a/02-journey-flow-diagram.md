# MX-301A — Assessment Journey Flow Diagram

Candidate `user_4286d980cc6cc038` traversal. Each node carries its validated lenses (DB / Engine / API verdict).

```mermaid
flowchart TD
  N1["1. Registration\nDB:ok · measurable · API:wired"]
  N2["2. Authentication\nDB:ok · measurable · API:wired"]
  N3["3. Profile completion\nDB:ok · measurable · API:forbidden_cross_user"]
  N4["4. Role selection\nDB:ok · measurable · API:engine+db"]
  N5["5. Role DNA resolution\nDB:— · measurable · API:flag_gated"]
  N6["6. Adaptive assessment (question engine)\nDB:ok · measurable · API:engine+db"]
  N7["7. Response capture (scorer executes)\nDB:n/a · measurable · API:engine+db"]
  N8["8. Competency scoring\nDB:ok · measurable · API:engine+db"]
  N9["9. Competency profile\nDB:ok · measurable · API:served"]
  N10["10. Competency radar (type profile)\nDB:ok · measurable · API:served"]
  N11["11. Competency heatmap\nDB:ok · measurable · API:served"]
  N12["12. Strength analysis\nDB:ok · measurable · API:forbidden_cross_user"]
  N13["13. Development areas (gap engine)\nDB:ok · honest-empty · API:served_empty"]
  N1 --> N2
  N2 --> N3
  N3 --> N4
  N4 --> N5
  N5 --> N6
  N6 --> N7
  N7 --> N8
  N8 --> N9
  N9 --> N10
  N10 --> N11
  N11 --> N12
  N12 --> N13
```

**Legend:** `served`=authed 200 · `served_empty`=authed 404 honest no-data (route wired) ·
`wired`=gated unauth · `flag_gated`=503 (flag OFF) · `forbidden_cross_user`=403 self-scoped ·
`broken`=route missing (404/000 unauth). `honest-empty`=structurally wired, no measurable input
for this candidate (not a failure).
