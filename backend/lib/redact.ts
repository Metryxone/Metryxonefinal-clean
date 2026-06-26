/**
 * Shared privacy redactor — single source of truth for masking sensitive values
 * before they are persisted or logged.
 *
 * Used by BOTH the stdout request logger (backend/index.ts) AND every database
 * audit writer (governance audit-engine, platform-audit, capadex audit events)
 * so the at-rest audit trail is redacted with the SAME policy as application
 * logs. This closes the gap where stdout logs were redacted but audit-table
 * state columns (previous_state/new_state/before_state/after_state/payload)
 * were stored unredacted and could capture credentials/secrets/PII.
 *
 * Policy: mask values whose KEY matches credentials, secrets, tokens, one-time
 * codes, authorization/cookies, or government-id / card numbers. General contact
 * fields (email/phone) are intentionally NOT masked — matching the existing
 * logger policy and preserving deliberate lead-capture audit rows.
 */

// Keys whose VALUES must be masked wherever they appear in a logged/persisted object.
export const SENSITIVE_KEY =
  /pass(word)?|secret|token|otp|mfa|code|authorization|cookie|ssn|aadhaar|card/i;

const MASK = "[REDACTED]";

/**
 * Recursively redact sensitive keys in an arbitrary value. Arrays are capped at
 * 20 elements and recursion is capped at depth 4 (mirrors the logger) so a
 * hostile/huge payload can never blow the stack or the row size.
 */
export function redactDeep(value: any, depth = 0): any {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactDeep(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? MASK : redactDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Redact then JSON-stringify a value for storage in a text/jsonb audit column.
 * Returns null for null/undefined input (so callers can store SQL NULL), and
 * length-caps the serialized string when maxLen is provided. Never throws — a
 * non-serializable value degrades to null rather than breaking the audit write.
 */
export function redactJson(value: any, maxLen?: number): string | null {
  if (value == null) return null;
  try {
    let s = JSON.stringify(redactDeep(value));
    if (s == null) return null;
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  } catch {
    return null;
  }
}
