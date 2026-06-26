# MetryxOne — Encryption & Security Guide

## Current Security Status

| Category | Status | Severity |
|----------|--------|----------|
| Passwords (bcrypt) | ✅ Secure | — |
| OTP hashing (bcrypt) | ✅ Secure | — |
| SQL Injection (Drizzle ORM) | ✅ Safe | — |
| Cookies (httpOnly, sameSite) | ✅ Good | — |
| PII encryption at rest | ❌ None | CRITICAL |
| x-user-id header bypass | ✅ Removed | — |
| JWT default secret | ❌ Hardcoded | CRITICAL |
| Rate limiting | ❌ Not implemented | HIGH |
| File access control | ❌ Public static | HIGH |
| OTP logging to console | ❌ Leaked in logs | HIGH |
| Dev OTP bypass (123456) | ❌ Risk if NODE_ENV wrong | HIGH |
| Cookie `secure` flag | ⚠️ Missing | MEDIUM |
| CORS whitelist | ⚠️ Single origin | MEDIUM |

---

## What MUST Be Encrypted

### CRITICAL — Encrypt at Rest (Database)

| Table | Column | Data Type | Why |
|-------|--------|-----------|-----|
| `parent_kyc` | `id_number` | Aadhaar/PAN | Government ID — legal requirement (DPDP Act 2023) |
| `parent_kyc` | `full_legal_name` | Legal name | Linked to government ID |
| `onboarding_requests` | `pan_number` | PAN card | Tax identity — legal requirement |
| `onboarding_requests` | `gst_number` | GST number | Business tax identity |
| `kyc_documents` | `document_number` | ID doc number | Government ID reference |
| `children` | `medical_conditions` | Health data | Sensitive personal data under DPDP |
| `children` | `blood_group` | Health data | Sensitive personal data |
| `children` | `emergency_contact` | Phone number | PII tied to minors |

### HIGH — Encrypt at Rest (Database)

| Table | Column | Data Type | Why |
|-------|--------|-----------|-----|
| `users` | `mobile` | Phone | PII — can identify individuals |
| `users` | `email` | Email | PII — can identify individuals |
| `children` | `date_of_birth` | DOB | Minor's PII — extra protection needed |
| `children` | `name` | Full name | Minor's PII |
| `mentor_profiles` | `phone` | Phone | PII |
| `hr_applications` | `phone` | Phone | PII |
| `hr_applications` | `email` | Email | PII |
| `student_enrollments` | `student_email` | Email | Minor's PII |
| `student_enrollments` | `student_phone` | Phone | Minor's PII |
| `student_enrollments` | `parent_email` | Email | PII |

### HIGH — Encrypt File Storage

| What | Current | Should Be |
|------|---------|-----------|
| KYC documents (PAN, Aadhaar, bank) | Static files in `uploads/` | Encrypted at rest + access-controlled |
| Resumes (HR applications) | Static files | Encrypted at rest + access-controlled |
| Signed agreements | Static files | Encrypted at rest + access-controlled |

---

## What Does NOT Need Encryption

### ✅ Already Secure — Don't Change

| Data | Why It's Fine |
|------|---------------|
| `password_hash` | Already bcrypt hashed (irreversible) — NEVER encrypt, always hash |
| `otp_hash` | Already bcrypt hashed |
| JWT tokens | Signed with secret, short-lived, not stored in DB |
| Assessment scores | Not PII — aggregate data |
| Domain/subdomain configs | Public educational metadata |
| Subscription plans/packages | Business data, not sensitive |
| Notification templates | System config |
| LBI modules/questions | Educational content |
| Scoring configs/norms | Statistical data |
| Platform settings | App configuration |

### ✅ Store As-Is — Low Risk

| Data | Why |
|------|-----|
| `users.full_name` | Needed for display/search — encrypt only if compliance requires |
| `users.role` / `roles` | Internal system field |
| `children.grade` / `board` / `school` | Educational info, low sensitivity |
| `children.favorite_subjects` | Preferences, not PII |
| Wellness check-in scores | Anonymized when displayed |
| Career compass results | Generated data |
| Mentor profiles (bio, subjects, specializations) | Intentionally public |
| Mentor bookings (date, time) | Operational data |
| Mentor reviews (rating, comment) | Public feedback |

---

## Implementation Guide

### 1. Field-Level Encryption (for Database Columns)

**Approach:** AES-256-GCM encryption with per-field keys

Create `server/src/db/encryption.ts`:

```typescript
import crypto from 'crypto';

// Master key from environment — NEVER hardcode
const MASTER_KEY = process.env.ENCRYPTION_KEY!; // 32-byte hex string
if (!MASTER_KEY) console.warn('[SECURITY] ENCRYPTION_KEY not set — data will NOT be encrypted');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string
 * Returns: base64 string in format: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  if (!MASTER_KEY || !plaintext) return plaintext;

  const key = Buffer.from(MASTER_KEY, 'hex'); // 32 bytes
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * Input: base64 string in format: iv:authTag:ciphertext
 */
export function decrypt(encryptedText: string): string {
  if (!MASTER_KEY || !encryptedText || !encryptedText.includes(':')) return encryptedText;

  const [ivB64, authTagB64, ciphertext] = encryptedText.split(':');
  const key = Buffer.from(MASTER_KEY, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Hash for searchable encrypted fields (e.g., lookup user by email)
 * Uses HMAC-SHA256 — deterministic but not reversible
 */
export function hashForSearch(plaintext: string): string {
  if (!MASTER_KEY || !plaintext) return plaintext;
  return crypto.createHmac('sha256', MASTER_KEY)
    .update(plaintext.toLowerCase().trim())
    .digest('hex');
}

/**
 * Generate a 32-byte encryption key
 * Run once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
```

**Usage Pattern:**

```typescript
// STORING (encrypt before save)
import { encrypt, hashForSearch } from '../db/encryption.js';

await db.insert(parentKyc).values({
  parentId: userId,
  idNumber: encrypt(aadhaarNumber),          // encrypted
  idNumberHash: hashForSearch(aadhaarNumber), // searchable hash
  fullLegalName: encrypt(legalName),
  dateOfBirth: encrypt(dob),
});

// READING (decrypt after fetch)
import { decrypt } from '../db/encryption.js';

const row = await db.select().from(parentKyc).where(...);
const decrypted = {
  ...row,
  idNumber: decrypt(row.idNumber),
  fullLegalName: decrypt(row.fullLegalName),
  dateOfBirth: decrypt(row.dateOfBirth),
};
```

**For searchable fields** (email, phone, Aadhaar):

```
Add a new column: email_hash TEXT
Store: hashForSearch(email) in email_hash
Search: WHERE email_hash = hashForSearch(searchInput)
Display: decrypt(email)
```

### 2. Environment Variable for Encryption Key

```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=a1b2c3d4e5f6...64_hex_characters
```

### 3. File Encryption (KYC Documents)

**Option A: Google Cloud Storage with CMEK (recommended for GCP)**

```typescript
// Upload to GCS with customer-managed encryption key
const storage = new Storage();
const bucket = storage.bucket('metryxone-kyc-docs');

async function uploadEncryptedFile(file: Buffer, filename: string): Promise<string> {
  const blob = bucket.file(`kyc/${filename}`);
  await blob.save(file, {
    metadata: { contentType: 'application/pdf' },
    // GCS encrypts at rest by default (AES-256)
    // For extra: use Customer-Managed Encryption Keys (CMEK)
  });

  // Return signed URL (expires in 15 min) instead of public URL
  const [url] = await blob.getSignedUrl({
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000,
  });
  return url;
}
```

**Option B: Encrypt files before storing locally**

```typescript
import crypto from 'crypto';
import fs from 'fs';

function encryptFile(inputPath: string, outputPath: string, key: Buffer): void {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);

  output.write(iv); // prepend IV
  input.pipe(cipher).pipe(output);
}
```

---

## Critical Security Fixes (Do Immediately)

### Fix 1: Remove Auth Bypass Headers

**File:** `server/src/middleware/auth.ts`

**REMOVE THIS CODE:**
```typescript
// ❌ CRITICAL VULNERABILITY — allows anyone to impersonate any user
const headerUserId = req.headers['x-user-id'] as string | undefined;
if (headerUserId) {
  req.user = {
    id: headerUserId,
    role: (req.headers['x-user-role'] as string) ?? 'user',
    roles: [(req.headers['x-user-role'] as string) ?? 'user'],
  };
  next();
  return;
}
```

### Fix 2: Enforce JWT Secret in Production

**File:** `server/src/auth/jwt.ts`

```typescript
// BEFORE (dangerous):
const JWT_SECRET = process.env.JWT_SECRET ?? 'metryx-dev-secret-change-in-production';

// AFTER (safe):
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('[SECURITY] Using default JWT_SECRET — NOT SAFE FOR PRODUCTION');
}
const SECRET = JWT_SECRET || 'metryx-dev-secret-local-only';
```

### Fix 3: Remove OTP from Logs

**File:** `server/src/auth/otp.ts`

```typescript
// BEFORE:
console.log(`[OTP] Email: ${email} → OTP: ${otp}`);

// AFTER:
console.log(`[OTP] Sent to ${email.slice(0, 3)}***@${email.split('@')[1]}`);
```

### Fix 4: Add Rate Limiting

```bash
cd server && npm install express-rate-limit
```

**File:** `server/src/index.ts`

```typescript
import rateLimit from 'express-rate-limit';

// Global: 100 requests per 15 min per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Strict: Auth endpoints — 10 requests per 15 min
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use('/api/auth/otp', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
```

### Fix 5: Secure Cookie Flag

**File:** `server/src/routes/auth.ts`

```typescript
res.cookie('metryx_token', token, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production', // ← ADD THIS
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});
```

### Fix 6: Protect File Downloads

**File:** `server/src/index.ts`

```typescript
// BEFORE (insecure — anyone can access):
app.use('/files', express.static(uploadsDir));

// AFTER (authenticated access only):
app.use('/files', requireAuth, express.static(uploadsDir));
```

### Fix 7: CORS Whitelist

```typescript
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5000')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
    else callback(new Error('CORS blocked'));
  },
  credentials: true,
}));
```

---

## Encryption Priority Roadmap

### Phase 1 — Immediate (before production)
- [ ] Remove x-user-id auth bypass
- [ ] Enforce JWT_SECRET in production
- [ ] Remove OTP from logs
- [ ] Add rate limiting
- [ ] Add `secure` flag to cookies
- [ ] Protect file downloads with auth

### Phase 2 — Critical PII (within 1 week)
- [ ] Create `encryption.ts` utility
- [ ] Encrypt `parent_kyc.id_number` (Aadhaar/PAN)
- [ ] Encrypt `onboarding_requests.pan_number`
- [ ] Encrypt `onboarding_requests.gst_number`
- [ ] Encrypt `kyc_documents.document_number`
- [ ] Encrypt `children.medical_conditions`
- [ ] Add hash columns for searchable encrypted fields

### Phase 3 — Full PII Protection (within 2 weeks)
- [ ] Encrypt `users.mobile` + add `mobile_hash` for search
- [ ] Encrypt `users.email` + add `email_hash` for search
- [ ] Encrypt `children.date_of_birth`
- [ ] Encrypt `children.emergency_contact`
- [ ] Move file uploads to GCS with signed URLs
- [ ] Encrypt KYC documents at rest

### Phase 4 — Hardening (within 1 month)
- [ ] Enable DB SSL (verify-full mode)
- [ ] Add audit logging for PII access
- [ ] Implement key rotation strategy
- [ ] Add CORS whitelist for production
- [ ] Remove dev OTP bypass in production builds
- [ ] Add Content Security Policy headers
- [ ] Enable HSTS

---

## Compliance Notes (India — DPDP Act 2023)

| Requirement | Status | Action Needed |
|-------------|--------|---------------|
| Consent before data collection | ✅ Implemented (consent_given) | — |
| Purpose limitation | ⚠️ Partial | Document purpose per field |
| Data minimization | ⚠️ Collecting more than needed | Review fields |
| Storage limitation | ❌ No retention policy | Add data expiry |
| **Encryption of personal data** | ❌ **Not implemented** | **Phase 2-3 above** |
| Right to erasure | ❌ No delete flow | Add account deletion |
| Data breach notification | ❌ No process | Add breach detection |
| **Children's data (under 18)** | ❌ **Extra protection needed** | **Encrypt all children fields** |
| Cross-border transfer notice | ⚠️ Using Neon (US servers) | Document or move to India region |

> **Note:** The DPDP Act 2023 specifically requires **verifiable parental consent** for processing children's data and prohibits tracking/behavioral monitoring of children. Your `children` table stores sensitive data about minors — encryption is not optional, it's a legal requirement.
