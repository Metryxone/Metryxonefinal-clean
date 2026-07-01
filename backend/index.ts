import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import helmet from "helmet";

import { connectMongo } from "./mongo";
import { csrfProtection } from "./lib/csrf";
import { redactDeep } from "./lib/redact";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { registerImageRoutes } from "./replit_integrations/image";
import { storage, pool } from "./storage";
import { initWebSocketServer } from "./services/ws-broadcast";
import { runRoleLibraryExpansion } from "./services/role-library-expansion";
import { runRoleBridgeActivation } from "./services/role-bridge-activation";
import {
  bridgeOnetDerivedWeights,
  ensureOntoRoleWeightSourceColumn,
} from "./services/onet-onto-weight-bridge";
import { assertEnvPreflight } from "./lib/env-preflight";

// ── Production env preflight ────────────────────────────────────────────────
// Single boot-time check: aborts on missing REQUIRED secrets (SESSION_SECRET,
// DATABASE_URL) and prints a loud warning for feature-degrading ones (Zoho MFA
// email, upload-service wiring, OpenAI). No-op outside production, so the dev
// boot stays byte-identical. See docs/ENVIRONMENT.md for the full var reference.
assertEnvPreflight();

const app = express();
const httpServer = createServer(app);

// ── CSRF protection (security control, defaults ON) ──────────────────────────
// Mounted FIRST so the ENTIRE /api surface is gated — including the upload
// reverse-proxy below and the /api/v1 version namespace — with no gaps. It reads
// only headers/cookies (no body needed), issues/validates a signed double-submit
// token, and fails CLOSED on internal errors. Kill-switch: CSRF_PROTECTION_DISABLED=1.
app.use(csrfProtection());

// ── Upload reverse-proxy (registered later, with auth) ───────────────────────
// The /api/v1/upload/* → FastAPI bulk-upload proxy is registered INSIDE
// registerRoutes (backend/routes.ts), AFTER the super-admin auth guards are
// defined, so the proxy can enforce requireAuth → requireSuperAdmin BEFORE it
// injects the upload service's shared secret (never authenticating an
// unauthenticated caller into the upload service). It cannot live here because
// express-session/passport are initialised inside registerRoutes. CSRF (mounted
// above) still gates the whole /api surface, including that proxy path.

// ── API versioning: /api/v1/* namespace ──────────────────────────────────────
// Establishes an explicit version namespace. /api/v1/upload/* is proxied above to
// the FastAPI service; every OTHER /api/v1/* path is transparently served by the
// canonical /api/* handlers (v1 == the current contract). This gives clients a
// stable version to pin to and lets a future /api/v2 diverge without breaking v1.
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/v1/") && !req.url.startsWith("/api/v1/upload")) {
    req.url = "/api" + req.url.slice("/api/v1".length);
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '8mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '8mb' }));

// ── Security headers (helmet) ────────────────────────────────────────────────
// CSP is ENABLED with a policy tuned to the SPA's actual resource origins
// (verified by auditing every external reference in the built SPA + src):
//   script-src : self + Razorpay checkout.js (Vite emits hashed module scripts
//                under /assets with no inline JS) — the primary XSS defense.
//   style-src  : self + Google Fonts CSS + 'unsafe-inline' (shadcn chart injects
//                an inline <style>; many CSS-in-JS libs use inline style attrs).
//   font-src   : self + fonts.gstatic.com + data:.
//   img-src    : self + data:/blob: + https: (avatars/remote thumbnails).
//   connect-src: self (/api XHR + EventSource /api/notifications/stream) +
//                *.razorpay.com + lumberjack.razorpay.com + wss: (runtime-sync
//                WebSocket + WebRTC signaling via socket.io 'websocket' transport).
//                NOTE: VideoCallRoom signaling targets a cross-port (:8000) origin.
//                Its 'websocket' transport is covered by wss:; the socket.io
//                'polling' (XHR) fallback to that cross-port origin is intentionally
//                NOT allowlisted (host is the dynamic deploy domain; standard
//                single-port deployments don't expose :8000). Pre-existing cross-
//                port architecture — not a CSP regression; broadening connect-src
//                to https: would weaken exfil protection for no real-prod gain.
//   frame-src  : self + Razorpay + blob: (résumé PDF preview iframe via
//                URL.createObjectURL) + YouTube embeds (VideoPopup iframe).
//                (CapadexReports email preview uses srcDoc → covered by 'self'.)
// Anchor links (wa.me / social-share / metryx.one) and WebRTC STUN gathering are
// navigation/peer-connection, not CSP fetch directives, so no entry is required.
// Instant kill-switch: CSP_DISABLED=1 reverts to no CSP.
const cspEnabled = process.env.CSP_DISABLED !== '1';
app.use(
  helmet({
    contentSecurityPolicy: cspEnabled
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'", 'https://*.razorpay.com', 'https://lumberjack.razorpay.com', 'wss:'],
            frameSrc: ["'self'", 'blob:', 'https://*.razorpay.com', 'https://api.razorpay.com', 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'", 'https://*.razorpay.com'],
            frameAncestors: ["'self'"],
          },
        }
      : false,
  }),
);

// Phase 5 — global security middleware: request id tagging + anti-enumeration delay.
import { requestId as _phase5RequestId, antiEnumDelay as _phase5AntiEnum } from './services/security-middleware.js';
app.use(_phase5RequestId());
app.use(_phase5AntiEnum(80));

// Ops 2.5 (flag operationalReadiness) — HTTP throughput/error/latency metrics.
// Byte-identical OFF: the middleware short-circuits with next() and records nothing.
import { opsMetricsMiddleware as _opsMetrics } from './services/ops/metrics-registry.js';
app.use(_opsMetrics());

// Finding #6 — universal input-validation baseline (covers 100% of handlers).
// Prototype-pollution + NUL-byte + structural-DoS guards on every request body
// and query. Non-breaking for valid traffic; deep per-field schemas (lib/validate
// `validate({...})`) are layered on top for the high-risk write surface.
import { globalInputHardening as _inputHardening } from './lib/validate.js';
app.use(_inputHardening());

// ── Structured logging with levels ───────────────────────────────────────────
// LOG_LEVEL gates output (debug < info < warn < error); default "info".
// In Replit/containers, stdout/stderr are captured (and rotated) by the platform.
type LogLevel = "debug" | "info" | "warn" | "error";
const LOG_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const ACTIVE_LOG_LEVEL: LogLevel =
  (["debug", "info", "warn", "error"] as const).includes(process.env.LOG_LEVEL as LogLevel)
    ? (process.env.LOG_LEVEL as LogLevel)
    : "info";

function emit(level: LogLevel, message: string, source = "express") {
  if (LOG_ORDER[level] < LOG_ORDER[ACTIVE_LOG_LEVEL]) return;
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const line = `${formattedTime} [${source}] ${level.toUpperCase()}: ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function log(message: string, source = "express") {
  emit("info", message, source);
}
export const logDebug = (message: string, source = "express") => emit("debug", message, source);
export const logWarn = (message: string, source = "express") => emit("warn", message, source);
export const logError = (message: string, source = "express") => emit("error", message, source);

// API request logger — captures method/path/status/duration. Response bodies are
// PRIVACY-REDACTED: sensitive keys are masked, sensitive auth routes never log a
// body at all, and the serialized body is length-capped so large/PII payloads
// don't leak into application logs.
const SENSITIVE_BODY_PATHS = [
  "/api/login", "/api/admin/mfa", "/api/auth", "/api/register",
  "/api/forgot-password", "/api/reset-password",
];
// Redaction policy is shared with the DB audit writers (./lib/redact) so stdout
// logs and the at-rest audit trail mask the same sensitive keys.

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = (bodyJson: any, ...args: any[]) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const isSensitive = SENSITIVE_BODY_PATHS.some((p) => path.startsWith(p));
      if (capturedJsonResponse && !isSensitive) {
        let body = JSON.stringify(redactDeep(capturedJsonResponse));
        if (body && body.length > 800) body = body.slice(0, 800) + "…[truncated]";
        logLine += ` :: ${body}`;
      }
      log(logLine);
    }
  });

  next();
});

// ── Health checks ────────────────────────────────────────────────────────────
// Liveness: the process is up. Readiness: process up AND the database is reachable.
// Reachable under both /api/health and /api/v1/health.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime_s: Math.round(process.uptime()), ts: new Date().toISOString() });
});
app.get("/api/health/ready", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready", db: "ok", ts: new Date().toISOString() });
  } catch (e: any) {
    // Log the real error server-side; never return DB error details to the client.
    // Driver/connection-string fragments can leak through e.message (info disclosure).
    console.error("[health/ready] DB readiness check failed:", e?.message ?? e);
    res.status(503).json({ status: "not_ready", db: "error", ts: new Date().toISOString() });
  }
});



(async () => {
  // ✅ 1) Connect MongoDB before registering routes

  // try {
  //   await storage.seedExamReadyPlans();
  //   console.log("✅ Exam Ready plans seeded");
  // } catch (e) {
  //   console.error("❌ Failed to seed Exam Ready plans:", e);
  // }

  try {
    await connectMongo();
    log("MongoDB connected successfully", "startup");
  } catch (err) {
    console.error("❌ Failed to connect MongoDB:", err);

    // If MongoDB is mandatory (recommended for production), fail fast:
    const mongoRequired = (process.env.MONGO_REQUIRED || "false").toLowerCase() === "true";
    if (mongoRequired) {
      process.exit(1);
    } else {
      log("MongoDB not connected (continuing because MONGO_REQUIRED=false)", "startup");
    }
  }

  // ✅ 2) Register routes
  await registerRoutes(httpServer, app);
  registerChatRoutes(app);
  registerAudioRoutes(app);
  registerImageRoutes(app);

  // ✅ 3) Seed data
  try {
    await storage.seedAssessmentTemplates();
    log("Assessment templates seeded successfully", "seed");
  } catch (e) {
    console.error("Failed to seed assessment templates:", e);
  }

  try {
    await storage.seedCurriculumData();
    log("Curriculum data seeded successfully", "seed");
  } catch (e) {
    console.error("Failed to seed curriculum data:", e);
  }

  try {
    await storage.seedSuperAdmin();
    log("Super admin seeded successfully", "seed");
  } catch (e) {
    console.error("Failed to seed super admin:", e);
  }

  // Role Library Expansion — self-running, idempotent seed so the curated
  // expansion roles (with their DNA profiles + weights) exist in EVERY
  // environment, including production on publish. A merged task-agent data
  // backfill only writes to the isolated env DB, so the rows must be (re)seeded
  // at boot. Every insert is ON CONFLICT DO NOTHING; re-runs insert 0 rows.
  try {
    const r = await runRoleLibraryExpansion(pool);
    if (r.noop) {
      log(
        `Role library expansion already present, nothing seeded (roles_with_dna=${r.roles_with_dna})`,
        "seed",
      );
    } else {
      log(
        `Role library expansion seeded (roles +${r.roles_inserted}, dna +${r.dna_profiles_inserted}, weights +${r.role_weights_inserted}, roles_with_dna=${r.roles_with_dna})`,
        "seed",
      );
    }
  } catch (e) {
    console.error("Failed to seed role library expansion:", e);
  }

  // Backend / Senior Backend Engineer Role-DNA activation (Task #145) —
  // self-running, idempotent seed so the bridge link, authored questions, and
  // blueprint wiring (which let the employer match score those roles PRECISELY)
  // exist in EVERY environment, including production on publish. A merged
  // task-agent data backfill only writes to the isolated env DB, so the rows must
  // be (re)seeded at boot. Every write is additive + ON CONFLICT / NOT EXISTS;
  // re-runs no-op via the fast-path probe.
  try {
    const r = await runRoleBridgeActivation(pool);
    if (r.noop) {
      log("Role bridge activation already present, nothing seeded", "seed");
    } else {
      log(
        `Role bridge activation seeded (library_roles +${r.library_roles_inserted}, bridge ${r.bridge_rows_set}/${r.bridge_rows_skipped} skipped, templates +${r.templates_upserted}, question_map +${r.question_map_rows}, blueprints +${r.blueprints_created}, blueprint_comps +${r.blueprint_comp_rows}, dna_comps_no_q=${r.dna_comps_without_questions})`,
        "seed",
      );
      if (r.notes.length) log(`Role bridge activation notes: ${r.notes.join(" | ")}`, "seed");
    }
  } catch (e) {
    console.error("Failed to seed role bridge activation:", e);
  }

  // O*NET → Role-DNA estimated-weight bridge activation (Task #421) —
  // self-running + idempotent so the user-facing "Estimated / inherited" weights
  // (onto_role_weights.source = 'onet_derived') populate in EVERY environment,
  // including production on publish. A merged data backfill only writes to the
  // isolated env DB and a merge carries CODE + migration DDL, NOT rows (see
  // .agents/memory/merged-task-data-not-in-live-db.md) — so the bridge must
  // (re)run at boot to actually populate the live DB. The bridge itself is
  // idempotent + additive (curated weights always win and are never touched) and
  // never throws. Fast-path no-ops once derived rows exist; the O*NET import path
  // (POST /api/ontology/overview/import-onet) and the admin trigger
  // (POST /api/ontology/overview/bridge-onet-weights) re-bridge on demand when
  // the library changes. Only genuine cross-namespace matches bridge — an empty
  // O*NET library honestly bridges 0 rows (the badge stays off, never fabricated).
  try {
    await ensureOntoRoleWeightSourceColumn(pool);
    const derived = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM onto_role_weights WHERE source = 'onet_derived'`,
    );
    if (Number(derived.rows[0]?.n ?? 0) > 0) {
      log(
        `O*NET weight bridge already present (${derived.rows[0].n} derived rows), nothing bridged`,
        "seed",
      );
    } else {
      const r = await bridgeOnetDerivedWeights(pool);
      log(
        `O*NET weight bridge activated (derived weights ${r.linksBridged}, roles matched ${r.rolesMatched ?? 0}, competencies matched ${r.competenciesMatched ?? 0})`,
        "seed",
      );
    }
  } catch (e) {
    console.error("Failed to activate O*NET weight bridge:", e);
  }

  // ✅ 4) Error handler (keep after routes)
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // ✅ 5) Vite / static
  if (process.env.NODE_ENV === "production") {
  serveStatic(app);
} else {
  log("Dev mode: Vite is running separately on 5173 (skipping setupVite)", "startup");
}

  // ✅ 6) Attach WebSocket server (must be before listen so the upgrade event fires)
  initWebSocketServer(httpServer);

  // ✅ 7) Start server — use httpServer (not app) so WS upgrades are handled
  const PORT = process.env.PORT || 8080;
  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server listening on ${PORT}`);
    // ── DB connection pre-warm (best-effort, never throws) ────────────────────
    // Opens a few pooled connections and touches a couple of frequently-read
    // tables right after boot, so the FIRST real user request doesn't pay the
    // cold first-touch penalty (observed once as a ~700ms cold-cache spike in the
    // performance benchmarks). Purely additive: failures are logged and ignored,
    // and a successful run changes no data. Kill-switch: DB_PREWARM_DISABLED=1.
    if (process.env.DB_PREWARM_DISABLED !== '1') {
      const prewarmStart = Date.now();
      const warm = [
        pool.query('SELECT 1'),
        pool.query('SELECT 1'),
        pool.query('SELECT 1'),
        pool.query('SELECT 1'),
      ];
      Promise.allSettled(warm)
        .then((results) => {
          const ok = results.filter((r) => r.status === 'fulfilled').length;
          console.log(`[db-prewarm] warmed ${ok}/${warm.length} connections in ${Date.now() - prewarmStart}ms`);
        })
        .catch((e) => console.warn('[db-prewarm] skipped:', (e as Error)?.message));
    }
  });

  // ── Graceful shutdown ────────────────────────────────────────────────────
  const gracefulShutdown = (signal: string) => {
    console.log(`${signal} received — graceful shutdown initiated`);
    httpServer.close(() => {
      console.log('HTTP server closed. Exiting.');
      process.exit(0);
    });
    // Force-exit after 10 s if drain hangs
    setTimeout(() => {
      console.error('Forced exit after 10 s shutdown timeout');
      process.exit(1);
    }, 10_000).unref();
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

})().catch((e) => {
  console.error("Startup failed:", e);
  process.exit(1);
});
