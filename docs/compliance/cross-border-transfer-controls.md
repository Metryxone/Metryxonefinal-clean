# Cross-Border Transfer Controls & Sub-Processor Register

> **STATUS: DRAFT — DPO / LEGAL REVIEW REQUIRED.** Engineering-authored draft from
> the codebase integrations. Not legal advice. Closes the transfer-controls portion
> of gap **CMP-F1**; the DPA/sub-processor formalisation is tracked as **CMP-F2**.

## 1. Data residency
- Primary hosting: **Google Cloud + Firebase**, region **asia-south1** (documented in `replit.md`).
- Application data (Postgres/Cloud SQL, optional MongoDB) resides in the primary region unless a sub-processor below moves it.

## 2. Sub-processor register

| Sub-processor | Function | Personal data exposed | Processing location | Transfer mechanism (confirm) | DPA status (CMP-F2) |
|---|---|---|---|---|---|
| **Zoho Mail** | Transactional / MFA email | Recipient email, message content | Per Zoho region *(confirm)* | SCCs / adequacy *(confirm)* | Obtain / file DPA |
| **OpenAI / Emergent LLM** | AI interpretation, recommendations, reports | Free-text/assessment content sent in prompts (mitigated by input guard) | US / provider region *(confirm)* | SCCs *(confirm)* | Obtain / file DPA |
| **Razorpay** | Payments | Billing/payment identifiers | India | Controller-to-processor / statutory | Obtain / file DPA |
| **Twilio** | Voice screening (employer) | Call audio / transcripts (feature-gated) | Provider region *(confirm)* | SCCs *(confirm)* | Obtain / file DPA |
| **Google Cloud / Firebase** | Hosting, DB, storage | All categories | asia-south1 | Google Cloud DPA | Confirm accepted |

## 3. Transfer safeguards to formalise
- [ ] Execute / file a **DPA** with each sub-processor (CMP-F2).
- [ ] Document the **transfer mechanism** (adequacy decision, SCCs, or equivalent) for each cross-border flow.
- [ ] Confirm each sub-processor's **actual processing region** and update the table.
- [ ] Minimise personal data sent to the LLM provider; document the input-guard mitigation and any redaction.
- [ ] Maintain a public/updatable **sub-processor list** and a change-notification process for customers.

## 4. Notes
- The AI input guard (AI-M1) reduces (does not eliminate) exposure of raw user text to the LLM provider.
- If a customer/region requires data localisation stricter than asia-south1, evaluate per-tenant residency before onboarding.
