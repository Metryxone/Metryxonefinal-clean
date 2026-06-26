---
name: Email/report HTML XSS escaping discipline
description: Which interpolations in backend/email.ts must be HTML-escaped vs. left raw, and the easily-missed vectors.
---

# Email/report HTML builder escaping (backend/email.ts)

All outbound email HTML is built with template literals. Any **user- or AI-authored** value interpolated into an HTML context must be HTML-escaped or it's an injection/XSS vector in the rendered email.

**Rule:** escape every name / email / phone / free-text / AI-generated narrative before it lands inside HTML element text or attributes.

**Why:** offer-letter `notes`, candidate/company/job fields, crisis-alert reasons, and AI report text all flow into recipient inboxes; an unescaped `<` lets injected markup break out of context.

**How to apply:**
- A module-level hoisted `escapeHtml()` exists and is callable everywhere in the file; the CAPADEX report builder additionally defines local `esc()` helpers (lines ~458/497/1046/1191) — report fields like `rec.title`, `qv.summary`, archetype label/summary, `fc.outlook_*` already go through `esc()`.
- `NARRATIVE_MAP(...)` receives **already-escaped** `firstName`/`concernName`, so its static templates render single-escaped — do NOT escape again at the render site (`computed.headline/story` are raw-rendered on purpose = single-escape).
- **Leave RAW (intentional):** OTP `${code}`, numeric scores/percentages, internal enums (stageName, severity, normLevel, typeLabel), subject lines (plain-text headers, not HTML), and any URL field built with `encodeURIComponent` (escaping would corrupt the URL). Static lookup content (`teasers` from `stageCopy`, `getEmailSubdomainInsight().label/interpretation`, `scoreCtx`, `emailPatternName/Desc`) is deterministic → safe raw.
- **Easily-missed vectors** (escape these): the offer-letter **details table** (`jobTitle`, `ctcStr`, `joiningDate`, `validity`, and especially free-text `notes`) and the **counsellor-assignment** greeting (`counsellorName`) — they sit far below the header block where the obvious name fields live, so a first pass that only escapes the greeting/intro misses them.

**Frontend companion:** prefer plain `{value}` text nodes over `dangerouslySetInnerHTML`; only keep `dangerouslySetInnerHTML` for developer-controlled CSS (e.g. chart.tsx). Helmet CSP is a SEPARATE concern, not part of escaping.
