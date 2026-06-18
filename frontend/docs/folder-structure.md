# MetryxOne — Folder Structure

## Current: Frontend Only

```
metryx-client/                          ← Replit workspace root
│
├── index.html                          ← Vite entry HTML
├── vite.config.ts                      ← Vite config (port 5000, allowedHosts, @assets alias)
├── postcss.config.cjs                  ← Tailwind v4 via @tailwindcss/postcss
├── tsconfig.json
├── package.json                        ← "type": "module"
├── replit.md                           ← Project memory / architecture notes
│
├── docs/                               ← Project documentation
│   ├── README.md
│   ├── folder-structure.md             ← This file
│   ├── notification-engine-backend.md  ← Backend spec
│   ├── notification-templates.md       ← All 59 templates
│   ├── api-reference.md                ← REST API reference
│   └── parent-flow.md
│
├── public/                             ← Static assets served as-is
│
└── src/
    ├── main.tsx                        ← React root, i18n init
    ├── App.tsx                         ← Screen router (no React Router — custom state machine)
    │
    ├── styles/
    │   └── index.css                   ← Single CSS file, all @imports at top, Tailwind v4
    │
    ├── assets/                         ← Images, logos
    │   └── images/
    │
    ├── components/                     ← Reusable + screen-level components
    │   ├── LandingPage.tsx             ← Hero + rotating headlines
    │   ├── Login.tsx                   ← Multi-step login + OTP
    │   ├── FreeAssessmentModal.tsx     ← 10-question LBI assessment
    │   ├── NotificationCenter.tsx      ← Bell icon + dropdown (wired to local store)
    │   ├── StudentDashboard.tsx
    │   ├── SuperAdminDashboard.tsx
    │   ├── UnifiedParentDashboard.tsx
    │   ├── ChatWidget.tsx
    │   │
    │   ├── behavioral/                 ← Behavioral assessment flow screens
    │   ├── exam-ready/                 ← Exam readiness sub-app
    │   │   ├── components/
    │   │   ├── pages/
    │   │   ├── services/
    │   │   └── types/
    │   ├── institute/
    │   └── layout/
    │       ├── Navbar.tsx
    │       └── Footer.tsx
    │
    ├── pages/                          ← Full-page components (marketing, dashboards)
    │   ├── NotificationPreferencesPage.tsx
    │   ├── PricingPage.tsx
    │   └── ...
    │
    ├── lib/                            ← Shared utilities and services
    │   ├── notifications/              ← Notification engine (Phase 1 & 2 — localStorage)
    │   │   ├── templates.ts            ← All 59 templates registry
    │   │   ├── store.ts                ← localStorage CRUD + change events
    │   │   └── service.ts              ← fire(), markRead(), helpers
    │   ├── api.ts
    │   ├── auth-utils.ts
    │   ├── featureGating.ts
    │   ├── i18n.ts
    │   ├── queryClient.ts
    │   └── utils.ts
    │
    └── locales/                        ← i18n translations
        ├── en.json
        ├── hi.json
        └── ...
```

---

## Target: Frontend + Backend (Monorepo)

When adding the backend, the recommended structure is a monorepo with two packages — `client` (existing) and `server` (new).

```
metryx/                                 ← Monorepo root
│
├── package.json                        ← Workspace root (npm workspaces)
├── .env                                ← Shared secrets (never commit)
├── replit.md
├── docs/
│
├── client/                             ← Move all current src/ here
│   ├── index.html
│   ├── vite.config.ts
│   ├── postcss.config.cjs
│   ├── tsconfig.json
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles/
│       ├── assets/
│       ├── components/
│       ├── pages/
│       ├── lib/
│       │   └── notifications/
│       │       ├── templates.ts        ← Keep — shared with server via symlink or package
│       │       ├── store.ts            ← Replace with HTTP calls to server
│       │       └── service.ts          ← Replace with API client wrappers
│       └── locales/
│
└── server/                             ← New backend
    ├── package.json
    ├── tsconfig.json
    │
    ├── src/
    │   ├── index.ts                    ← Express/Hono app entry + port binding
    │   │
    │   ├── db/                         ← Database layer
    │   │   ├── schema.ts               ← Drizzle ORM table definitions
    │   │   ├── migrations/             ← SQL migration files
    │   │   │   ├── 001_notifications.sql
    │   │   │   ├── 002_preferences.sql
    │   │   │   └── 003_queue.sql
    │   │   └── client.ts               ← Drizzle + postgres connection pool
    │   │
    │   ├── notifications/              ← Core notification engine
    │   │   ├── templates.ts            ← Same 59 templates (or import from shared package)
    │   │   ├── service.ts              ← Server-side fire(), preference checks, queue dispatch
    │   │   ├── delivery/
    │   │   │   ├── email.ts            ← Resend / SendGrid sender
    │   │   │   ├── whatsapp.ts         ← Twilio / Gupshup sender
    │   │   │   ├── sms.ts              ← Twilio / MSG91 sender
    │   │   │   └── worker.ts           ← Queue processor (pg-boss job)
    │   │   └── sse.ts                  ← Server-Sent Events connection manager
    │   │
    │   ├── routes/                     ← Express route handlers
    │   │   ├── notifications.ts        ← GET/PATCH/POST/DELETE notification routes
    │   │   ├── preferences.ts          ← GET/PUT preference routes
    │   │   ├── consents.ts             ← GET/PUT email consent routes
    │   │   ├── stream.ts               ← GET /notifications/stream (SSE)
    │   │   └── admin.ts                ← Broadcast + test notification (admin only)
    │   │
    │   ├── middleware/
    │   │   ├── auth.ts                 ← Session/JWT validation
    │   │   ├── rateLimit.ts            ← Rate limiting for notification fire
    │   │   └── validate.ts             ← Request body validation (zod)
    │   │
    │   ├── jobs/                       ← Background job definitions
    │   │   ├── deliveryWorker.ts       ← Email/WhatsApp queue processor
    │   │   └── scheduler.ts            ← Cron for reminders (trial ending, session reminders)
    │   │
    │   └── utils/
    │       ├── templateResolver.ts     ← Fill [placeholder] tokens
    │       └── logger.ts
    │
    └── tests/
        ├── notifications.test.ts
        └── delivery.test.ts
```

---

## Key File Responsibilities (Backend)

| File | What it does |
|---|---|
| `server/src/notifications/service.ts` | `fire(templateId, variables, recipientId)` — the single entry point to create any notification. Checks preferences, writes to DB, enqueues delivery jobs, pushes SSE. |
| `server/src/notifications/delivery/worker.ts` | Reads `notification_queue` for pending jobs, calls email/WhatsApp/SMS senders, updates status |
| `server/src/notifications/sse.ts` | Maintains a `Map<userId, Response[]>` of open SSE connections. `push(userId, notification)` writes to all active tabs |
| `server/src/db/schema.ts` | Drizzle table definitions for `notifications`, `notification_preferences`, `notification_queue`, `email_consents` |
| `server/src/routes/notifications.ts` | REST handlers — thin, delegates all logic to `service.ts` |
| `server/src/jobs/scheduler.ts` | Fires scheduled notifications (trial ending reminders, session reminders 30 min before) |

---

## Environment Variables Needed (server/.env)

```env
# Database (Replit PostgreSQL — auto-provided)
DATABASE_URL=postgresql://...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=notifications@metryxone.com

# WhatsApp (Phase 4)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# SMS (Phase 4 — India)
MSG91_AUTH_KEY=...
MSG91_SENDER_ID=METRYX

# App
NODE_ENV=production
PORT=8000
SESSION_SECRET=...
```

---

## How Frontend Connects to Backend

In development, Vite proxies all `/api/*` requests to the backend:

```typescript
// client/vite.config.ts — already configured
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

In production (deployed), both client (built static files) and server run together — the Express server serves the built Vite output from `client/dist/`.
