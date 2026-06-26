import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/src -> go up to server, then load .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pool } from "./db/client.js";
import { connectMongo } from "./db/mongo.js";
import authRoutes from "./routes/auth.js";
import notificationRoutes from "./routes/notifications.js";
import preferenceRoutes from "./routes/preferences.js";
import consentRoutes from "./routes/consents.js";
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/user.js";
import { getAllTemplates } from "./notifications/templateRepository.js";
import { requireAuth } from "./middleware/auth.js";
import parentRoutes from "./routes/parent.js";
import wellnessRoutes from "./routes/wellness.js";
import careerRoutes from "./routes/career.js";
import subscriptionRoutes from "./routes/subscription.js";
import examReadyRoutes from "./routes/exam-ready.js";
import lbiRoutes from "./routes/lbi.js";
import mentorRoutes from "./routes/mentor.js";
import hrRoutes from "./routes/hr.js";
import uploadRoutes from "./routes/upload.js";
import enrollmentKycRoutes from "./routes/enrollmentKyc.js";
import mentorAgreementRoutes from "./routes/mentorAgreement.js";
import onboardingRoutes, {
  listOnboarding, onboardingStats, onboardingHistory,
  approveOnboarding, rejectOnboarding, verifyDocuments, verifyKyc,
  listKyc, makerVerifyKyc, checkerVerifyKyc, rejectKyc,
  listStudentEnrollments
} from "./routes/onboarding.js";
import { startWorker } from "./notifications/delivery/worker.js";
import competencyRoutes from "./routes/competency.js";
import videoSessionRoutes from "./routes/videosessions.js";
import { runStartupMigrations } from "./db/startup-migrations.js";
import { runDbSmokeCheck } from "./db/smoke-check.js";
import { seedCompetencyData } from "./db/seed-competency.js";
import cvParserRoutes from "./routes/cvParser.js";
import employerRoutes from "./routes/employer.js";
import chatRoutes from "./routes/chat.js";
import chatPreferencesRoutes from "./routes/chat-preferences.js";
import pauseAnalyticsRoutes from "./routes/pause-analytics.js";
import concernRoutes from "./routes/concerns.js";
import shortAssessmentRoutes from "./routes/short-assessments.js";
import shareLbiRoutes from "./routes/share-lbi.js";
import gamificationRoutes from "./routes/gamification.js";
import collaborationRoutes from "./routes/collaboration.js";
import studentRoutes from "./routes/student.js";
import parentTestRoutes from "./routes/parent-tests.js";
import surveyRoutes from "./routes/survey.js";
import interviewQuestionsRoutes, { seedInterviewQuestions } from "./routes/interviewQuestions.js";
import examPortalRoutes from "./routes/examPortal.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "8000", 10);

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5000'];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allowlist-only: permit same-origin / non-browser requests (no Origin
      // header) and EXPLICITLY configured origins (CLIENT_ORIGIN). Reflecting
      // arbitrary origins with credentials:true is a credential-leak/CSRF vector,
      // so unknown origins are rejected (including in production).
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded KYC document files as static assets
const uploadsDir = path.resolve('uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
app.use('/files', express.static(uploadsDir));

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({ status: "error", db: "disconnected" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/chat-preferences", chatPreferencesRoutes);
app.use("/api/pause-analytics", pauseAnalyticsRoutes);
app.use("/api/concerns", concernRoutes);
app.use("/api/short-assessments", shortAssessmentRoutes);
app.use("/api/cv", cvParserRoutes);
app.use("/api/employer", employerRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/notification-templates", requireAuth, async (_req, res) => {
  try {
    const templates = await getAllTemplates();
    const list = templates.map((t) => ({
      id: t.id,
      serviceName: t.title,
      category: t.category,
      type: t.type,
      priority: t.priority,
      channels: ["in_app", "email"],
      targetAudience: t.roles,
      titleTemplate: t.title.replace(/\[(\w+)\]/g, "{{$1}}"),
      messageTemplate: t.bodyTemplate.replace(/\[(\w+)\]/g, "{{$1}}"),
      triggerEvent: null,
      actionLabel: t.actionLabel ?? null,
      variables: t.variables,
    }));
    res.json(list);
  } catch {
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});
app.use("/api/notification-preferences", preferenceRoutes);
app.use("/api/email-consents", consentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/wellness", wellnessRoutes);
app.use("/api/career", careerRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/v1", examReadyRoutes);
app.use("/api/lbi", lbiRoutes);
app.use("/api/mentor-marketplace", mentorRoutes);
app.use("/api/hr", hrRoutes);
app.use("/api", shareLbiRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/interview-questions", interviewQuestionsRoutes);
app.use("/api/exam-portal", examPortalRoutes);
app.use("/api/collab", collaborationRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/parent-tests", parentTestRoutes);

// ── Public onboarding registration ──
app.use("/api/onboarding", onboardingRoutes);

// ── Admin onboarding endpoints ──
app.get("/api/admin/onboarding",              requireAuth, listOnboarding);
app.get("/api/admin/onboarding-stats",        requireAuth, onboardingStats);
app.get("/api/admin/onboarding/:id/history",  requireAuth, onboardingHistory);
app.post("/api/admin/onboarding/:id/approve", requireAuth, approveOnboarding);
app.post("/api/admin/onboarding/:id/reject",  requireAuth, rejectOnboarding);
app.patch("/api/admin/onboarding/:id/verify-documents", requireAuth, verifyDocuments);
app.patch("/api/admin/onboarding/:id/verify-kyc",       requireAuth, verifyKyc);

// ── Admin KYC endpoints ──
app.get("/api/admin/kyc",                          requireAuth, listKyc);
app.get("/api/admin/onboarding/:id/kyc-documents", requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { db } = await import('./db/drizzle.js');
    const { kycDocuments } = await import('./db/schema.js');
    const { eq, asc } = await import('drizzle-orm');
    const rows = await db.select().from(kycDocuments)
      .where(eq(kycDocuments.onboardingId, id))
      .orderBy(asc(kycDocuments.createdAt));
    res.json(rows.map((r) => ({
      id: r.id, documentType: r.documentType, documentNumber: r.documentNumber,
      fileUrl: r.fileUrl, status: r.status, makerVerifiedAt: r.makerVerifiedAt,
      makerNotes: r.makerNotes, checkerVerifiedAt: r.checkerVerifiedAt,
      rejectionReason: r.rejectionReason, createdAt: r.createdAt,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
app.post("/api/admin/kyc/:id/maker-verify",  requireAuth, makerVerifyKyc);
app.post("/api/admin/kyc/:id/checker-verify",requireAuth, checkerVerifyKyc);
app.post("/api/admin/kyc/:id/reject",        requireAuth, rejectKyc);

// ── Admin student enrollments ──
app.get("/api/admin/student-enrollments", requireAuth, listStudentEnrollments);

// ── Document upload: admin request + public upload ──
app.use("/api/admin/onboarding", uploadRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/video-sessions", videoSessionRoutes);
app.use("/api", enrollmentKycRoutes);
app.use("/api", mentorAgreementRoutes);

app.use("/api", parentRoutes);
app.use("/api/competency", competencyRoutes);
app.use("/api/survey", surveyRoutes);

app.use((req, res) => {
  res
    .status(404)
    .json({
      error: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found.`,
    });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[Server] Unhandled error:", err);
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Something went wrong." });
  },
);

// ── Serve built React frontend in production ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(distPath));
  // SPA fallback — all non-API routes return index.html
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api') || _req.path.startsWith('/files')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`[Server] Serving frontend from ${distPath}`);
}

async function startServer(mongoAvailable: boolean) {
  await runStartupMigrations();
  await runDbSmokeCheck();
  await seedCompetencyData().catch(e => console.error('[Competency] Seed error (non-fatal):', e));
  await seedInterviewQuestions().then(n => { if (n > 0) console.log(`[InterviewBank] Seeded ${n} questions`); }).catch(e => console.error('[InterviewBank] Seed error (non-fatal):', e));

  const { createServer } = await import('http');
  const { initSignaling } = await import('./signaling/index.js');
  const httpServer = createServer(app);
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5000';
  initSignaling(httpServer, clientOrigin);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] MetryxOne backend running on port ${PORT}${mongoAvailable ? '' : ' (MongoDB unavailable)'}`);
    console.log(`[Server] WebRTC signaling active on /signaling`);
    startWorker(30000);
  });
}

// Connect MongoDB then start server
connectMongo()
  .then(() => startServer(true))
  .catch(async (err) => {
    console.error("[Server] MongoDB failed:", err);
    await startServer(false);
  });

process.on("SIGTERM", async () => {
  console.log("[Server] Shutting down...");
  await pool.end();
  process.exit(0);
});
