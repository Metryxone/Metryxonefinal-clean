# MetryxOne — Notification API Reference

Base path: `/api`  
Auth: All endpoints require a valid session cookie (`credentials: 'include'`).  
`recipient_id` is always derived from the authenticated session — never passed by the client.

---

## Notifications

### GET `/api/notifications`

List notifications for the authenticated user.

**Query params**

| Param | Type | Description |
|---|---|---|
| `type` | `fyi` \| `fya` | Filter by notification type |
| `category` | string | Filter by category (security, exam, reports, etc.) |
| `limit` | number | Max results (default: 50, max: 200) |
| `offset` | number | Pagination offset (default: 0) |
| `unread_only` | boolean | If true, return only unread |

**Response `200`**
```json
[
  {
    "id": "notif_abc123",
    "templateId": 22,
    "category": "exam",
    "title": "Test Assigned",
    "message": "Math Assessment has been assigned to you by Admin.",
    "type": "fya",
    "priority": "high",
    "isRead": false,
    "isAcknowledged": false,
    "acknowledgedAt": null,
    "isEmailSent": false,
    "actionUrl": null,
    "actionLabel": "Start Test",
    "metadata": null,
    "expiresAt": null,
    "recipientId": "user_xyz",
    "senderId": null,
    "createdAt": "2026-03-11T10:30:00Z"
  }
]
```

---

### GET `/api/notifications/unread-count`

Returns the number of unread notifications for the authenticated user.

**Response `200`**
```json
{ "count": 4 }
```

---

### PATCH `/api/notifications/:id/read`

Mark a single notification as read.

**Response `200`**
```json
{ "success": true }
```

---

### POST `/api/notifications/mark-all-read`

Mark all of the user's notifications as read.

**Response `200`**
```json
{ "updated": 12 }
```

---

### POST `/api/notifications/:id/acknowledge`

Acknowledge a `fya` notification. Records timestamp and marks `isAcknowledged: true`.

**Request body**
```json
{ "notes": "Acknowledged by user" }
```

**Response `200`**
```json
{ "success": true, "acknowledgedAt": "2026-03-11T10:35:00Z" }
```

---

### DELETE `/api/notifications/:id`

Delete a notification permanently.

**Response `200`**
```json
{ "success": true }
```

---

## Firing Notifications  *(Admin / Server-Side)*

### POST `/api/notifications/fire`

Fire a notification by template ID. On the server this runs the full pipeline: checks preferences, writes to DB, enqueues delivery, pushes SSE.

> **Note:** On the client, the notification triggers (`notificationService.fire()`) call this endpoint. The client never writes to the DB directly.

**Request body**
```json
{
  "templateId": 22,
  "variables": {
    "testName": "Math Assessment",
    "assignedBy": "Admin"
  },
  "recipientId": "user_xyz",
  "options": {
    "actionUrl": "/tests/math-assessment",
    "actionLabel": "Start Test"
  }
}
```

**Response `201`**
```json
{
  "id": "notif_abc123",
  "title": "Test Assigned",
  "message": "Math Assessment has been assigned to you by Admin.",
  "createdAt": "2026-03-11T10:30:00Z"
}
```

**Error `400`** — Unknown templateId or missing required variables  
**Error `403`** — Recipient preferences blocked this channel  

---

### POST `/api/admin/broadcast`

Send a notification to all users matching a filter. Admin only.

**Request body**
```json
{
  "templateId": 10,
  "variables": { "date": "April 1, 2026" },
  "filter": {
    "roles": ["student", "parent"],
    "institutionId": "inst_abc"
  }
}
```

**Response `202`**
```json
{ "queued": 1240, "jobId": "broadcast_xyz" }
```

---

### POST `/api/admin/test-notification`

Fire a sample notification to the currently authenticated admin user. Uses predefined sample variables for the given template.

**Request body**
```json
{ "templateId": 22 }
```

**Response `201`**
```json
{ "id": "notif_sample_abc", "title": "Test Assigned", "message": "..." }
```

---

## Real-Time Stream

### GET `/api/notifications/stream`

Server-Sent Events connection. Keeps the HTTP connection open and pushes new notifications as they arrive.

**Headers required**
```
Accept: text/event-stream
Cache-Control: no-cache
```

**Event format**
```
data: {"id":"notif_abc","title":"Test Assigned","message":"...","category":"exam","priority":"high","type":"fya","createdAt":"2026-03-11T10:30:00Z"}

```

**Heartbeat** (every 30s to keep connection alive)
```
: ping
```

**Frontend usage**
```typescript
const es = new EventSource('/api/notifications/stream', { withCredentials: true });

es.onmessage = (event) => {
  const notif = JSON.parse(event.data);
  // add to notification list, increment badge
};

es.onerror = () => {
  // reconnect after delay
  setTimeout(() => reconnect(), 3000);
};
```

---

## Preferences

### GET `/api/notification-preferences`

Get the authenticated user's notification channel and category preferences.

**Response `200`**
```json
{
  "channels": {
    "in_app": true,
    "email": true,
    "whatsapp": false,
    "sms": false
  },
  "categoryOverrides": {
    "billing": { "email": true },
    "marketing": { "email": false }
  },
  "quietHours": {
    "enabled": true,
    "from": "22:00",
    "to": "07:00",
    "timezone": "Asia/Kolkata"
  }
}
```

---

### PUT `/api/notification-preferences`

Update preferences. Partial updates supported — only include what changed.

**Request body**
```json
{
  "channels": { "whatsapp": true },
  "quietHours": { "enabled": false }
}
```

**Response `200`**
```json
{ "success": true }
```

---

## Email Consents

### GET `/api/email-consents`

List all email consent records for the user.

**Response `200`**
```json
[
  {
    "id": "consent_abc",
    "userId": "user_xyz",
    "consentType": "transactional",
    "isConsented": true,
    "consentedAt": "2026-01-01T00:00:00Z",
    "revokedAt": null
  },
  {
    "id": "consent_def",
    "consentType": "marketing",
    "isConsented": false,
    "consentedAt": null,
    "revokedAt": "2026-02-15T00:00:00Z"
  }
]
```

---

### PUT `/api/email-consents/:type`

Toggle a specific email consent category.

**Path param**: `type` — one of `transactional`, `security_alerts`, `assessment_updates`, `mentor_updates`, `lbi_reports`, `marketing`, `newsletter`, `product_updates`, `weekly_digest`

> `transactional` and `security_alerts` cannot be revoked — returns `403`.

**Request body**
```json
{ "isConsented": false }
```

**Response `200`**
```json
{ "consentType": "marketing", "isConsented": false, "revokedAt": "2026-03-11T10:40:00Z" }
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "NOT_FOUND",
  "message": "Notification not found or does not belong to this user."
}
```

| HTTP Code | Error Key | Meaning |
|---|---|---|
| 400 | `INVALID_TEMPLATE` | templateId does not exist (1–59) |
| 400 | `MISSING_VARIABLES` | Required `[placeholder]` variables not provided |
| 401 | `UNAUTHENTICATED` | No valid session |
| 403 | `FORBIDDEN` | Resource belongs to a different user, or consent is required |
| 404 | `NOT_FOUND` | Notification ID not found |
| 429 | `RATE_LIMITED` | Too many fire() calls (limit: 60/min per user) |
| 500 | `INTERNAL_ERROR` | Server error |
