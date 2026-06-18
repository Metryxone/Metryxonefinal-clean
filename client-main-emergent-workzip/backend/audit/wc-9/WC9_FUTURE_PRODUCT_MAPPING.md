# WC-9 Deliverable 4 — Future Product Mapping

Maps each new outcome/journey to a product surface and its monetization on the **existing** CAP
ladder (CAP_INS 499 / CAP_GRW 999 / CAP_MAS 1999, via WC-7C). No new billing primitive.

## 1. Product map
| Product | Backing outcome → journey | Build state | Monetization (CAP ladder) |
|---------|---------------------------|-------------|---------------------------|
| **Employability Index 2.0** | `employability_readiness`/`human_skill_advantage` → `employability_index` | **Live — reframe only** | CAP_GRW upsell |
| **Career Resilience Index** | `career_resilience` → `career_resilience_index` | **Buildable now (ready)** | CAP_INS → CAP_GRW |
| **AI Career Navigator** | `ai_readiness` → `ai_career_navigator` | After taxonomy | CAP_GRW / CAP_MAS premium |
| **Future Skills Planner** | `ai_readiness`/`transition` → `future_skills_planner` | After taxonomy | CAP_MAS / recurring |
| **Emerging Careers Explorer** | `career_transition_readiness` → `emerging_careers_explorer` | After role list | bundled with Career Builder |
| **Entrepreneurship Index** | `entrepreneurial_readiness` (gated) | **Deferred (content-first)** | premium niche, later |

## 2. Monetization principles (from WC-7C, unchanged)
- **Never sell into a stub:** a `corpus_pending` product is shown as "coming soon", never offered for
  purchase. The offer-engine stub guard already enforces this — new product route_keys must be added
  to the same readiness check.
- **D6/D7 gating** apply to every future-readiness offer.
- **Reuse the ladder:** all future-readiness SKUs ride CAP_INS/GRW/MAS — no new price table, so
  WC-7C revenue intelligence captures them automatically.

## 3. Revenue shape (directional)
| Product | User value | Revenue potential | Time-to-revenue |
|---------|:--:|:--:|----------------|
| Employability Index 2.0 | High | High | **Immediate** (reframe) |
| Career Resilience Index | Med-High | Medium | **Short** (compose) |
| AI Career Navigator | High | Med-High | Medium (after asset) |
| Future Skills Planner | High | Med-High (recurring) | Medium (after asset) |
| Emerging Careers Explorer | Medium | Low-Med | Medium |
| Entrepreneurship Index | Medium | Medium | Long (content) |

## 4. Honesty note
Two products (Employability 2.0, Resilience Index) are monetizable **without** the reference assets —
they are the early-revenue path. The three AI-dependent products cannot honestly be sold until the
taxonomy/exposure model exist; their `corpus_pending` state makes that explicit in the runtime.
