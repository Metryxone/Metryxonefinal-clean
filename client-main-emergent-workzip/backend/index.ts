import "dotenv/config";
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
import { storage } from "./storage";
import { initWebSocketServer } from "./services/ws-broadcast";

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

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// API request logger
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
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
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
