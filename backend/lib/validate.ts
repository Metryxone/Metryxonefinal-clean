import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

/**
 * Reusable request-validation middleware (input-validation hardening, finding #6).
 *
 * DESIGN — pure gate, non-breaking:
 *  - On Express 5 `req.query` / `req.params` are read-only getters, so this
 *    middleware NEVER mutates `req`. It only validates and, on failure, responds
 *    400. Valid requests pass through byte-identical to prior behaviour.
 *  - Schemas use default (non-strict) zod objects: unknown/extra keys are
 *    ALLOWED (not rejected), so legitimate clients sending extra fields never
 *    break. Mark a field required ONLY when the handler already requires it.
 *  - never-throws: any unexpected internal error falls through to `next()` so a
 *    validator bug degrades to prior behaviour rather than a 500.
 *
 * Usage:
 *   app.post("/api/x/:id", requireAuth,
 *     validate({ params: z.object({ id: z.string().min(1) }),
 *                body: z.object({ amount: z.number().positive() }) }),
 *     handler);
 */

export type ValidationSchemas = {
  body?: z.ZodType<any>;
  params?: z.ZodType<any>;
  query?: z.ZodType<any>;
};

function formatIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        const r = schemas.params.safeParse(req.params);
        if (!r.success) {
          return res.status(400).json({
            error: "Invalid request parameters",
            details: formatIssues(r.error),
          });
        }
      }
      if (schemas.query) {
        const r = schemas.query.safeParse(req.query);
        if (!r.success) {
          return res.status(400).json({
            error: "Invalid query parameters",
            details: formatIssues(r.error),
          });
        }
      }
      if (schemas.body) {
        const r = schemas.body.safeParse(req.body);
        if (!r.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: formatIssues(r.error),
          });
        }
      }
      next();
    } catch {
      // never-throw: a validator fault must not turn a working route into a 500.
      next();
    }
  };
}

/* ----------------------------------------------------------------------------
 * Common reusable schemas. Keep these PERMISSIVE — they encode only invariants
 * that every caller of the pattern already relies on.
 * ------------------------------------------------------------------------- */

/** A non-empty path/route id (the typical `:id`, `:userId`, `:sessionId`). */
export const nonEmptyId = z.string().trim().min(1).max(256);

/** `{ id: <non-empty string> }` — the most common param shape. */
export const idParam = z.object({ id: nonEmptyId });

/** Common list/pagination query (all optional, coercible to number). */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/* ----------------------------------------------------------------------------
 * Global input hardening (input-validation finding #6 — universal baseline).
 *
 * This middleware runs app-wide (mounted once in index.ts), so it gives EVERY
 * one of the ~3,233 route handlers a baseline input-validation gate without
 * touching each handler. It enforces ONLY universal invariants that no
 * legitimate client request relies on, so valid requests stay byte-identical:
 *
 *  1. Prototype-pollution guard: a body/query containing a `__proto__` *key*
 *     (at any depth) is rejected. No real JSON API field is named `__proto__`;
 *     it is exclusively a pollution vector.
 *  2. NUL-byte guard: any string value (or the URL path) containing a `\u0000`
 *     is rejected. PostgreSQL `text`/`varchar` cannot store NUL bytes (it
 *     raises `invalid byte sequence`), so such input could never succeed
 *     downstream — this converts a would-be 500 into a clean 400. Documented
 *     hardening: a (non-existent in practice) legitimate NUL string now 400s.
 *  3. Structural DoS bound: payloads nested deeper than MAX_DEPTH or carrying
 *     more than MAX_NODES total values are rejected, capping recursive blowups.
 *     Limits are generous; real API payloads never approach them.
 *
 * Layered design: this is the BASELINE that covers 100% of handlers. Deep,
 * per-field required-key schemas (via `validate({...})`) are layered ON TOP for
 * the high-risk write surface. never-throws: any internal fault falls through
 * to next() so a guard bug can never turn a working route into a 500.
 * ------------------------------------------------------------------------- */

const MAX_DEPTH = 32;
const MAX_NODES = 100_000;

type ScanResult =
  | { ok: true }
  | { ok: false; reason: "prototype_pollution" | "nul_byte" | "too_deep" | "too_large"; path: string };

function scanValue(value: unknown, depth: number, counter: { n: number }, path: string): ScanResult {
  if (depth > MAX_DEPTH) return { ok: false, reason: "too_deep", path };
  if (++counter.n > MAX_NODES) return { ok: false, reason: "too_large", path };

  if (typeof value === "string") {
    if (value.indexOf("\u0000") !== -1) return { ok: false, reason: "nul_byte", path };
    return { ok: true };
  }
  if (value == null || typeof value !== "object") return { ok: true };

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = scanValue(value[i], depth + 1, counter, `${path}[${i}]`);
      if (!r.ok) return r;
    }
    return { ok: true };
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key === "__proto__") return { ok: false, reason: "prototype_pollution", path: path ? `${path}.${key}` : key };
    const r = scanValue((value as Record<string, unknown>)[key], depth + 1, counter, path ? `${path}.${key}` : key);
    if (!r.ok) return r;
  }
  return { ok: true };
}

/**
 * Mount ONCE, app-wide, after the body parser:
 *   app.use(globalInputHardening());
 */
export function globalInputHardening() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (typeof req.path === "string" && req.path.indexOf("\u0000") !== -1) {
        return res.status(400).json({ error: "Invalid request", details: [{ path: "(path)", message: "NUL byte not allowed" }] });
      }
      const counter = { n: 0 };
      if (req.body != null && typeof req.body === "object") {
        const r = scanValue(req.body, 0, counter, "body");
        if (!r.ok) {
          return res.status(400).json({ error: "Invalid request body", details: [{ path: r.path, message: r.reason }] });
        }
      }
      if (req.query != null && typeof req.query === "object") {
        const r = scanValue(req.query, 0, counter, "query");
        if (!r.ok) {
          return res.status(400).json({ error: "Invalid query parameters", details: [{ path: r.path, message: r.reason }] });
        }
      }
      next();
    } catch {
      // never-throw: a guard fault must not turn a working route into a 500.
      next();
    }
  };
}
