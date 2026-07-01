# 16 · Assessment Administration Blueprint (Layer 13)

**Mode:** Read-only / planning-only. No changes. **Layer status: SUPPORTED (1 gap: AI prompt management).**

## Canonical Definition
Assessment Administration is the super-admin control plane: assessment management, question management, norm/standardization management, report-template management, AI-prompt management, version management, audit history, and configuration. Surfaced through the SuperAdmin dashboard panels and admin routes (all `requireAuth` + `requireSuperAdmin` behind the global `/api/admin` gate).

## Capability Evidence
| Capability | Status | Repository Evidence |
| :-- | :-- | :-- |
| Assessment Management | SUPPORTED | `routes/report-factory.ts` (generated-report lifecycle); `routes/assessment-framework.ts` (coverage/gaps). |
| Question Management | SUPPORTED | `services/question-factory.ts` + `routes/question-factory.ts` (generate/import/review/approve/retire); `question-registry-service.ts`. |
| Norm Management | PARTIAL→SUPPORTED (for existing norms) | `benchmark-engine.ts` + `rf_benchmark_configs` (cohort defs, percentile bands); `lbi-norms-engine.ts` versioning. (Management surface exists; missing populations are Layer-6 data gaps.) |
| Standardization Management | PARTIAL | Via benchmark configs + score-rule bands; no dedicated stanine/T config (Layer-7 gap). |
| Report Template Management | SUPPORTED | `report-factory-schema.ts` (`rf_templates`, `rf_template_sections`); `ReportFactoryPanel.tsx`. |
| AI Prompt Management | **MISSING** | No versioned prompt registry / prompt governance table. AI reasoning exists (`ai-orchestration-engine.ts`) but prompts are code-embedded. → GAP-AP-9 (Medium). |
| Version Management | SUPPORTED | `rf_templates.version`; `capadex_question_registry.version`; assessment `_meta/version`. |
| Audit History | SUPPORTED | `routes/platform-audit-routes.ts`; `PlatformAuditLogPanel.tsx`; write-time redaction + unified trail. |
| Configuration | SUPPORTED | `rf_white_label_configs` (tenant branding); feature-flag control plane. |

## Administration Integrity
- **Every admin surface is gated** (`requireAuth` + `requireSuperAdmin`); the per-framework admin gate closes `/api/<fw>/admin/*` structurally.
- **Audit redaction is at write time** — PII never lands unredacted; the unified read trail surfaces metadata only.
- **Human-in-the-loop** — question promotion, lifecycle transitions, and governance approvals are human-only; the AI never self-approves.

## Gaps
- **GAP-AP-9 (Medium):** AI Prompt Management — no versioned, governed prompt registry (prompts embedded in code). High-value for auditability, reproducibility, and prompt A/B governance.

## Freeze Position
**FREEZE** the administration model (gated panels + audit trail + version management + config). AI-prompt management is a **net-new additive subsystem** (prompt registry + versioning + governance) to schedule in the roadmap — it extends the control plane, it does not redesign it.
