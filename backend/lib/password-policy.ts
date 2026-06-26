import { createHash } from "crypto";

/**
 * Shared password policy — single source of truth for every place the platform
 * accepts a USER-CHOSEN password (self-registration, password reset) and for
 * validating the operator-supplied super-admin seed credential.
 *
 * Two layers:
 *   1. validatePasswordComplexity() — synchronous, offline, ALWAYS enforced.
 *   2. checkPasswordBreached()      — HaveIBeenPwned k-anonymity, best-effort,
 *                                     network-dependent, NEVER blocks on infra
 *                                     failure (complexity already set a floor).
 *
 * Honesty: the breach check reports whether it actually ran (`checked`). We do
 * not pretend a password is "clean" when the breach API was unreachable — we
 * simply fall back to the complexity floor and surface `breachChecked=false`.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Small embedded denylist of the most common / contextually-obvious weak
 * passwords. This is an OFFLINE defense-in-depth floor (works even when the
 * HIBP API is unreachable). The breach check covers the long tail.
 */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "passw0rd1",
  "admin", "admin123", "admin1234", "administrator", "welcome", "welcome1",
  "welcome123", "letmein", "letmein123", "qwerty", "qwerty123", "qwertyuiop",
  "12345678", "123456789", "1234567890", "1234567891", "111111", "000000",
  "iloveyou", "abc12345", "abcd1234", "changeme", "changeme123", "metryxone",
  "metryx123", "superadmin", "super_admin", "trustno1", "monkey123",
]);

export interface ComplexityResult {
  ok: boolean;
  errors: string[];
}

/**
 * Synchronous complexity / structure validation. Always enforced everywhere.
 */
export function validatePasswordComplexity(
  password: string,
  opts: { identifier?: string | null } = {},
): ComplexityResult {
  const errors: string[] = [];
  const pw = typeof password === "string" ? password : "";

  if (pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
  if (pw.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters long.`);
  }
  if (!/[a-z]/.test(pw)) errors.push("Password must include at least one lowercase letter.");
  if (!/[A-Z]/.test(pw)) errors.push("Password must include at least one uppercase letter.");
  if (!/[0-9]/.test(pw)) errors.push("Password must include at least one number.");
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push("Password must include at least one symbol.");

  const lower = pw.toLowerCase();
  if (lower && COMMON_PASSWORDS.has(lower)) {
    errors.push("Password is too common and easily guessed. Choose something more unique.");
  }

  // Reject passwords that embed the account identifier (username / email local-part).
  const id = (opts.identifier || "").toString().toLowerCase().trim();
  if (id) {
    const localPart = id.includes("@") ? id.split("@")[0] : id;
    if (localPart.length >= 4 && lower.includes(localPart)) {
      errors.push("Password must not contain your username or email address.");
    }
  }

  return { ok: errors.length === 0, errors };
}

export interface BreachResult {
  /** true only when the API ran AND the password was found with a real count. */
  breached: boolean;
  /** true only when the breach API actually responded. */
  checked: boolean;
  count: number;
}

/**
 * HaveIBeenPwned k-anonymity range check. Free, no API key required.
 *
 * We SHA-1 the password, send ONLY the first 5 hex chars of the hash, and match
 * the remaining suffix locally — the full hash / plaintext never leaves the
 * process. `Add-Padding` mixes synthetic rows in so the response size can't be
 * used to infer the answer. Best-effort + never throws: any network/parse error
 * (or a non-2xx response) returns `checked:false`.
 */
export async function checkPasswordBreached(
  password: string,
  timeoutMs = 2500,
): Promise<BreachResult> {
  try {
    const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let text: string;
    try {
      const resp = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true" },
        signal: controller.signal,
      });
      if (!resp.ok) return { breached: false, checked: false, count: 0 };
      text = await resp.text();
    } finally {
      clearTimeout(timer);
    }

    for (const line of text.split("\n")) {
      const [hashSuffix, countStr] = line.trim().split(":");
      if (hashSuffix === suffix) {
        const count = parseInt(countStr, 10) || 0;
        // Add-Padding injects synthetic count=0 rows; only a positive count is a real hit.
        return { breached: count > 0, checked: true, count };
      }
    }
    return { breached: false, checked: true, count: 0 };
  } catch {
    return { breached: false, checked: false, count: 0 };
  }
}

export interface PolicyResult {
  ok: boolean;
  errors: string[];
  /** whether the breach API actually ran (false when skipped or unreachable). */
  breachChecked: boolean;
}

/**
 * Full policy gate for user-chosen passwords: complexity (always) + breach
 * (best-effort). Returns the first failure layer's errors.
 */
export async function assertPasswordAcceptable(
  password: string,
  opts: { identifier?: string | null; checkBreach?: boolean } = {},
): Promise<PolicyResult> {
  const complexity = validatePasswordComplexity(password, opts);
  if (!complexity.ok) {
    return { ok: false, errors: complexity.errors, breachChecked: false };
  }
  if (opts.checkBreach === false) {
    return { ok: true, errors: [], breachChecked: false };
  }
  const breach = await checkPasswordBreached(password);
  if (breach.breached) {
    return {
      ok: false,
      breachChecked: true,
      errors: ["This password has appeared in a known data breach. Please choose a different one."],
    };
  }
  return { ok: true, errors: [], breachChecked: breach.checked };
}
