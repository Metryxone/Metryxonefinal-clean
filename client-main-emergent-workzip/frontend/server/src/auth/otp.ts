import bcrypt from 'bcryptjs';
import { db } from '../db/drizzle.js';
import { otpTokens } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { sendEmail } from '../notifications/delivery/email.js';

const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const SALT_ROUNDS = 10;

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createOtp(identifier: string, purpose = 'login'): Promise<string> {
  const otp = generateOtp();
  const hash = await bcrypt.hash(otp, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.update(otpTokens)
    .set({ isUsed: true })
    .where(and(eq(otpTokens.identifier, identifier), eq(otpTokens.purpose, purpose), eq(otpTokens.isUsed, false)));

  await db.insert(otpTokens)
    .values({ identifier, otpHash: hash, purpose, expiresAt });

  return otp;
}

export async function verifyOtp(
  identifier: string,
  otp: string,
  purpose = 'login'
): Promise<{ success: boolean; reason?: string }> {
  const DEV_BYPASS = process.env.NODE_ENV !== 'production' && otp === '123456';
  if (DEV_BYPASS) return { success: true };

  const rows = await db.select({
    id: otpTokens.id,
    otpHash: otpTokens.otpHash,
    expiresAt: otpTokens.expiresAt,
    attempts: otpTokens.attempts,
  }).from(otpTokens)
    .where(and(eq(otpTokens.identifier, identifier), eq(otpTokens.purpose, purpose), eq(otpTokens.isUsed, false)))
    .orderBy(desc(otpTokens.createdAt))
    .limit(1);

  if (!rows.length) return { success: false, reason: 'OTP not found or already used.' };

  const token = rows[0];

  if (new Date(token.expiresAt) < new Date()) {
    return { success: false, reason: 'OTP has expired.' };
  }

  if (token.attempts >= MAX_OTP_ATTEMPTS) {
    return { success: false, reason: 'Too many incorrect attempts.' };
  }

  const match = await bcrypt.compare(otp, token.otpHash);

  if (!match) {
    await db.update(otpTokens)
      .set({ attempts: sql`${otpTokens.attempts} + 1` })
      .where(eq(otpTokens.id, token.id));
    return { success: false, reason: 'Incorrect OTP.' };
  }

  await db.update(otpTokens).set({ isUsed: true }).where(eq(otpTokens.id, token.id));
  return { success: true };
}

export async function checkOtp(
  identifier: string,
  otp: string,
  purpose = 'login'
): Promise<{ success: boolean; reason?: string }> {
  const DEV_BYPASS = process.env.NODE_ENV !== 'production' && otp === '123456';
  if (DEV_BYPASS) return { success: true };

  const rows = await db.select({
    id: otpTokens.id,
    otpHash: otpTokens.otpHash,
    expiresAt: otpTokens.expiresAt,
    attempts: otpTokens.attempts,
  }).from(otpTokens)
    .where(and(eq(otpTokens.identifier, identifier), eq(otpTokens.purpose, purpose), eq(otpTokens.isUsed, false)))
    .orderBy(desc(otpTokens.createdAt))
    .limit(1);

  if (!rows.length) return { success: false, reason: 'OTP not found or already used.' };

  const token = rows[0];

  if (new Date(token.expiresAt) < new Date()) {
    return { success: false, reason: 'OTP has expired.' };
  }

  if (token.attempts >= MAX_OTP_ATTEMPTS) {
    return { success: false, reason: 'Too many incorrect attempts.' };
  }

  const match = await bcrypt.compare(otp, token.otpHash);

  if (!match) {
    await db.update(otpTokens)
      .set({ attempts: sql`${otpTokens.attempts} + 1` })
      .where(eq(otpTokens.id, token.id));
    return { success: false, reason: 'Incorrect OTP.' };
  }

  return { success: true };
}

export async function deliverOtp(email: string, otp: string): Promise<void> {
  console.log(`[OTP] Email: ${email} → OTP: ${otp}`);

  try {
    await sendEmail({
      to: email,
      name: email.split('@')[0],
      title: 'Your MetryxOne Login OTP',
      message: `Your one-time password is:<br><br>
        <div style="text-align:center;margin:16px 0;">
          <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#344E86;font-family:monospace;">${otp}</span>
        </div>
        This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.<br><br>
        If you did not request this, please ignore this email.`,
    });
  } catch (err) {
    console.error('[OTP] Email delivery failed:', err);
    if (process.env.NODE_ENV === 'production') throw err;
  }
}
