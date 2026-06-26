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
