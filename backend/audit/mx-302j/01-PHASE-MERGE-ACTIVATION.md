# MX-302J — Phase Merge & Activation (A→I)

_Structural (filesystem) ⟂ Activation (first-hand live HTTP probe). Never composited._

| Phase | Name | Flag | Merged (structural) | Route present | Flag env (this proc) | Live `enabled` | Probe HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| A | Career Launchpad | `careerLaunchpad` | ✅ | ✅ | on | ⬜ false | 200 | Flag defined + backend route merged. |
| B | Career Discovery | `careerDiscovery` | ✅ | ✅ | on | ✅ true | 200 | Flag defined + backend route merged. |
| C | Launchpad Dashboard | `launchpadDashboard` | ❌ | ❌ | off | — | — | No backend route file (frontend-composition phase); structural = flag-defined only. |
| D | Student Career Builder | `studentCareerBuilder` | ✅ | ✅ | on | ⬜ false | 200 | Flag defined + backend route merged. |
| E | Campus Placement | `campusPlacement` | ✅ | ✅ | on | ✅ true | 200 | Flag defined + backend route merged. |
| F | Employability Studio | `employabilityStudio` | ✅ | ✅ | on | ⬜ false | 200 | Flag defined + backend route merged. |
| G | Learning Passport Loop | `learningPassportLoop` | ✅ | ✅ | on | ✅ true | 200 | Flag defined + backend route merged. |
| H | Institutional Intelligence | `institutionalIntelligence` | ✅ | ✅ | on | ⬜ false | 200 | Flag defined + backend route merged. |
| I | Ecosystem & Community | `ecosystemCommunity` | ✅ | ✅ | on | ⬜ false | 503 | Flag defined + backend route merged. |

- **Merged:** 8/9
- **Activated (live):** 3/9

> Activation is measured against the **live Backend API workflow** (the real FF_* set). Flags do not seed data, so dormant pipelines correctly read 0 in adoption/outcome.
