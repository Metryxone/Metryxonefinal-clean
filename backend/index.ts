import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import helmet from "helmet";

import { connectMongo } from "./mongo";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { registerChatRoutes } from "./replit_integrations/chat";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { registerImageRoutes } from "./replit_integrations/image";
import { storage, pool } from "./storage";
import { initWebSocketServer } from "./services/ws-broadcast";
import { runRoleLibraryExpansion } from "./services/role-library-expansion";
import { runRoleBridgeActivation } from "./services/role-bridge-activation";

// ── Fail-fast: SESSION_SECRET must be set in production ─────────────────────
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is not set. Refusing to start in production without a secure session secret. Set it in the Replit Deployments pane.');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);

// ── Reverse-proxy: /api/v1/upload/* → FastAPI (port 8002) ──
// Routes:
//   /api/v1/upload/admin/*  → http://localhost:8002/admin/*   (bulk upload endpoints)
//   /api/v1/upload/health   → http://localhost:8002/health
const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8002";
app.use(
  "/api/v1/upload",
  createProxyMiddleware({
    target: FASTAPI_URL,
    changeOrigin: true,
    pathRewrite: (path: string) => path.replace(/^\/api\/v1\/upload/, "") || "/",
    logLevel: "warn",
  } as any),
);

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
// contentSecurityPolicy disabled initially to avoid breaking the production SPA;
// re-enable with a refined policy once CSP directives are audited.
app.use(helmet({ contentSecurityPolicy: false }));

// Phase 5 — global security middleware: request id tagging + anti-enumeration delay.
import { requestId as _phase5RequestId, antiEnumDelay as _phase5AntiEnum } from './services/security-middleware.js';
app.use(_phase5RequestId());
app.use(_phase5AntiEnum(80));

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
const SENSITIVE_KEY = /pass(word)?|secret|token|otp|mfa|code|authorization|cookie|ssn|aadhaar|card/i;
function redactBody(value: any, depth = 0): any {
  if (value == null || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactBody(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redactBody(v, depth + 1);
    }
    return out;
  }
  return value;
}

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
        let body = JSON.stringify(redactBody(capturedJsonResponse));
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
    res.status(503).json({ status: "not_ready", db: "error", error: e?.message ?? "db unreachable" });
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
