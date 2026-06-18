import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, or, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/drizzle.js';
import { users, userDevices } from '../db/schema.js';
import { signToken, verifyToken, extractToken } from '../auth/jwt.js';
import jwt from 'jsonwebtoken';
import { createOtp, verifyOtp, checkOtp, deliverOtp } from '../auth/otp.js';
import { validate } from '../middleware/validate.js';
import {
  isProviderEnabled, getBaseUrl,
  googleAuthUrl, handleGoogleCallback,
  githubAuthUrl, handleGithubCallback,
  linkedinAuthUrl, handleLinkedinCallback,
} from '../auth/social.js';
import * as notifService from '../notifications/service.js';
import { trigger as scenarioTrigger } from '../notifications/scenarioEngine.js';

const router = Router();

const ROLE_DASHBOARD: Record<string, string> = {
  parent: 'unified-parent-dashboard',
  student: 'student-dashboard',
  campus_student: 'student-dashboard',
  job_seeker: 'student-dashboard',
  institute: 'unified-institute-dashboard',
  school: 'unified-institute-dashboard',
  college: 'unified-institute-dashboard',
  mentor: 'mentor-dashboard',
  hr_recruiter: 'hr-dashboard',
  ld_manager: 'hr-dashboard',
  super_admin: 'super-admin',
  ngo: 'ngo-dashboard',
};

function getRoleTarget(role: string): string {
  return ROLE_DASHBOARD[role.toLowerCase().trim()] ?? 'unified-parent-dashboard';
}

function formatUser(user: Record<string, unknown>) {
  return {
    id: user.id,
    fullName: user.fullName ?? user.full_name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    roles: user.roles,
    isVerified: user.isVerified ?? user.is_verified,
    profilePicture: user.profilePicture ?? user.profile_picture,
    dashboardTarget: getRoleTarget(user.role as string),
    createdAt: user.createdAt ?? user.created_at,
  };
}

async function findOrCreateUserByEmail(
  email: string,
  role = 'parent'
): Promise<Record<string, unknown>> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (rows.length > 0) {
    await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, rows[0].id));
    return rows[0] as Record<string, unknown>;
  }

  const created = await db
    .insert(users)
    .values({
      email,
      role,
      roles: [role],
      isVerified: true,
    })
    .returning();
  return created[0] as Record<string, unknown>;
}

const otpSendSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.string().default('parent'),
  purpose: z.enum(['login', 'register', 'reset']).default('login'),
});

router.post('/otp/send', validate(otpSendSchema), async (req, res) => {
  try {
    const { email, purpose } = req.body;
    const otp = await createOtp(email, purpose);
    await deliverOtp(email, otp);

    // Fire Login OTP notification (template 1) — non-blocking
    const otpUserRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (otpUserRows.length) {
      notifService.fire(1, { code: otp, expiry: '10 minutes' }, { recipientId: String(otpUserRows[0].id) }).catch(e =>
        console.warn('[Auth] Login OTP notification failed (non-fatal):', e)
      );
    }

    const masked = email.replace(/(.{2}).*(@.*)/, '$1***$2');
    res.json({
      success: true,
      message: `OTP sent to ${masked}`,
      expiresIn: 600,
    });
  } catch (err) {
    console.error('[Auth] OTP send error:', err);
    res.status(500).json({ error: 'OTP_SEND_FAILED', message: 'Failed to send OTP. Please try again.' });
  }
});

const otpVerifySchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  role: z.string().default('parent'),
  purpose: z.enum(['login', 'register', 'reset']).default('login'),
});

router.post('/otp/verify', validate(otpVerifySchema), async (req, res) => {
  try {
    const { email, otp, role } = req.body;
    const result = await verifyOtp(email, otp);

    if (!result.success) {
      res.status(400).json({ error: 'OTP_INVALID', message: result.reason });
      return;
    }

    const user = await findOrCreateUserByEmail(email, role);
    const roles = (user.roles as string[]) ?? [user.role as string];

    const token = signToken({
      userId: user.id as string,
      role: user.role as string,
      roles,
      email: user.email as string,
    });

    // ── New-device detection (OTP login) ────────────────────────────
    const userAgent = req.headers['user-agent'] ?? '';
    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    const deviceHash = crypto.createHash('sha256').update(userAgent + ip).digest('hex');
    const userId = user.id as string;

    const knownDevice = await db
      .select({ id: userDevices.id })
      .from(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceHash, deviceHash)));

    if (knownDevice.length) {
      setImmediate(() => {
        db.update(userDevices)
          .set({ lastSeenAt: new Date() })
          .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceHash, deviceHash)))
          .catch(() => {});
      });
    } else {
      const existingDevices = await db
        .select({ id: userDevices.id })
        .from(userDevices)
        .where(eq(userDevices.userId, userId))
        .limit(1);
      const isFirstDevice = existingDevices.length === 0;

      setImmediate(async () => {
        try {
          await db
            .insert(userDevices)
            .values({ userId, deviceHash, userAgent, ipAddress: ip })
            .onConflictDoUpdate({
              target: [userDevices.userId, userDevices.deviceHash],
              set: { lastSeenAt: new Date() },
            });
          if (!isFirstDevice) {
            await notifService.fire(3, { time: new Date().toLocaleTimeString() }, { recipientId: userId });
          }
        } catch (e) {
          console.warn('[Auth] New-device notification failed (non-fatal):', e);
        }
      });
    }
    // ──────────────────────────────────────────────────────────────────

    res.json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('[Auth] OTP verify error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Verification failed.' });
  }
});

const otpCheckSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  purpose: z.enum(['login', 'register', 'reset']).default('reset'),
});

router.post('/otp/check', validate(otpCheckSchema), async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    const result = await checkOtp(email, otp, purpose);
    if (!result.success) {
      res.status(400).json({ error: 'OTP_INVALID', message: result.reason });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] OTP check error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Verification failed.' });
  }
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
  role: z.string().nullish(),
});

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;

    const rows = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.mobile, username),
            eq(users.email, username),
            eq(users.username, username),
          ),
          eq(users.isActive, true),
        )
      )
      .limit(1);

    if (!rows.length) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' });
      return;
    }

    const user = rows[0] as Record<string, unknown>;

    if (!user.passwordHash) {
      res.status(401).json({ error: 'NO_PASSWORD', message: 'Please use OTP login or reset your password.' });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash as string);
    if (!match) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' });
      return;
    }

    const roles = (user.roles as string[]) ?? [user.role as string];
    const token = signToken({
      userId: user.id as string,
      role: user.role as string,
      roles,
      mobile: user.mobile as string | undefined,
      email: user.email as string | undefined,
    });

    // ── New-device detection ──────────────────────────────────────────
    const userAgent = req.headers['user-agent'] ?? '';
    const ip = req.ip ?? req.socket.remoteAddress ?? '';
    const deviceHash = crypto.createHash('sha256').update(userAgent + ip).digest('hex');
    const userId = user.id as string;

    const knownDevice = await db
      .select({ id: userDevices.id })
      .from(userDevices)
      .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceHash, deviceHash)));

    if (knownDevice.length) {
      // Known device — just bump last_seen_at
      setImmediate(() => {
        db.update(userDevices)
          .set({ lastSeenAt: new Date() })
          .where(and(eq(userDevices.userId, userId), eq(userDevices.deviceHash, deviceHash)))
          .catch(() => {});
      });
    } else {
      // New device — register it; only notify if user already had other devices
      const existingDevices = await db
        .select({ id: userDevices.id })
        .from(userDevices)
        .where(eq(userDevices.userId, userId))
        .limit(1);
      const isFirstDevice = existingDevices.length === 0;

      setImmediate(async () => {
        try {
          await db
            .insert(userDevices)
            .values({ userId, deviceHash, userAgent, ipAddress: ip })
            .onConflictDoUpdate({
              target: [userDevices.userId, userDevices.deviceHash],
              set: { lastSeenAt: new Date() },
            });
          if (!isFirstDevice) {
            await notifService.fire(3, { time: new Date().toLocaleTimeString() }, { recipientId: userId });
          }
        } catch (e) {
          console.warn('[Auth] New-device notification failed (non-fatal):', e);
        }
      });
    }
    // ────────────────────────────────────────────────────────────────────

    res.cookie('metryx_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Login failed.' });
  }
});

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional(),
  email: z.string().email('Invalid email').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['parent', 'student', 'institute', 'mentor', 'job_seeker', 'ngo', 'hr_recruiter', 'ld_manager', 'campus_student', 'college']).default('parent'),
  metadata: z.record(z.unknown()).optional(),
  profilePicture: z.string().url().optional(),
  oauthProvider: z.string().optional(),
}).refine(d => d.mobile || d.email, { message: 'Either mobile or email is required.' });

router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { fullName, mobile, email, password, role, metadata, profilePicture, oauthProvider } = req.body;

    if (mobile) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.mobile, mobile));
      if (existing.length) {
        res.status(409).json({ error: 'MOBILE_EXISTS', message: 'An account with this mobile number already exists.' });
        return;
      }
    }

    if (email) {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      if (existing.length) {
        res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email already exists.' });
        return;
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;

    // Assign platform UID based on role
    const uidSeq = role === 'parent' ? "nextval('parent_uid_seq')"
                 : role === 'student' ? "nextval('student_uid_seq')"
                 : role === 'mentor' ? "nextval('mentor_code_seq')"
                 : null;
    const uidPrefix = role === 'parent' ? 'MRX-P-'
                    : role === 'student' ? 'MRX-S-'
                    : role === 'mentor' ? 'MRX-M-'
                    : 'MRX-U-';
    let platformId: string | null = null;
    if (uidSeq) {
      const seqResult = await db.execute(sql.raw(`SELECT ${uidSeq} AS n`));
      platformId = uidPrefix + String((seqResult.rows[0] as Record<string, unknown>).n).padStart(5, '0');
    }

    const created = await db
      .insert(users)
      .values({
        fullName,
        mobile: mobile ?? null,
        email: email ?? null,
        passwordHash,
        role,
        roles: [role],
        metadata: metadata ?? null,
        platformId,
        profilePicture: profilePicture ?? null,
        ...(oauthProvider && { isVerified: true }),
      })
      .returning();

    const user = created[0] as Record<string, unknown>;
    const token = signToken({
      userId: user.id as string,
      role: user.role as string,
      roles: [role],
      mobile: user.mobile as string | undefined,
      email: user.email as string | undefined,
    });

    const formattedUser = formatUser(user);
    res.status(201).json({ token, user: formattedUser });

    const userId = user.id as string;
    const name = (user.fullName as string) ?? 'there';
    const userEmail = (user.email as string) ?? '';
    // Fire scenario-based notifications for user registration
    setImmediate(() => {
      scenarioTrigger('user.registered', {
        recipientId: userId,
        fullName: name,
        role,
        childName: name,
        profilePercent: '0',
        email: userEmail,
      }).catch(e => console.warn('[Auth] user.registered scenario failed (non-fatal):', e));
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Registration failed.' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = extractToken(req.headers.authorization as string)
      ?? req.cookies?.metryx_token;

    if (!token) {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'TOKEN_INVALID' });
      return;
    }

    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, payload.userId), eq(users.isActive, true)));
    if (!rows.length) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    res.json({ user: formatUser(rows[0] as Record<string, unknown>) });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or mobile number is required'),
});

router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { identifier } = req.body;
    const rows = await db
      .select({ mobile: users.mobile, email: users.email })
      .from(users)
      .where(
        and(
          or(eq(users.email, identifier), eq(users.mobile, identifier)),
          eq(users.isActive, true),
        )
      )
      .limit(1);

    if (!rows.length || !rows[0].email) {
      res.json({
        success: true,
        email: null,
        maskedEmail: null,
        message: 'If a matching account exists, an OTP has been sent.',
      });
      return;
    }

    const email = rows[0].email as string;
    const otp = await createOtp(email, 'reset');
    await deliverOtp(email, otp);

    // Fire Password Reset OTP notification (template 2) — non-blocking
    const resetUserRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (resetUserRows.length) {
      notifService.fire(2, { code: otp, expiry: '10 minutes' }, { recipientId: String(resetUserRows[0].id) }).catch(e =>
        console.warn('[Auth] Password reset OTP notification failed (non-fatal):', e)
      );
    }

    const maskedEmail = email.replace(/(.{2}).*(@.*)/, '$1***$2');

    res.json({
      success: true,
      email,
      maskedEmail,
      message: `OTP sent to ${maskedEmail}`,
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to process request. Please try again.' });
  }
});

const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const result = await verifyOtp(email, otp, 'reset');
    if (!result.success) {
      res.status(400).json({ error: 'OTP_INVALID', message: result.reason });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const updated = await db
      .update(users)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(users.email, email))
      .returning({ id: users.id });

    if (!updated.length) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Account not found.' });
      return;
    }

    res.json({ success: true, message: 'Password set successfully. You can now log in.' });
  } catch {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('metryx_token');
  res.json({ success: true });
});

// ─── Firebase Google Login ──────────────────────────────────────────────────

// Cache Google public keys for Firebase token verification
let cachedCerts: Record<string, string> = {};
let certsExpiry = 0;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (Date.now() < certsExpiry && Object.keys(cachedCerts).length) return cachedCerts;
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  const cacheControl = res.headers.get('cache-control') ?? '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  certsExpiry = Date.now() + (maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600_000);
  cachedCerts = await res.json() as Record<string, string>;
  return cachedCerts;
}

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? 'metryxone-48fd6';

async function verifyFirebaseIdToken(idToken: string): Promise<{ email?: string; name?: string; picture?: string }> {
  // Decode header to find the key id
  const header = JSON.parse(Buffer.from(idToken.split('.')[0], 'base64url').toString());
  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Unknown signing key');

  const decoded = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  }) as Record<string, unknown>;

  const firebase = decoded.firebase as { sign_in_provider?: string; identities?: Record<string, unknown> } | undefined;

  return {
    email: decoded.email as string | undefined,
    name: decoded.name as string | undefined,
    picture: decoded.picture as string | undefined,
  };
}

const firebaseGoogleSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
  role: z.string().default('parent'),
});

router.post('/firebase/google', validate(firebaseGoogleSchema), async (req, res) => {
  try {
    const { idToken, role } = req.body;

    // Verify the Firebase ID token using Google's public certificates
    let payload: { email?: string; name?: string; picture?: string };
    try {
      payload = await verifyFirebaseIdToken(idToken);
    } catch (err) {
      console.error('[Auth] Firebase token verification error:', err);
      res.status(401).json({ error: 'INVALID_TOKEN', message: 'Firebase token verification failed.' });
      return;
    }

    if (!payload.email) {
      res.status(400).json({ error: 'NO_EMAIL', message: 'Google account has no email.' });
      return;
    }

    // Check if user already exists (case-insensitive email match, any active status)
    const normalizedEmail = payload.email.toLowerCase().trim();
    const existingRows = await db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, normalizedEmail))
      .limit(1);

    if (existingRows.length) {
      // Existing user — log them in
      const user = existingRows[0] as Record<string, unknown>;
      if (payload.picture && !user.profilePicture) {
        await db.update(users)
          .set({ profilePicture: payload.picture, updatedAt: new Date() })
          .where(eq(users.id, user.id as string));
        user.profilePicture = payload.picture;
      }

      const roles = (user.roles as string[]) ?? [user.role as string];
      const token = signToken({
        userId: user.id as string,
        role: user.role as string,
        roles,
        email: user.email as string | undefined,
      });

      res.cookie('metryx_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        token,
        user: formatUser(user),
        isNewUser: false,
      });
    } else {
      // New user — don't create account, return Google profile for registration
      res.json({
        isNewUser: true,
        googleProfile: {
          email: normalizedEmail,
          fullName: payload.name || '',
          profilePicture: payload.picture || '',
        },
      });
    }
  } catch (err) {
    console.error('[Auth] Firebase Google login error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Google login failed.' });
  }
});

// ─── Social OAuth routes ─────────────────────────────────────────────────────

router.get('/social/status', (_req, res) => {
  res.json({
    google:   true, // Firebase Google is always available
    github:   isProviderEnabled('github'),
    linkedin: isProviderEnabled('linkedin'),
  });
});

// Google
router.get('/social/google', (req, res) => {
  if (!isProviderEnabled('google')) { res.status(503).json({ error: 'GOOGLE_NOT_CONFIGURED' }); return; }
  const role = String(req.query.role ?? 'parent');
  res.redirect(googleAuthUrl(role));
});
router.get('/social/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code) { res.redirect(`${getBaseUrl()}/login?social_error=google_denied`); return; }
    const redirectUrl = await handleGoogleCallback(code, state ?? '');
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[OAuth] Google callback error:', err);
    res.redirect(`${getBaseUrl()}/login?social_error=google_failed`);
  }
});

// GitHub
router.get('/social/github', (req, res) => {
  if (!isProviderEnabled('github')) { res.status(503).json({ error: 'GITHUB_NOT_CONFIGURED' }); return; }
  const role = String(req.query.role ?? 'parent');
  res.redirect(githubAuthUrl(role));
});
router.get('/social/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code) { res.redirect(`${getBaseUrl()}/login?social_error=github_denied`); return; }
    const redirectUrl = await handleGithubCallback(code, state ?? '');
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[OAuth] GitHub callback error:', err);
    res.redirect(`${getBaseUrl()}/login?social_error=github_failed`);
  }
});

// LinkedIn
router.get('/social/linkedin', (req, res) => {
  if (!isProviderEnabled('linkedin')) { res.status(503).json({ error: 'LINKEDIN_NOT_CONFIGURED' }); return; }
  const role = String(req.query.role ?? 'parent');
  res.redirect(linkedinAuthUrl(role));
});
router.get('/social/linkedin/callback', async (req, res) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code) { res.redirect(`${getBaseUrl()}/login?social_error=linkedin_denied`); return; }
    const redirectUrl = await handleLinkedinCallback(code, state ?? '');
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[OAuth] LinkedIn callback error:', err);
    res.redirect(`${getBaseUrl()}/login?social_error=linkedin_failed`);
  }
});

/* ── Assessment registration OTP ─────────────────────────────────────── */
router.post('/assessment-otp/send', async (req, res) => {
  const { email, force } = req.body as { email?: string; force?: boolean };
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  const normalized = email.trim().toLowerCase();

  // Check if this email already has a registered account (unless forced)
  if (!force) {
    try {
      const existing = await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(eq(users.email, normalized))
        .limit(1);
      if (existing.length) {
        const raw = existing[0].fullName ?? '';
        const firstName = raw.split(' ')[0] || null;
        res.status(409).json({ error: 'EMAIL_EXISTS', firstName });
        return;
      }
    } catch {
      // If the DB check fails, proceed optimistically — don't block the OTP
    }
  }

  try {
    const otp = await createOtp(normalized, 'assessment_register');
    await deliverOtp(normalized, otp);
    console.log(`[Assessment OTP] Sent to ${normalized}`);
    res.json({ sent: true });
  } catch (err) {
    console.error('[Assessment OTP] Send failed:', err);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

router.post('/assessment-otp/verify', async (req, res) => {
  const { email, otp } = req.body as { email?: string; otp?: string };
  if (!email || !otp) {
    res.status(400).json({ error: 'Email and verification code are required' });
    return;
  }
  const normalized = email.trim().toLowerCase();
  const result = await verifyOtp(normalized, String(otp).trim(), 'assessment_register');
  if (result.success) {
    res.json({ verified: true });
  } else {
    res.status(400).json({ error: result.reason ?? 'Invalid verification code' });
  }
});

// ── Parent Consent Tracking ──────────────────────────────────────────────────

router.post('/parent-consent/send', async (req, res) => {
  try {
    const token = extractToken(req.headers.authorization as string) ?? req.cookies?.metryx_token;
    if (!token) { res.status(401).json({ error: 'UNAUTHENTICATED' }); return; }
    const payload = verifyToken(token);
    if (!payload) { res.status(401).json({ error: 'TOKEN_INVALID' }); return; }
    const userId = payload.userId;

    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: 'USER_NOT_FOUND' }); return; }
    const user = rows[0];
    const meta = (user.metadata as Record<string, unknown>) ?? {};

    if (!meta.requiresParentConsent) {
      res.status(400).json({ error: 'NOT_REQUIRED', message: 'No parent consent required for this account.' });
      return;
    }

    const consentToken = crypto.randomBytes(32).toString('hex');
    const now = new Date().toISOString();

    await db.update(users)
      .set({ metadata: { ...meta, consentToken, consentStatus: 'pending', consentRequestedAt: now } })
      .where(eq(users.id, userId));

    res.json({ consentToken, parentEmail: meta.parentEmail, requestedAt: now });
  } catch (err) {
    console.error('[Auth] parent-consent/send error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/parent-consent/status', async (req, res) => {
  try {
    const token = extractToken(req.headers.authorization as string) ?? req.cookies?.metryx_token;
    if (!token) { res.status(401).json({ error: 'UNAUTHENTICATED' }); return; }
    const payload = verifyToken(token);
    if (!payload) { res.status(401).json({ error: 'TOKEN_INVALID' }); return; }
    const userId = payload.userId;

    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!rows.length) { res.status(404).json({ error: 'USER_NOT_FOUND' }); return; }
    const meta = (rows[0].metadata as Record<string, unknown>) ?? {};

    res.json({
      requiresConsent: !!meta.requiresParentConsent,
      consentStatus: (meta.consentStatus as string) ?? null,
      parentEmail: (meta.parentEmail as string) ?? null,
      consentToken: (meta.consentToken as string) ?? null,
      requestedAt: (meta.consentRequestedAt as string) ?? null,
      approvedAt: (meta.consentApprovedAt as string) ?? null,
    });
  } catch (err) {
    console.error('[Auth] parent-consent/status error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/parent-consent/approve/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const result = await db.execute(
      sql`SELECT id, metadata FROM users WHERE metadata->>'consentToken' = ${token} LIMIT 1`
    );
    if (!result.rows.length) {
      res.status(404).json({ error: 'INVALID_TOKEN', message: 'This consent link is invalid or has already been used.' });
      return;
    }
    const row = result.rows[0] as { id: string; metadata: Record<string, unknown> };
    if (row.metadata.consentStatus === 'approved') {
      res.json({ alreadyApproved: true, message: 'Consent was already approved.' });
      return;
    }
    const now = new Date().toISOString();
    await db.update(users)
      .set({ metadata: { ...row.metadata, consentStatus: 'approved', consentApprovedAt: now } })
      .where(eq(users.id, row.id));
    res.json({ approved: true, approvedAt: now, studentName: row.metadata.fullName ?? '' });
  } catch (err) {
    console.error('[Auth] parent-consent/approve error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
