# Record of Processing Activities (RoPA) — GDPR Art. 30 / DPDP

> **STATUS: DRAFT — DPO / LEGAL REVIEW REQUIRED.** This is an engineering-authored
> starting draft derived from the codebase (schema, integrations, deployment
> topology). It is **not** legal advice and must be reviewed, corrected, and
> formally adopted by the Data Protection Officer / legal counsel before it is
> relied upon. Closes the RoPA portion of gap **CMP-F1**.

## 1. Controller
- **Entity:** MetryxOne (metryx.one). *(Confirm legal entity name, registered address, and — if applicable — EU representative and DPO contact.)*

## 2. Processing activities

| # | Activity | Personal data categories | Data subjects | Purpose | Lawful basis (confirm) | Retention |
|---|---|---|---|---|---|---|
| P1 | User accounts & authentication | name, email, phone, hashed password, role | Students, job-seekers, employers, faculty, parents, mentors, admins | Provide the platform; authenticate; authorize | Contract / legitimate interest | Per `data_retention_policies` (declared; enforced by retention scheduler — CMP-M2) |
| P2 | Behavioural / competency assessments | assessment responses, derived scores, narratives | Assessment takers | Deliver assessment, guidance, reports | Consent / contract | Declared retention |
| P3 | Career & employability profiles | career history, skills, résumé text, portfolio links | Job-seekers, students | Career guidance, matching | Consent / contract | Declared retention |
| P4 | Consent records | consent type/version, status, timestamps, purposes | All data subjects | Demonstrate & manage consent | Legal obligation | Per consent policy |
| P5 | Employer hiring workflows | candidate evaluations, interview data, voice/avatar screening artifacts | Candidates | Hiring assessment | Consent / contract | Declared retention |
| P6 | Communications | email address, message content | Users | Transactional & notification email | Legitimate interest / consent | Declared retention |
| P7 | Payments | billing identifiers, payment references (via Razorpay) | Paying customers | Process payments, invoicing/GST | Contract / legal obligation | Statutory (tax) |
| P8 | Security & audit logs | user id, IP, action metadata (redacted at write) | All users | Security, fraud prevention, accountability | Legitimate interest / legal obligation | Security-retention policy (define) |

## 3. Recipients / sub-processors
See `docs/compliance/cross-border-transfer-controls.md` for the sub-processor register (Zoho, OpenAI/Emergent, Razorpay, Twilio) and transfer mechanisms.

## 4. Data residency
Primary hosting region **asia-south1** (Google Cloud + Firebase). Confirm all sub-processors' processing locations and document transfer mechanisms.

## 5. Security measures (summary)
TLS in transit; provider-level at-rest encryption; RBAC + super-admin MFA; CSRF protection; input-side AI injection guard; audit-log redaction at write; session lifetime policy (absolute/idle configurable). See reports 02/07/08 in `backend/audit/program2-2.4-security-compliance-ai-trust/`.

## Open items for DPO
- Confirm lawful basis per activity (the table lists candidates, not decisions).
- Confirm controller/processor roles per integration and DPA status (CMP-F2).
- Define explicit retention periods per category and security-log retention.
- Confirm children's data handling (DPDP §9) and parental-consent artifacts (CMP-L2).
