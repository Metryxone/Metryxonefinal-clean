---
name: Competency Assessment vs LBI are intentionally separate systems
description: The professional Competency Assessment and the student Learning Behavior Index are two independent products — the absence of a bridge between them is BY DESIGN, not a defect.
---

# Competency Assessment ⟂ Learning Behavior Index (LBI)

**Rule:** The platform has TWO distinct competency-style products that must work **independently**:

1. **Competency Assessment** — professional / career-facing. Backed by the `onto_*`
   genome (`onto_competencies` ≈299, `onto_domains`, `onto_role_weights`, …) plus the
   `competency_*` catalog. Consumed by RoleDNA, Pathway, Career-Signal, Weighting engines
   and the Career Builder / Ontology admin.
2. **Learning Behavior Index (LBI)** — student / child-facing. Backed by `lbi_*`
   (`lbi_domains`, `lbi_subdomains`, `lbi_questions`, `lbi_sessions`, scoring/report engines)
   under `/api/lbi/admin/*`. This is what the super-admin "Competency Framework" tab shell
   actually renders for the LBI framework option.

**Why:** Confirmed by the platform owner (2026-06-22): "competency assessment and Learning
Behavior Index linked to students are 2 different systems — they should work independently."
They serve different audiences (professionals vs students) and different scoring models.

**How to apply:**
- Do **NOT** propose or build an `lbi_* → onto_competencies` mapping/bridge. The lack of a
  foreign key between LBI traits and onto-competencies is correct, not a missing thread.
- When auditing "competency model coherence," scope EACH system on its own. Genuine
  internal disconnects worth flagging live *within* the professional side (e.g. the
  `onto_*` vs `competency_library` vs `ont_*` "triple-entry" catalog drift), and separately
  *within* LBI — never across the boundary.
- The shared `FrameworkPanel.tsx` shell hosting both LBI and Competency frameworks is a UI
  convenience; it does not imply the underlying data should be unified.
