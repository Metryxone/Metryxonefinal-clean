import { db } from '../db/drizzle.js';
import { users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { signToken } from './jwt.js';

// ─── Config helpers ───────────────────────────────────────────────────────────

export function getBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return 'http://localhost:5173';
}

export function isProviderEnabled(provider: 'google' | 'github' | 'linkedin'): boolean {
  const keys: Record<string, string[]> = {
    google:   ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    github:   ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
    linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  };
  return keys[provider].every(k => !!process.env[k]);
}

function encodeState(data: Record<string, string>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeState(state: string): Record<string, string> {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return {};
  }
}

// ─── Upsert helper ────────────────────────────────────────────────────────────

async function upsertSocialUser(params: {
  email: string;
  fullName: string;
  profilePicture?: string;
  role: string;
  provider: string;
}) {
  const { email, fullName, profilePicture, role, provider } = params;

  const existing = await db.select().from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1);

  if (existing.length) {
    const user = existing[0];
    if (profilePicture && !user.profilePicture) {
      await db.update(users)
        .set({ profilePicture, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
    return user;
  }

  const created = await db.insert(users)
    .values({
      email,
      fullName,
      profilePicture: profilePicture ?? null,
      role,
      roles: JSON.stringify([role]),
      isActive: true,
      isVerified: true,
      metadata: JSON.stringify({ oauth_provider: provider }),
    })
    .returning();
  return created[0];
}

function buildTokenRedirect(user: Record<string, unknown>, baseUrl: string): string {
  const roles = (user.roles as string[]) ?? [user.role as string];
  const token = signToken({
    userId: user.id as string,
    role: user.role as string,
    roles,
    email: user.email as string | undefined,
  });
  const params = new URLSearchParams({
    social_token: token,
    social_role: user.role as string,
  });
  return `${baseUrl}/login?${params.toString()}`;
}

// ─── Google ───────────────────────────────────────────────────────────────────

export function googleAuthUrl(role: string): string {
  const redirectUri = `${getBaseUrl()}/api/auth/social/google/callback`;
  const state = encodeState({ role, nonce: Math.random().toString(36).slice(2) });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleGoogleCallback(code: string, state: string): Promise<string> {
  const { role = 'parent' } = decodeState(state);
  const redirectUri = `${getBaseUrl()}/api/auth/social/google/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json() as Record<string, string>;
  if (!tokenData.access_token) throw new Error('Google token exchange failed');

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await userRes.json() as Record<string, string>;

  const user = await upsertSocialUser({
    email: profile.email,
    fullName: profile.name || profile.email,
    profilePicture: profile.picture,
    role,
    provider: 'google',
  });

  return buildTokenRedirect(user as Record<string, unknown>, getBaseUrl());
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

export function githubAuthUrl(role: string): string {
  const state = encodeState({ role, nonce: Math.random().toString(36).slice(2) });
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${getBaseUrl()}/api/auth/social/github/callback`,
    scope: 'user:email read:user',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function handleGithubCallback(code: string, state: string): Promise<string> {
  const { role = 'parent' } = decodeState(state);

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${getBaseUrl()}/api/auth/social/github/callback`,
    }),
  });
  const tokenData = await tokenRes.json() as Record<string, string>;
  if (!tokenData.access_token) throw new Error('GitHub token exchange failed');

  const [userRes, emailRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'MetryxOne' } }),
    fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'MetryxOne' } }),
  ]);

  const profile = await userRes.json() as Record<string, string>;
  const emails = await emailRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
  const primaryEmail = emails.find(e => e.primary && e.verified)?.email || profile.email;

  if (!primaryEmail) throw new Error('No verified email on GitHub account');

  const user = await upsertSocialUser({
    email: primaryEmail,
    fullName: profile.name || profile.login,
    profilePicture: profile.avatar_url,
    role,
    provider: 'github',
  });

  return buildTokenRedirect(user as Record<string, unknown>, getBaseUrl());
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

export function linkedinAuthUrl(role: string): string {
  const state = encodeState({ role, nonce: Math.random().toString(36).slice(2) });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: `${getBaseUrl()}/api/auth/social/linkedin/callback`,
    state,
    scope: 'openid profile email',
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function handleLinkedinCallback(code: string, state: string): Promise<string> {
  const { role = 'parent' } = decodeState(state);
  const redirectUri = `${getBaseUrl()}/api/auth/social/linkedin/callback`;

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  const tokenData = await tokenRes.json() as Record<string, string>;
  if (!tokenData.access_token) throw new Error('LinkedIn token exchange failed');

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json() as Record<string, string>;

  const user = await upsertSocialUser({
    email: profile.email,
    fullName: profile.name || profile.email,
    profilePicture: profile.picture,
    role,
    provider: 'linkedin',
  });

  return buildTokenRedirect(user as Record<string, unknown>, getBaseUrl());
}
