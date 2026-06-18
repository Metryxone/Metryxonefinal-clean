# MetryxOne — Notification Engine: Full Backend Spec

## What Changes When Moving from localStorage to DB

| Concern | localStorage (current) | Database (target) |
|---|---|---|
| Persistence | Lost on browser clear | Permanent |
| Multi-device | One browser only | All devices |
| Multi-user | No user separation | Per-user, per-role |
| Admin broadcast | Not possible | Possible |
| Email delivery | Not possible | Possible |
| Audit trail | Not possible | Full history |
| Real-time push | Custom DOM event | WebSocket / SSE |

---

## 1. Database Schema

### `notifications` table
```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     INTEGER NOT NULL,               -- refs templates 1-59
  recipient_id    UUID NOT NULL,                  -- user receiving it
  sender_id       UUID,                           -- user/system that triggered it
  category        VARCHAR(32) NOT NULL,           -- security, exam, reports, etc.
  title           VARCHAR(255) NOT NULL,
  message         TEXT NOT NULL,
  type            VARCHAR(4) NOT NULL CHECK (type IN ('fyi', 'fya')),
  priority        VARCHAR(8) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  is_email_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at   TIMESTAMPTZ,
  action_url      TEXT,
  action_label    VARCHAR(128),
  metadata        JSONB,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient  ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread     ON notifications(recipient_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_category   ON notifications(recipient_id, category);
CREATE INDEX idx_notifications_type       ON notifications(recipient_id, type);
```

### `notification_preferences` table
```sql
CREATE TABLE notification_preferences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE,
  channels      JSONB NOT NULL DEFAULT '{
    "in_app": true,
    "email": true,
    "whatsapp": false,
    "sms": false
  }',
  -- per-category overrides: { "billing": { "email": false }, ... }
  category_overrides JSONB NOT NULL DEFAULT '{}',
  -- quiet hours: { "enabled": true, "from": "22:00", "to": "07:00", "timezone": "Asia/Kolkata" }
  quiet_hours   JSONB NOT NULL DEFAULT '{"enabled": false}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `notification_queue` table  *(for email / WhatsApp delivery)*
```sql
CREATE TABLE notification_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel         VARCHAR(16) NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms', 'push')),
  status          VARCHAR(16) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  provider_ref    VARCHAR(255),                   -- SendGrid message ID, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_pending ON notification_queue(status, scheduled_at)
  WHERE status IN ('pending', 'failed');
```

### `email_consents` table  *(already partially spec'd in frontend)*
```sql
CREATE TABLE email_consents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  consent_type  VARCHAR(64) NOT NULL,             -- transactional, security_alerts, etc.
  is_consented  BOOLEAN NOT NULL DEFAULT TRUE,
  consented_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  UNIQUE (user_id, consent_type)
);
```

---

## 2. Backend API Endpoints

All endpoints require authentication. `recipient_id` is always derived from the session — never trusted from the client.

### Notification CRUD

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notifications` | List notifications (paginated, filterable by type/category) |
| `GET` | `/api/notifications/unread-count` | Returns `{ count: number }` |
| `PATCH` | `/api/notifications/:id/read` | Mark single notification read |
| `POST` | `/api/notifications/mark-all-read` | Mark all read |
| `POST` | `/api/notifications/:id/acknowledge` | Acknowledge an FYA notification |
| `DELETE` | `/api/notifications/:id` | Delete a notification |

### Firing Notifications  *(internal service, or admin API)*

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/notifications/fire` | Fire a notification by template ID + variables |
| `POST` | `/api/admin/broadcast` | Send to all users matching a role/filter |
| `POST` | `/api/admin/test-notification` | Fire a sample notification to self (admin only) |

### Preferences

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notification-preferences` | Get user's channel + category preferences |
| `PUT` | `/api/notification-preferences` | Update preferences |
| `GET` | `/api/email-consents` | List email consent records |
| `PUT` | `/api/email-consents/:type` | Toggle a consent category |

### Real-Time

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/notifications/stream` | SSE stream — pushes new notifications in real time |

---

## 3. `fire()` Service Logic  *(server-side)*

The server-side `notificationService.fire()` should:

```
1. Look up template by templateId (same 59-template registry)
2. Resolve placeholders with provided variables
3. Load recipient's notification_preferences
4. For each channel (in_app, email, whatsapp):
     a. Check user's global channel toggle
     b. Check category-level override
     c. Check quiet hours (skip if in quiet window, unless priority = urgent)
     d. If channel enabled → insert into notification_queue
5. Insert row into notifications table
6. Push SSE event to any active connections for that recipient_id
7. Return the created notification
```

---

## 4. Real-Time Delivery: SSE

**Server-Sent Events** are the simplest option (no extra infra needed).

```
Client connects to GET /api/notifications/stream
Server keeps connection open
When fire() creates a new notification → push:
  data: { id, title, message, category, priority, type, createdAt }
Client receives event → updates bell badge + list in real time
```

**Frontend change needed**: Replace the `metryx:notifications:changed` custom DOM event with an EventSource listener.

```typescript
// In NotificationCenter.tsx
const es = new EventSource('/api/notifications/stream', { withCredentials: true });
es.onmessage = (e) => {
  const notif = JSON.parse(e.data);
  // prepend to list, increment badge
};
```

---

## 5. Email Delivery Worker

A background job (cron or queue worker) that processes `notification_queue`:

```
Every 30 seconds:
  SELECT rows WHERE status = 'pending' AND scheduled_at <= now() LIMIT 50
  For each row:
    Load notification + recipient email
    Check email consent for that category
    Render HTML email from template (title + message + actionUrl)
    Send via SendGrid / Resend / AWS SES
    Update status = 'sent', set email_sent_at, provider_ref
    On failure: increment attempts; if attempts >= max_attempts → status = 'failed'
    Update notifications.is_email_sent = true
```

**Recommended provider**: Resend (simple API, good deliverability, free tier 3,000/month).

---

## 6. WhatsApp / SMS  *(Phase 4)*

Same queue pattern as email — different channel value:
- **WhatsApp**: Twilio or Gupshup API. Requires pre-approved message templates (HSM) from Meta for business-initiated messages.
- **SMS**: Twilio or MSG91 (India). Works without template approval.

---

## 7. Frontend Changes Required

When backend is ready, swap these:

| Current (localStorage) | Replace with |
|---|---|
| `notificationStore.add()` | `POST /api/notifications/fire` (server-side only; client never calls fire directly) |
| `notificationStore.getAll()` | `GET /api/notifications` |
| `notificationStore.getUnreadCount()` | `GET /api/notifications/unread-count` |
| `notificationStore.markRead()` | `PATCH /api/notifications/:id/read` |
| `notificationStore.markAllRead()` | `POST /api/notifications/mark-all-read` |
| `notificationStore.acknowledge()` | `POST /api/notifications/:id/acknowledge` |
| `notificationStore.delete()` | `DELETE /api/notifications/:id` |
| `notificationStore.onChanged()` | `EventSource /api/notifications/stream` |

The `service.ts` layer (with `fire()`, `fireWelcome()`, etc.) on the **client side** should become thin HTTP wrappers or be removed entirely — triggers should call server endpoints instead.

---

## 8. Migration Strategy  *(localStorage → DB with no downtime)*

1. Deploy backend with all endpoints
2. On app load: if localStorage has notifications, POST them to `/api/notifications/migrate` to seed the user's DB history, then clear localStorage
3. Switch `NotificationCenter.tsx` to read from API
4. Remove localStorage store code

---

## 9. Tech Stack Recommendation

| Layer | Choice | Reason |
|---|---|---|
| Database | **Replit PostgreSQL** (already available) | Zero setup, built-in |
| Backend | **Node.js + Express** or **Hono** | Matches existing Vite frontend |
| ORM | **Drizzle ORM** | TypeScript-native, lightweight |
| Email | **Resend** | Simple API, good free tier |
| Real-time | **SSE** (no WebSocket infra needed) | Works through Replit proxy |
| Queue | **pg-boss** (Postgres-backed job queue) | No Redis needed |
| Auth | Re-use existing session from current auth flow | |

---

## 10. Estimated Build Scope

| Task | Effort |
|---|---|
| DB schema + migrations | 1 day |
| REST API endpoints (CRUD) | 1–2 days |
| `fire()` server-side service with preference checks | 1 day |
| SSE real-time stream | 0.5 day |
| Frontend swap (localStorage → API) | 0.5 day |
| Email worker (Resend integration) | 1 day |
| Preferences UI wired to API | 0.5 day |
| WhatsApp / SMS | 1–2 days |
| **Total** | **~6–9 days** |
