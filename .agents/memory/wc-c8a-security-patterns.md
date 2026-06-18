---
name: WC-C8A security remediation patterns
description: Lessons from the WC-C8A launch-readiness security pass — route guard ordering, MFA response safety, crypto API gaps, and audit honesty standards.
---

## requireSuperAdmin forward-reference trap

`requireSuperAdmin` is defined as a `const` at ~line 4684 in `backend/routes.ts`, deep inside the `registerRoutes()` function body. Routes at line ~1252 (seed-demo-users) cannot reference it as middleware because `const` is not hoisted. The pattern is:

```typescript
// At the route registration site (before line 4684):
app.post("/api/some-route", requireAuth, async (req, res, next) => {
  // Inline super_admin guard instead of requireSuperAdmin middleware:
  const callerRoles: string[] = (req.user as any)?.roles || [];
  if (!callerRoles.includes('super_admin') && (req.user as any)?.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  ...
});
```

**Why:** `requireAuth` IS defined before line 1252 (line 302). `requireSuperAdmin` is NOT — forward reference causes ReferenceError at route registration time.

**How to apply:** Any new route added before line 4684 that needs super_admin access must use the inline pattern above.

---

## MFA verify response must sanitize password hash

`storage.getUser()` returns the full DB row including the scrypt `password` hash. The MFA verify handler must destructure it out before `res.json()`:

```typescript
req.login(user, (err) => {
  if (err) return next(err);
  const { password: _pwd, ...safeUser } = user as any;
  return res.json(safeUser);  // same shape as /api/login
});
```

**Why:** The normal `/api/login` path goes through Passport's `serializeUser`/`deserializeUser` and returns a sanitized object. The MFA verify path calls `storage.getUser()` directly and returns raw DB rows — if you do `res.json(user)` without sanitizing, the scrypt hash goes to the browser.

**How to apply:** Any endpoint that calls `storage.getUser()` then `res.json(user)` — check if `password` is in the returned object and destructure it out.

---

## `crypto.hash()` does not exist in Node.js

The original seed-demo-users route had `const hashedPassword = await crypto.hash(user.password)` — this is NOT a real Node.js crypto API and would throw `TypeError: crypto.hash is not a function` at runtime.

The correct pattern (matching the login compare logic in routes.ts):
```typescript
const salt = randomBytes(16).toString('hex');
const buf = await new Promise<Buffer>((resolve, reject) =>
  scrypt(password, salt, 64, (err, key) => err ? reject(err) : resolve(key as Buffer))
);
const hashedPassword = `${buf.toString('hex')}.${salt}`;
```

The compare splits on `.` to get `[hash, salt]` (routes.ts ~line 192). Format must match.

**Why:** `crypto.hash` appears in older tutorials/hallucinations but is not in Node.js stdlib. Use `scrypt` (already imported at routes.ts:132) or the `promisify(scrypt)` pattern.

---

## CONDITIONAL GO vs GO for launch verdicts

A gate that depends on a manually-unverified external dependency (e.g. email delivery via ZOHO) must be CONDITIONAL PASS, not PASS until the full e2e path is confirmed. Specifically:

- MFA is mandatory for super_admin with NO bypass — if ZOHO SMTP fails at login time, the super_admin is permanently locked out of production.
- The test "handler returns 400 on empty body" only proves the handler exists, not that email delivery works.
- Initial verdict: CONDITIONAL GO — requires MFA e2e email test before production deploy.
- **G7 confirmed PASS 2026-06-10**: live backend log shows `POST /api/login 200 emailSent:true` at 12:50:10 and `POST /api/admin/mfa/verify 200` at 12:50:37 with the ZOHO SMTP credentials. MFA e2e is proven in production.

**Why:** Deploying with untested mandatory MFA is a self-DOS risk for the super admin account.

**How to apply:** Before marking any authentication gate as PASS, verify the actual delivery path (send a real email + confirm receipt), not just that the route handler returns a non-404 status.

---

## Credential rotation mechanism (storage.ts)

The `SUPERADMIN_INITIAL_PASSWORD` env var triggers password rotation on restart:

1. Set `SUPERADMIN_INITIAL_PASSWORD=<new_password>` in Replit Deployments secrets
2. Restart the Backend API workflow
3. `seedSuperAdmin()` detects the existing super_admin row, hashes the new password, and UPDATEs it
4. The env var can be cleared after rotation (the DB row has already been updated)

**Confirmed 2026-06-10**: rotation confirmed in startup log "Super Admin password rotated via SUPERADMIN_INITIAL_PASSWORD (username → support@metryxone.com)". admin123 now rejected (401). The credential is rotated.
