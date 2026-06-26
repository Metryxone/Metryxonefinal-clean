// ─────────────────────────────────────────────────────────────────────────────
// CSRF protection — signed double-submit token (stateless).
//
// WHY: the app authenticates browser requests with a `sameSite:'lax'` session
// cookie. `lax` blocks the worst cross-site sub-requests but NOT top-level POST
// form navigations, leaving state-changing endpoints CSRF-exposed. This module
// closes that gap for 100% of cookie-authenticated mutating requests.
//
// HOW (signed double-submit, no server-side state):
//   • A non-httpOnly cookie `mx.csrf` carries `<rawToken>.<hmac(rawToken)>`.
//   • Same-origin JS reads the cookie and echoes the FULL value in the
//     `x-csrf-token` header on every mutating request (POST/PUT/PATCH/DELETE).
//   • The server requires: header === cookie  AND  the cookie's HMAC is valid.
//   Cross-site attackers can neither read the victim's cookie nor set a custom
//   header (no CORS is granted), and cannot forge a valid signed cookie without
//   the server secret — so a forged top-level POST is rejected with 403.
//
// COVERAGE: mounted as the FIRST middleware (before the /api/v1/upload reverse
// proxy and before the /api/v1 → /api rewrite), so the ENTIRE /api surface —
// including the proxied upload service — is gated. `canonicalPath()` collapses
// the `/api/v1/*` version namespace so exempt/token matching is independent of
// where this runs in the chain.
//
// EXEMPTIONS (not CSRF-vulnerable, must stay byte-identical for valid traffic):
//   • Safe methods: GET / HEAD / OPTIONS.
//   • `Authorization: Bearer …` requests *that carry no ambient session cookie*.
//     Token auth is not ambient (a cross-site page cannot set an Authorization
//     header without a CORS preflight the backend never grants), and such callers
//     may be non-browser API clients that cannot participate in cookie
//     double-submit. The exemption is NARROWED to requests without an `mx.sid`
//     session cookie: if a browser presents BOTH a Bearer header and the ambient
//     session cookie, the request is still CSRF-gated (the SPA fetch wrapper
//     supplies the token on every same-origin /api mutation, so this never
//     breaks legitimate first-party traffic).
//   • Server-to-server webhooks (HMAC-signature verified): the Razorpay
//     payment + commercial webhooks.
//
// FAIL CLOSED: as a security control, an unexpected internal error in the guard
// does NOT silently allow a protected mutation — it returns 403. Only requests
// that are exempt-by-design (safe methods, webhooks, non-ambient Bearer,
// non-/api paths) degrade open on error.
//
// This is a SECURITY CONTROL, so — unlike additive feature phases — it defaults
// ON. A documented kill-switch (`CSRF_PROTECTION_DISABLED=1`) disables
// enforcement without a redeploy if it ever blocks legitimate traffic; token
// issuance still happens so re-enabling is seamless.
// ─────────────────────────────────────────────────────────────────────────────
import type { Request, Response, NextFunction } from "express";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";

export const CSRF_COOKIE = "mx.csrf";
export const CSRF_HEADER = "x-csrf-token";
const SESSION_COOKIE = "mx.sid"; // express-session cookie name (see routes.ts)
const TOKEN_ENDPOINT = "/api/csrf-token";

// Mutating webhook endpoints authenticated by upstream HMAC signatures — these
// are legitimately cookie-less, server-to-server, and must NOT be CSRF-gated.
const EXEMPT_PATHS = new Set<string>([
  "/api/capadex/payment/webhook",
  "/api/commercial/razorpay/webhook",
]);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const IS_PROD = process.env.NODE_ENV === "production";

// Reuse the session secret so we don't introduce a second secret to manage; fall
// back to a dedicated CSRF_SECRET, then (dev only) a STABLE constant so existing
// cookies keep validating across restarts. In production a real secret is set.
const SECRET =
  process.env.CSRF_SECRET ||
  process.env.SESSION_SECRET ||
  (IS_PROD
    ? // Should never reach here: index.ts fails fast without SESSION_SECRET in prod.
      randomBytes(48).toString("hex")
    : "dev-only-csrf-secret-do-not-use-in-production");

function sign(raw: string): string {
  return createHmac("sha256", SECRET).update(raw).digest("hex");
}

function mintToken(): string {
  const raw = randomBytes(24).toString("hex");
  return `${raw}.${sign(raw)}`;
}

/** Constant-time string compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/** A well-formed `<raw>.<sig>` cookie whose signature verifies. */
function isValidToken(value: string | undefined): value is string {
  if (!value) return false;
  const dot = value.lastIndexOf(".");
  if (dot <= 0 || dot === value.length - 1) return false;
  const raw = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  return safeEqual(sig, sign(raw));
}

/** Read a single cookie value out of the raw Cookie header (no cookie-parser dep). */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Collapse the `/api/v1/*` version namespace to its canonical `/api/*` form.
 * The version rewrite happens later in the middleware chain, but this guard runs
 * FIRST (to cover the upload proxy), so exempt/token matching must normalize the
 * path itself rather than rely on the rewrite having occurred.
 */
function canonicalPath(p: string): string {
  if (p.startsWith("/api/v1/")) return "/api" + p.slice("/api/v1".length);
  return p;
}

/** True for a non-ambient Bearer request (token auth, no session cookie present). */
function isExemptBearer(req: Request): boolean {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return false;
  // If the browser also sends the ambient session cookie, the request is still
  // CSRF-relevant and must be gated — do NOT exempt it.
  return !readCookie(req, SESSION_COOKIE);
}

function setCsrfCookie(res: Response, value: string): void {
  res.cookie(CSRF_COOKIE, value, {
    httpOnly: false, // must be readable by same-origin JS for double-submit
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7, // mirror the session cookie lifetime (1 week)
  });
}

/** Is this request exempt from enforcement by design (safe/webhook/non-ambient Bearer)? */
function isExemptRequest(req: Request): boolean {
  if (SAFE_METHODS.has(req.method)) return true;
  if (EXEMPT_PATHS.has(canonicalPath(req.path))) return true;
  if (isExemptBearer(req)) return true;
  return false;
}

/**
 * Express middleware enforcing signed double-submit CSRF on cookie-authenticated
 * mutating requests. Mount as the FIRST middleware so the whole /api surface
 * (including the upload reverse-proxy) is covered.
 *
 * Fail behaviour: a genuine validation miss is a 403. An unexpected internal
 * error FAILS CLOSED (403) for protected mutations; only exempt-by-design
 * requests degrade open.
 */
export function csrfProtection() {
  const disabled = process.env.CSRF_PROTECTION_DISABLED === "1";

  return function csrf(req: Request, res: Response, next: NextFunction): void {
    try {
      // Only concern ourselves with the API surface; static/SPA assets pass through.
      if (!req.path.startsWith("/api")) return next();

      // Ensure a valid token cookie exists; (re)issue when absent or tampered.
      let token = readCookie(req, CSRF_COOKIE);
      if (!isValidToken(token)) {
        token = mintToken();
        setCsrfCookie(res, token);
      }

      // Bootstrap endpoint: hand the SPA a guaranteed-fresh cookie + token.
      if (req.method === "GET" && canonicalPath(req.path) === TOKEN_ENDPOINT) {
        res.json({ token });
        return;
      }

      if (disabled) return next();

      // Exempt-by-design requests (safe methods, signed webhooks, non-ambient Bearer).
      if (isExemptRequest(req)) return next();

      // Enforce signed double-submit on the cookie-authenticated mutation.
      const headerToken = req.headers[CSRF_HEADER];
      const provided = Array.isArray(headerToken) ? headerToken[0] : headerToken;

      if (!provided || !token || !isValidToken(token) || !safeEqual(provided, token)) {
        res.status(403).json({
          error: "csrf_token_invalid",
          message:
            "Missing or invalid CSRF token. Reload the page and retry; if this persists, your session may have expired.",
        });
        return;
      }

      return next();
    } catch {
      // FAIL CLOSED: a security control must not allow a protected mutation when
      // its own validation errors. Exempt-by-design requests still degrade open.
      try {
        if (disabled || !req.path.startsWith("/api") || isExemptRequest(req)) {
          return next();
        }
      } catch {
        /* fall through to the 403 below */
      }
      res.status(403).json({
        error: "csrf_error",
        message: "CSRF validation failed. Reload the page and retry.",
      });
      return;
    }
  };
}
