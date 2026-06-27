import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db, pool } from "../storage";
import { propagateModuleUpdate } from "../services/competency-intelligence-orchestrator";
import { ADAPTIVE_EVENTS } from "../services/adaptive-event-bus";
import { calculateAndPersistLBI } from "./lbi-engine";
import { onGoalCompleted, onJobStageChanged } from "./career-evidence";
import { isCareerLaunchpadEnabled } from "../config/feature-flags";
import { logAudit } from "../services/platform-audit";
import {
  CAREER_STAGES,
  EXPERIENCES,
  isCareerStage,
  isExperienceId,
  allowedExperiences,
  effectiveExperience,
  readEffectiveStage,
  persistPreferredExperience,
  STAGE_TO_EXPERIENCE,
  type ExperienceId,
} from "../services/experience-routing";

// ─── Completeness scoring (mirrors cv-parser weights) ───────────────────────
const CORE_WEIGHTS: Record<string, number> = {
  personal: 12, email: 12, phone: 8, summary: 12,
  education: 14, experience: 18,
  technical_skills: 10, soft_skills: 8,
};
const BONUS_WEIGHTS: Record<string, number> = {
  linkedin: 4, github: 3, tools: 3, languages: 3,
  projects: 4, certifications: 4, achievements: 3,
};

function computeCompleteness(p: any): { completeness: number; sectionsFilled: string[] } {
  const filled: string[] = [];
  const personal = p?.personal ?? {};
  if ((personal.name ?? "").trim()) filled.push("personal");
  if ((personal.email ?? "").trim()) filled.push("email");
  if ((personal.phone ?? "").trim()) filled.push("phone");
  if ((personal.linkedin ?? "").trim()) filled.push("linkedin");
  if ((personal.github ?? "").trim()) filled.push("github");
  if ((p?.summary ?? "").trim()) filled.push("summary");
  if ((p?.skills?.technical ?? []).length) filled.push("technical_skills");
  if ((p?.skills?.soft ?? []).length) filled.push("soft_skills");
  if ((p?.skills?.tools ?? []).length) filled.push("tools");
  if ((p?.skills?.languages ?? []).length || (p?.spokenLanguages ?? []).length) filled.push("languages");
  if ((p?.education ?? []).length) filled.push("education");
  if ((p?.experience ?? []).length) filled.push("experience");
  if ((p?.projects ?? []).length) filled.push("projects");
  if ((p?.certifications ?? []).length) filled.push("certifications");
  if ((p?.achievements ?? []).length) filled.push("achievements");

  let core = 0, bonus = 0;
  for (const s of filled) core += CORE_WEIGHTS[s] ?? 0;
  for (const s of filled) bonus += BONUS_WEIGHTS[s] ?? 0;
  const completeness = Math.min(100, Math.round(core + Math.min(bonus, 18)));
  return { completeness, sectionsFilled: filled };
}

// Build a skeleton profile, seeded from a user record
function skeletonProfile(seed: { name?: string; email?: string; phone?: string } = {}): any {
  return {
    personal: {
      name: seed.name ?? "", email: seed.email ?? "", phone: seed.phone ?? "",
      location: "", linkedin: "", github: "", website: "", portfolio: "",
    },
    summary: "",
    skills: { technical: [], soft: [], tools: [], languages: [] },
    education: [],
    experience: [],
    certifications: [],
    projects: [],
    achievements: [],
    spokenLanguages: [],
    competencyProfile: { completeness: 0, sectionsFilled: [] },
  };
}

function withCompleteness(profile: any): any {
  const { completeness, sectionsFilled } = computeCompleteness(profile);
  return { ...profile, competencyProfile: { completeness, sectionsFilled } };
}

// ─── Auth helper (cookie session OR allow self by URL param) ────────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  // @ts-expect-error passport extends req
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  return res.status(401).json({ success: false, message: "Not authenticated" });
}

function sessionUser(req: Request): { id: string; fullName?: string; email?: string; username?: string; mobile?: string } | null {
  // @ts-expect-error passport user
  const u = req.user;
  return u && u.id ? u : null;
}

// Returns the URL :userId if it matches the session user; otherwise the session user's id.
function resolveUserId(req: Request): string | null {
  const u = sessionUser(req);
  if (!u) return null;
  const param = req.params.userId;
  if (!param || param === u.id) return u.id;
  // refuse cross-user reads
  return null;
}

export function registerCareerSeekerRoutes(app: Express): void {
  // ── GET profile ───────────────────────────────────────────────────────────
  app.get("/api/cv/profile/:userId", requireAuth, async (req, res) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });

      const row: any = await db.execute(sql`
        SELECT data FROM career_seeker_profiles WHERE user_id = ${userId} LIMIT 1
      `);
      const r = row.rows?.[0] ?? row[0];
      if (!r) return res.json({ success: true, exists: false, profile: null });

      const profile = withCompleteness(r.data ?? {});
      return res.json({ success: true, exists: true, profile });
    } catch (err) {
      console.error("[career-seeker] get profile error:", err);
      return res.status(500).json({ success: false, message: "Failed to load profile" });
    }
  });

  // ── POST init profile (seed from user record) ─────────────────────────────
  app.post("/api/cv/init-profile", requireAuth, async (req, res) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });

      const body = (req.body ?? {}) as { name?: string; email?: string };
      const seedName = (body.name && body.name.trim()) || u.fullName || u.username || "";
      const seedEmail = (body.email && body.email.trim()) || u.email || u.username || "";
      const seedPhone = u.mobile ?? "";

      // Non-destructive: if a profile already exists, return it untouched.
      // Only seed from the user record when there's nothing yet.
      const existingRow: any = await db.execute(sql`
        SELECT data FROM career_seeker_profiles WHERE user_id = ${u.id} LIMIT 1
      `);
      const existing = (existingRow.rows ?? existingRow)[0]?.data;
      if (existing) {
        return res.json({ success: true, profile: withCompleteness(existing) });
      }

      const profile = withCompleteness(skeletonProfile({
        name: seedName, email: seedEmail, phone: seedPhone,
      }));

      await db.execute(sql`
        INSERT INTO career_seeker_profiles (user_id, data, completeness)
        VALUES (${u.id}, ${JSON.stringify(profile)}::jsonb, ${profile.competencyProfile.completeness})
        ON CONFLICT (user_id) DO NOTHING
      `);

      return res.json({ success: true, profile });
    } catch (err) {
      console.error("[career-seeker] init profile error:", err);
      return res.status(500).json({ success: false, message: "Failed to initialise profile" });
    }
  });

  // ── POST save profile (upsert + recompute completeness) ───────────────────
  app.post("/api/cv/save-profile", requireAuth, async (req, res) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });

      const incoming = (req.body?.profile ?? req.body ?? {}) as any;
      if (!incoming || typeof incoming !== "object") {
        return res.status(400).json({ success: false, message: "Invalid profile payload" });
      }

      const profile = withCompleteness(incoming);

      await db.execute(sql`
        INSERT INTO career_seeker_profiles (user_id, data, completeness)
        VALUES (${u.id}, ${JSON.stringify(profile)}::jsonb, ${profile.competencyProfile.completeness})
        ON CONFLICT (user_id) DO UPDATE
          SET data = EXCLUDED.data,
              completeness = EXCLUDED.completeness,
              updated_at = NOW()
      `);

      if (Array.isArray(incoming.projects)) {
        void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.PROJECT_UPDATED, userId: u.id, pool, payload: { projectCount: incoming.projects.length } }).catch(() => {});
      }
      // Fire LBI chain on profile save (cross-platform trigger E5)
      const lbiEmail = u.email ?? u.username;
      if (lbiEmail) setImmediate(() => calculateAndPersistLBI(lbiEmail!, pool).catch(() => {}));
      return res.json({ success: true, profile });
    } catch (err) {
      console.error("[career-seeker] save profile error:", err);
      return res.status(500).json({ success: false, message: "Failed to save profile" });
    }
  });

  // Partial profile updates — frontend uses PUT, also accept PATCH for compatibility
  const profileUpdateHandler = async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });

      const row: any = await db.execute(sql`
        SELECT data FROM career_seeker_profiles WHERE user_id = ${userId} LIMIT 1
      `);
      const existing = (row.rows?.[0] ?? row[0])?.data ?? skeletonProfile();
      const patch = (req.body ?? {}) as any;
      const merged = { ...existing, ...patch, personal: { ...(existing.personal ?? {}), ...(patch.personal ?? {}) }, skills: { ...(existing.skills ?? {}), ...(patch.skills ?? {}) } };
      const profile = withCompleteness(merged);

      await db.execute(sql`
        INSERT INTO career_seeker_profiles (user_id, data, completeness)
        VALUES (${userId}, ${JSON.stringify(profile)}::jsonb, ${profile.competencyProfile.completeness})
        ON CONFLICT (user_id) DO UPDATE
          SET data = EXCLUDED.data,
              completeness = EXCLUDED.completeness,
              updated_at = NOW()
      `);
      if (Array.isArray(patch.projects)) {
        void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.PROJECT_UPDATED, userId, pool, payload: { projectCount: patch.projects.length } }).catch(() => {});
      }
      return res.json({ success: true, profile });
    } catch (err) {
      console.error("[career-seeker] patch profile error:", err);
      return res.status(500).json({ success: false, message: "Failed to update profile" });
    }
  };
  app.put("/api/cv/profile/:userId", requireAuth, profileUpdateHandler);
  app.patch("/api/cv/profile/:userId", requireAuth, profileUpdateHandler);

  // ── JOBS ───────────────────────────────────────────────────────────────────
  app.get("/api/cv/jobs/:userId", requireAuth, async (req, res) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });
      const r: any = await db.execute(sql`
        SELECT id, data, status, updated_at FROM career_seeker_jobs
        WHERE user_id = ${userId} ORDER BY updated_at DESC
      `);
      const rows = r.rows ?? r;
      const jobs = rows.map((j: any) => ({ ...(j.data ?? {}), _id: j.id, status: j.status, updatedAt: j.updated_at }));
      return res.json({ success: true, jobs });
    } catch (err) {
      console.error("[career-seeker] list jobs error:", err);
      return res.status(500).json({ success: false, jobs: [] });
    }
  });

  app.post("/api/cv/jobs", requireAuth, async (req, res) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });
      const data = (req.body ?? {}) as any;
      const status = data.status || "Saved";
      const r: any = await db.execute(sql`
        INSERT INTO career_seeker_jobs (user_id, data, status)
        VALUES (${u.id}, ${JSON.stringify(data)}::jsonb, ${status})
        RETURNING id, data, status, updated_at
      `);
      const row = (r.rows ?? r)[0];
      void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.APPLICATION_UPDATED, userId: u.id, pool, payload: { jobId: row.id, status: row.status, op: "create" } }).catch(() => {});
      const jobSrc = String((row.data ?? {}).source ?? "");
      void onJobStageChanged(pool, { userId: u.id, jobId: row.id, status: row.status, isDemo: /demo/i.test(jobSrc) }).catch(() => {});
      return res.json({ success: true, job: { ...(row.data ?? {}), _id: row.id, status: row.status, updatedAt: row.updated_at } });
    } catch (err) {
      console.error("[career-seeker] create job error:", err);
      return res.status(500).json({ success: false, message: "Failed to create job" });
    }
  });

  const jobUpdateHandler = async (req: Request, res: Response) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });
      const patch = (req.body ?? {}) as any;
      const r: any = await db.execute(sql`
        SELECT data FROM career_seeker_jobs WHERE id = ${req.params.id} AND user_id = ${u.id} LIMIT 1
      `);
      const existing = ((r.rows ?? r)[0])?.data ?? {};
      const merged = { ...existing, ...patch };
      const status = patch.status || merged.status || "Saved";
      const upd: any = await db.execute(sql`
        UPDATE career_seeker_jobs
        SET data = ${JSON.stringify(merged)}::jsonb, status = ${status}, updated_at = NOW()
        WHERE id = ${req.params.id} AND user_id = ${u.id}
        RETURNING id, data, status, updated_at
      `);
      const row = (upd.rows ?? upd)[0];
      if (!row) return res.status(404).json({ success: false, message: "Job not found" });
      void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.APPLICATION_UPDATED, userId: u.id, pool, payload: { jobId: row.id, status: row.status, op: "update" } }).catch(() => {});
      const jobSrc = String((row.data ?? {}).source ?? "");
      void onJobStageChanged(pool, { userId: u.id, jobId: row.id, status: row.status, isDemo: /demo/i.test(jobSrc) }).catch(() => {});
      return res.json({ success: true, job: { ...(row.data ?? {}), _id: row.id, status: row.status, updatedAt: row.updated_at } });
    } catch (err) {
      console.error("[career-seeker] update job error:", err);
      return res.status(500).json({ success: false, message: "Failed to update job" });
    }
  };
  app.put("/api/cv/jobs/:id", requireAuth, jobUpdateHandler);
  app.patch("/api/cv/jobs/:id", requireAuth, jobUpdateHandler);

  app.delete("/api/cv/jobs/:id", requireAuth, async (req, res) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });
      await db.execute(sql`DELETE FROM career_seeker_jobs WHERE id = ${req.params.id} AND user_id = ${u.id}`);
      void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.APPLICATION_UPDATED, userId: u.id, pool, payload: { jobId: req.params.id, op: "delete" } }).catch(() => {});
      return res.json({ success: true });
    } catch (err) {
      console.error("[career-seeker] delete job error:", err);
      return res.status(500).json({ success: false, message: "Failed to delete job" });
    }
  });

  // ── GOALS ──────────────────────────────────────────────────────────────────
  app.get("/api/cv/goals/:userId", requireAuth, async (req, res) => {
    try {
      const userId = resolveUserId(req);
      if (!userId) return res.status(403).json({ success: false, message: "Forbidden" });
      const r: any = await db.execute(sql`
        SELECT id, data, completed, updated_at FROM career_seeker_goals
        WHERE user_id = ${userId} ORDER BY updated_at DESC
      `);
      const rows = r.rows ?? r;
      const goals = rows.map((g: any) => ({ ...(g.data ?? {}), _id: g.id, completed: g.completed, updatedAt: g.updated_at }));
      return res.json({ success: true, goals });
    } catch (err) {
      console.error("[career-seeker] list goals error:", err);
      return res.status(500).json({ success: false, goals: [] });
    }
  });

  app.post("/api/cv/goals", requireAuth, async (req, res) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });
      const data = (req.body ?? {}) as any;
      const completed = !!data.completed;
      const r: any = await db.execute(sql`
        INSERT INTO career_seeker_goals (user_id, data, completed)
        VALUES (${u.id}, ${JSON.stringify(data)}::jsonb, ${completed})
        RETURNING id, data, completed, updated_at
      `);
      const row = (r.rows ?? r)[0];
      void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.GOAL_UPDATED, userId: u.id, pool, payload: { goalId: row.id, completed: row.completed, op: "create" } }).catch(() => {});
      if (row.completed) {
        const goalSrc = String((row.data ?? {}).source ?? "");
        void onGoalCompleted(pool, { userId: u.id, goalId: row.id, isDemo: /demo/i.test(goalSrc) }).catch(() => {});
      }
      return res.json({ success: true, goal: { ...(row.data ?? {}), _id: row.id, completed: row.completed, updatedAt: row.updated_at } });
    } catch (err) {
      console.error("[career-seeker] create goal error:", err);
      return res.status(500).json({ success: false, message: "Failed to create goal" });
    }
  });

  const goalUpdateHandler = async (req: Request, res: Response) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });
      const patch = (req.body ?? {}) as any;
      const r: any = await db.execute(sql`
        SELECT data, completed FROM career_seeker_goals WHERE id = ${req.params.id} AND user_id = ${u.id} LIMIT 1
      `);
      const existingRow = (r.rows ?? r)[0];
      if (!existingRow) return res.status(404).json({ success: false, message: "Goal not found" });
      const merged = { ...(existingRow.data ?? {}), ...patch };
      const completed = typeof patch.completed === "boolean" ? patch.completed : existingRow.completed;
      const upd: any = await db.execute(sql`
        UPDATE career_seeker_goals
        SET data = ${JSON.stringify(merged)}::jsonb, completed = ${completed}, updated_at = NOW()
        WHERE id = ${req.params.id} AND user_id = ${u.id}
        RETURNING id, data, completed, updated_at
      `);
      const row = (upd.rows ?? upd)[0];
      void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.GOAL_UPDATED, userId: u.id, pool, payload: { goalId: row.id, completed: row.completed, op: "update" } }).catch(() => {});
      // First Outcome Evidence Loop: capture a real goal_achieved outcome on transition into completed.
      if (row.completed && !existingRow.completed) {
        const goalSrc = String((row.data ?? {}).source ?? "");
        void onGoalCompleted(pool, { userId: u.id, goalId: row.id, isDemo: /demo/i.test(goalSrc) }).catch(() => {});
      }
      return res.json({ success: true, goal: { ...(row.data ?? {}), _id: row.id, completed: row.completed, updatedAt: row.updated_at } });
    } catch (err) {
      console.error("[career-seeker] update goal error:", err);
      return res.status(500).json({ success: false, message: "Failed to update goal" });
    }
  };
  app.put("/api/cv/goals/:id", requireAuth, goalUpdateHandler);
  app.patch("/api/cv/goals/:id", requireAuth, goalUpdateHandler);

  app.delete("/api/cv/goals/:id", requireAuth, async (req, res) => {
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });
      await db.execute(sql`DELETE FROM career_seeker_goals WHERE id = ${req.params.id} AND user_id = ${u.id}`);
      void propagateModuleUpdate({ source: ADAPTIVE_EVENTS.GOAL_UPDATED, userId: u.id, pool, payload: { goalId: req.params.id, op: "delete" } }).catch(() => {});
      return res.json({ success: true });
    } catch (err) {
      console.error("[career-seeker] delete goal error:", err);
      return res.status(500).json({ success: false, message: "Failed to delete goal" });
    }
  });

  // ── MX-302A — Career Launchpad & Experience Routing ─────────────────────────
  // All three routes are flag-gated: with `careerLaunchpad` OFF they 503 BEFORE
  // any auth / DB / ensure-schema touch, so the feature is byte-identical-OFF.

  // Probe: the frontend calls this to decide whether to render the experience
  // switcher + show the Career Launchpad label (res.ok === true means ON).
  app.get("/api/career/experience/enabled", (_req, res) => {
    if (!isCareerLaunchpadEnabled()) {
      return res.status(503).json({ enabled: false, message: "Career Launchpad is not enabled" });
    }
    return res.json({ enabled: true });
  });

  // Read the user's effective stage + the experiences they may switch between.
  app.get("/api/career/experience", requireAuth, async (req, res) => {
    if (!isCareerLaunchpadEnabled()) {
      return res.status(503).json({ success: false, message: "Career Launchpad is not enabled" });
    }
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });

      const { stage, stored, derived, preferred } = await readEffectiveStage(pool as any, u.id);
      // Effective experience honours a valid stored preference, else the stage's
      // default (Command Center when no stage is derivable — no regression).
      const experience = effectiveExperience(stage, preferred);
      return res.json({
        success: true,
        enabled: true,
        stage,
        stageStored: stored,
        stageDerived: derived,
        experience: experience.id,
        targetTab: experience.targetTab,
        available: experience.available,
        note: experience.note ?? null,
        stages: CAREER_STAGES,
        experiences: allowedExperiences(stage).map((e) => ({
          id: e.id, label: e.label, targetTab: e.targetTab, available: e.available, note: e.note ?? null,
        })),
      });
    } catch (err) {
      console.error("[career-seeker] get experience error:", err);
      return res.status(500).json({ success: false, message: "Failed to load experience" });
    }
  });

  // Switch experience (or set stage directly). Updates the stored stage and
  // writes the routing decision to the redacted platform audit trail.
  app.post("/api/career/experience", requireAuth, async (req, res) => {
    if (!isCareerLaunchpadEnabled()) {
      return res.status(503).json({ success: false, message: "Career Launchpad is not enabled" });
    }
    try {
      const u = sessionUser(req);
      if (!u) return res.status(401).json({ success: false, message: "Not authenticated" });

      // AUTHORIZATION (role): career-stage/experience state is meaningful only for
      // career seekers — unrelated roles must never mutate it.
      const ru = (req as any).user ?? {};
      const role = String(ru.role ?? "").toLowerCase();
      const roles: string[] = Array.isArray(ru.roles) ? ru.roles.map((r: any) => String(r).toLowerCase()) : [];
      const isCareerSeeker =
        role === "career_seeker" || role === "job_seeker" ||
        roles.includes("career_seeker") || roles.includes("job_seeker");
      if (!isCareerSeeker) {
        return res.status(403).json({ success: false, message: "Experience switching is only available to career seekers" });
      }

      const body = (req.body ?? {}) as { stage?: string; experience?: string };
      // Resolve the REQUESTED experience. The switcher sends an experience id; a
      // stage is also accepted and mapped to its experience. We never mutate the
      // canonical career_stage here — switching only changes the chosen experience
      // (navigation), so a request can never escalate the user's stage/role.
      let requested: ExperienceId | null = isExperienceId(body.experience) ? body.experience : null;
      if (!requested && isCareerStage(body.stage)) requested = STAGE_TO_EXPERIENCE[body.stage];
      if (!requested) {
        return res.status(400).json({ success: false, message: "A valid stage or experience is required" });
      }

      // AUTHORIZATION (transition): the requested experience MUST be within the
      // set allowed for the user's effective stage. The client dropdown is only a
      // hint — this server-side gate is authoritative.
      const prev = await readEffectiveStage(pool as any, u.id);
      const allowed = allowedExperiences(prev.stage);
      if (!allowed.some((e) => e.id === requested)) {
        return res.status(403).json({ success: false, message: "That experience is not available for your career stage" });
      }

      await persistPreferredExperience(pool as any, u.id, requested);
      const experience = EXPERIENCES[requested];

      void logAudit(pool as any, req, {
        action: "update",
        entityType: "career_experience",
        entityId: u.id,
        entityLabel: requested,
        before: { stage: prev.stage, experience: prev.preferred },
        after: { stage: prev.stage, experience: experience.id, targetTab: experience.targetTab },
        metadata: { source: "experience-switcher" },
      }).catch(() => {});

      return res.json({
        success: true,
        stage: prev.stage,
        experience: experience.id,
        targetTab: experience.targetTab,
        available: experience.available,
        note: experience.note ?? null,
      });
    } catch (err) {
      console.error("[career-seeker] set experience error:", err);
      return res.status(500).json({ success: false, message: "Failed to update experience" });
    }
  });
}
