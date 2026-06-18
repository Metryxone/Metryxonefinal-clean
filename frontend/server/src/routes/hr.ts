import { Router } from 'express';
import { db } from '../db/drizzle.js';
import { hrJobs, hrApplications } from '../db/schema.js';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { pool } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { autoPostJob } from '../services/socialPost.js';

const router = Router();

// ── PUBLIC ENDPOINTS (no auth required) ──────────────────────────────

// GET /api/hr/jobs/published — public listing for careers page
router.get('/jobs/published', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(hrJobs)
      .where(eq(hrJobs.status, 'published'))
      .orderBy(desc(hrJobs.publishedAt));

    res.json(rows.map(r => ({
      id: r.id, title: r.title, roleCategory: r.roleCategory,
      employmentType: r.employmentType, workMode: r.workMode, city: r.city,
      description: r.description, eligibility: r.eligibility,
      qualifications: r.qualifications, responsibilities: r.responsibilities,
      kpis: r.kpis, compensationModel: r.compensationModel,
      publishedAt: r.publishedAt,
    })));
  } catch (err: any) {
    console.error('[GET /hr/jobs/published]', err.message);
    res.status(500).json({ error: 'Failed to fetch published jobs' });
  }
});

// POST /api/hr/applications/public — public job application (no login needed)
router.post('/applications/public', async (req, res) => {
  try {
    const { jobId, fullName, email, phone, coverLetter, cvFileName, cvFileData, sourceChannel, consentCaptured } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }
    if (!consentCaptured) {
      return res.status(400).json({ error: 'Consent is required to submit an application' });
    }

    // Verify job exists and is published
    if (jobId) {
      const jobCheck = await db
        .select({ id: hrJobs.id })
        .from(hrJobs)
        .where(and(eq(hrJobs.id, jobId), eq(hrJobs.status, 'published')));
      if (!jobCheck.length) {
        return res.status(400).json({ error: 'Job is not available for applications' });
      }
    }

    // Store CV as resume_url (base64 data URI or filename)
    const resumeUrl = cvFileData || cvFileName || null;

    const [inserted] = await db
      .insert(hrApplications)
      .values({
        jobId: jobId || null,
        fullName,
        email,
        phone: phone || null,
        coverLetter: coverLetter || null,
        resumeUrl,
        sourceChannel: sourceChannel || 'metryx_careers',
        consentCaptured,
      })
      .returning();

    res.status(201).json({
      id: inserted.id,
      status: 'applied',
      message: 'Application submitted successfully. We will review it within 48 hours.'
    });
  } catch (err: any) {
    console.error('[POST /hr/applications/public]', err.message);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// ── PROTECTED ENDPOINTS (auth required) ──────────────────────────────
router.use(requireAuth);

// GET /api/hr/dashboard/stats — HR dashboard overview stats
// Uses raw SQL because of FILTER(WHERE ...) aggregation and phi column not in Drizzle schema
router.get('/dashboard/stats', async (_req, res) => {
  try {
    const [jobStats, appStats, mentorStats] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)::int AS total_jobs,
        COUNT(*) FILTER (WHERE status = 'published')::int AS published_jobs,
        COUNT(*) FILTER (WHERE status IN ('hr_review','legal_review','leadership_approval'))::int AS pending_approvals
      FROM hr_jobs`),
      pool.query(`SELECT COUNT(*)::int AS total_applications FROM hr_applications`),
      pool.query(`SELECT
        COUNT(*)::int AS active_mentors,
        COUNT(*) FILTER (WHERE phi < 60)::int AS mentors_at_risk
      FROM mentor_profiles WHERE status = 'active'`),
    ]);
    const j = jobStats.rows[0] || {};
    const a = appStats.rows[0] || {};
    const m = mentorStats.rows[0] || {};
    res.json({
      totalJobs: j.total_jobs ?? 0,
      publishedJobs: j.published_jobs ?? 0,
      pendingApprovals: j.pending_approvals ?? 0,
      totalApplications: a.total_applications ?? 0,
      activeMentors: m.active_mentors ?? 0,
      mentorsAtRisk: m.mentors_at_risk ?? 0,
      pendingViolations: 0,
      pendingPayouts: 0,
    });
  } catch (err: any) {
    console.error('[GET /hr/dashboard/stats]', err.message);
    res.json({
      totalJobs: 0, publishedJobs: 0, pendingApprovals: 0,
      totalApplications: 0, activeMentors: 0, mentorsAtRisk: 0,
      pendingViolations: 0, pendingPayouts: 0,
    });
  }
});

// GET /api/hr/mentors/at-risk — mentors with low PHI
// Uses raw SQL because phi column is not mapped in Drizzle schema
router.get('/mentors/at-risk', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT mp.*, u.full_name, u.email
      FROM mentor_profiles mp
      LEFT JOIN users u ON u.id = mp.user_id
      WHERE mp.status = 'active' AND mp.phi < 60
      ORDER BY mp.phi ASC
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id, userId: r.user_id, fullName: r.full_name, email: r.email,
      phi: r.phi, status: r.status, specialization: r.specialization,
    })));
  } catch (err: any) {
    console.error('[GET /hr/mentors/at-risk]', err.message);
    res.json([]);
  }
});

const JOB_STAGE_SEQUENCE: Record<string, string> = {
  hr_review: 'legal_review',
  legal_review: 'leadership_approval',
  leadership_approval: 'approved',
};

function rowToJob(r: any) {
  return {
    id: r.id,
    title: r.title,
    roleCategory: r.roleCategory ?? r.role_category,
    employmentType: r.employmentType ?? r.employment_type,
    workMode: r.workMode ?? r.work_mode,
    city: r.city,
    location: r.location,
    salary: r.salary,
    benefits: r.benefits,
    posterImage: r.posterImage ?? r.poster_image,
    description: r.description,
    eligibility: r.eligibility,
    qualifications: r.qualifications,
    responsibilities: r.responsibilities,
    kpis: r.kpis,
    compensationModel: r.compensationModel ?? r.compensation_model,
    postToLinkedIn: r.postToLinkedin ?? r.post_to_linkedin,
    postToIndeed: r.postToIndeed ?? r.post_to_indeed,
    postToNaukri: r.postToNaukri ?? r.post_to_naukri,
    postToFacebook: r.postToFacebook ?? r.post_to_facebook,
    postToWhatsApp: r.postToWhatsapp ?? r.post_to_whatsapp,
    postToInstagram: r.postToInstagram ?? r.post_to_instagram,
    postToTwitter: r.postToTwitter ?? r.post_to_twitter,
    postToCareers: r.postToCareers ?? r.post_to_careers,
    status: r.status,
    publishedAt: r.publishedAt ?? r.published_at,
    closedAt: r.closedAt ?? r.closed_at,
    hrReviewAt: r.hrReviewAt ?? r.hr_review_at,
    legalReviewAt: r.legalReviewAt ?? r.legal_review_at,
    leadershipApprovalAt: r.leadershipApprovalAt ?? r.leadership_approval_at,
    rejectReason: r.rejectReason ?? r.reject_reason,
    applicationCount: r.applicationCount ?? r.application_count ?? 0,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
  };
}

function rowToApplication(r: any) {
  return {
    id: r.id,
    jobId: r.jobId ?? r.job_id,
    fullName: r.fullName ?? r.full_name,
    email: r.email,
    phone: r.phone,
    coverLetter: r.coverLetter ?? r.cover_letter,
    resumeUrl: r.resumeUrl ?? r.resume_url,
    sourceChannel: r.sourceChannel ?? r.source_channel,
    consentCaptured: r.consentCaptured ?? r.consent_captured,
    status: r.status,
    rejectionReason: r.rejectionReason ?? r.rejection_reason,
    processedAt: r.processedAt ?? r.processed_at,
    membershipPaidAt: r.membershipPaidAt ?? r.membership_paid_at,
    userId: r.userId ?? r.user_id,
    createdAt: r.createdAt ?? r.created_at,
  };
}

// GET /api/hr/jobs — also aliased as /api/admin/jobs in index.ts
router.get('/jobs', async (_req, res) => {
  try {
    // Subquery to count applications per job
    const appCounts = db
      .select({
        jobId: hrApplications.jobId,
        applicationCount: count(hrApplications.id).as('application_count'),
      })
      .from(hrApplications)
      .groupBy(hrApplications.jobId)
      .as('app_counts');

    const rows = await db
      .select({
        id: hrJobs.id,
        title: hrJobs.title,
        roleCategory: hrJobs.roleCategory,
        employmentType: hrJobs.employmentType,
        workMode: hrJobs.workMode,
        city: hrJobs.city,
        location: hrJobs.location,
        salary: hrJobs.salary,
        benefits: hrJobs.benefits,
        posterImage: hrJobs.posterImage,
        description: hrJobs.description,
        eligibility: hrJobs.eligibility,
        qualifications: hrJobs.qualifications,
        responsibilities: hrJobs.responsibilities,
        kpis: hrJobs.kpis,
        compensationModel: hrJobs.compensationModel,
        postToLinkedin: hrJobs.postToLinkedin,
        postToIndeed: hrJobs.postToIndeed,
        postToNaukri: hrJobs.postToNaukri,
        postToFacebook: hrJobs.postToFacebook,
        postToWhatsapp: hrJobs.postToWhatsapp,
        postToInstagram: hrJobs.postToInstagram,
        postToTwitter: hrJobs.postToTwitter,
        postToCareers: hrJobs.postToCareers,
        status: hrJobs.status,
        publishedAt: hrJobs.publishedAt,
        closedAt: hrJobs.closedAt,
        hrReviewAt: hrJobs.hrReviewAt,
        legalReviewAt: hrJobs.legalReviewAt,
        leadershipApprovalAt: hrJobs.leadershipApprovalAt,
        rejectReason: hrJobs.rejectReason,
        createdAt: hrJobs.createdAt,
        updatedAt: hrJobs.updatedAt,
        applicationCount: sql<number>`COALESCE(${appCounts.applicationCount}, 0)`.as('application_count'),
      })
      .from(hrJobs)
      .leftJoin(appCounts, eq(appCounts.jobId, hrJobs.id))
      .orderBy(desc(hrJobs.createdAt));

    res.json(rows.map(rowToJob));
  } catch (err: any) {
    console.error('[GET /hr/jobs]', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// POST /api/hr/jobs — create a job posting
router.post('/jobs', async (req, res) => {
  try {
    const {
      title, roleCategory = 'mentor', employmentType = 'part-time', workMode = 'remote',
      city, location, salary, benefits, posterImage, description,
      eligibility, qualifications, responsibilities, kpis, compensationModel,
      postToLinkedIn = false, postToIndeed = false, postToNaukri = false,
      postToFacebook = false, postToWhatsApp = false, postToInstagram = false,
      postToTwitter = false, postToCareers = true,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const [inserted] = await db
      .insert(hrJobs)
      .values({
        title,
        roleCategory,
        employmentType,
        workMode,
        city: city || null,
        location: location || null,
        salary: salary || null,
        benefits: benefits || null,
        posterImage: posterImage || null,
        description: description || null,
        eligibility: eligibility || null,
        qualifications: qualifications || null,
        responsibilities: responsibilities || null,
        kpis: kpis || null,
        compensationModel: compensationModel || null,
        postToLinkedin: postToLinkedIn,
        postToIndeed,
        postToNaukri,
        postToFacebook,
        postToWhatsapp: postToWhatsApp,
        postToInstagram,
        postToTwitter,
        postToCareers,
        createdBy: (req as any).user?.userId,
      })
      .returning();

    res.status(201).json({ job: rowToJob(inserted) });
  } catch (err: any) {
    console.error('[POST /hr/jobs]', err.message);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// PATCH /api/hr/jobs/:id — edit job details or status
router.patch('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body;

    // Build partial update object — only include provided fields
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (b.title !== undefined) updates.title = b.title;
    if (b.roleCategory !== undefined) updates.roleCategory = b.roleCategory;
    if (b.employmentType !== undefined) updates.employmentType = b.employmentType;
    if (b.workMode !== undefined) updates.workMode = b.workMode;
    if (b.city !== undefined) updates.city = b.city;
    if (b.location !== undefined) updates.location = b.location;
    if (b.salary !== undefined) updates.salary = b.salary;
    if (b.benefits !== undefined) updates.benefits = b.benefits;
    if (b.posterImage !== undefined) updates.posterImage = b.posterImage;
    if (b.description !== undefined) updates.description = b.description;
    if (b.eligibility !== undefined) updates.eligibility = b.eligibility;
    if (b.qualifications !== undefined) updates.qualifications = b.qualifications;
    if (b.responsibilities !== undefined) updates.responsibilities = b.responsibilities;
    if (b.kpis !== undefined) updates.kpis = b.kpis;
    if (b.compensationModel !== undefined) updates.compensationModel = b.compensationModel;
    if (b.status !== undefined) updates.status = b.status;

    const result = await db
      .update(hrJobs)
      .set(updates)
      .where(eq(hrJobs.id, id))
      .returning();

    if (!result.length) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: rowToJob(result[0]) });
  } catch (err: any) {
    console.error('[PATCH /hr/jobs/:id]', err.message);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// DELETE /api/hr/jobs/:id
router.delete('/jobs/:id', async (req, res) => {
  try {
    await db.delete(hrJobs).where(eq(hrJobs.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /hr/jobs/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// POST /api/hr/jobs/:id/submit — draft → hr_review
router.post('/jobs/:id/submit', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrJobs)
      .set({ status: 'hr_review', updatedAt: new Date() })
      .where(and(eq(hrJobs.id, req.params.id), eq(hrJobs.status, 'draft')))
      .returning();
    if (!updated) return res.status(400).json({ error: 'Job must be in draft status' });
    res.json({ job: rowToJob(updated) });
  } catch (err: any) {
    console.error('[POST /hr/jobs/:id/submit]', err.message);
    res.status(500).json({ error: 'Failed to submit job' });
  }
});

// POST /api/hr/jobs/:id/approve — advance through stages
router.post('/jobs/:id/approve', async (req, res) => {
  try {
    const [current] = await db
      .select()
      .from(hrJobs)
      .where(eq(hrJobs.id, req.params.id));
    if (!current) return res.status(404).json({ error: 'Job not found' });

    const next = JOB_STAGE_SEQUENCE[current.status];
    if (!next) return res.status(400).json({ error: `Cannot approve from status: ${current.status}` });

    // Build the update with the appropriate timestamp column
    const now = new Date();
    const updates: Record<string, any> = { status: next, updatedAt: now };
    if (current.status === 'hr_review') updates.hrReviewAt = now;
    else if (current.status === 'legal_review') updates.legalReviewAt = now;
    else if (current.status === 'leadership_approval') updates.leadershipApprovalAt = now;

    const [updated] = await db
      .update(hrJobs)
      .set(updates)
      .where(eq(hrJobs.id, req.params.id))
      .returning();

    res.json({ job: rowToJob(updated) });
  } catch (err: any) {
    console.error('[POST /hr/jobs/:id/approve]', err.message);
    res.status(500).json({ error: 'Failed to approve job' });
  }
});

// POST /api/hr/jobs/:id/publish — approved → published + auto-post to social media
router.post('/jobs/:id/publish', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrJobs)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(hrJobs.id, req.params.id), eq(hrJobs.status, 'approved')))
      .returning();
    if (!updated) return res.status(400).json({ error: 'Job must be approved before publishing' });

    const job = rowToJob(updated);

    // Auto-post to social media (non-blocking — don't fail the publish if posts fail)
    const socialResults = await autoPostJob(
      {
        id: job.id,
        title: job.title,
        roleCategory: job.roleCategory,
        employmentType: job.employmentType,
        workMode: job.workMode,
        city: job.city,
        description: job.description,
        qualifications: job.qualifications,
        salary: job.salary,
        compensationModel: job.compensationModel,
      },
      {
        postToFacebook: !!updated.postToFacebook,
        postToLinkedIn: !!updated.postToLinkedin,
        postToTwitter: !!updated.postToTwitter,
      }
    ).catch(err => {
      console.error('[Social Auto-Post] Unexpected error:', err.message);
      return [];
    });

    // Log results
    for (const r of socialResults) {
      if (r.success) {
        console.log(`[Social Auto-Post] ${r.platform}: posted (ID: ${r.postId})`);
      } else {
        console.warn(`[Social Auto-Post] ${r.platform}: failed — ${r.error}`);
      }
    }

    res.json({ job, socialPosts: socialResults });
  } catch (err: any) {
    console.error('[POST /hr/jobs/:id/publish]', err.message);
    res.status(500).json({ error: 'Failed to publish job' });
  }
});

// POST /api/hr/jobs/:id/close
router.post('/jobs/:id/close', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrJobs)
      .set({ status: 'closed', closedAt: new Date(), updatedAt: new Date() })
      .where(eq(hrJobs.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: rowToJob(updated) });
  } catch (err: any) {
    console.error('[POST /hr/jobs/:id/close]', err.message);
    res.status(500).json({ error: 'Failed to close job' });
  }
});

// POST /api/hr/jobs/:id/reject
router.post('/jobs/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const [updated] = await db
      .update(hrJobs)
      .set({ status: 'draft', rejectReason: reason || '', updatedAt: new Date() })
      .where(eq(hrJobs.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: rowToJob(updated) });
  } catch (err: any) {
    console.error('[POST /hr/jobs/:id/reject]', err.message);
    res.status(500).json({ error: 'Failed to reject job' });
  }
});

// GET /api/hr/applications
router.get('/applications', async (req, res) => {
  try {
    const { jobId, status } = req.query;
    const conditions = [];

    if (jobId) conditions.push(eq(hrApplications.jobId, jobId as string));
    if (status && status !== 'all') conditions.push(eq(hrApplications.status, status as string));

    const rows = await db
      .select({
        id: hrApplications.id,
        jobId: hrApplications.jobId,
        fullName: hrApplications.fullName,
        email: hrApplications.email,
        phone: hrApplications.phone,
        coverLetter: hrApplications.coverLetter,
        resumeUrl: hrApplications.resumeUrl,
        sourceChannel: hrApplications.sourceChannel,
        consentCaptured: hrApplications.consentCaptured,
        status: hrApplications.status,
        rejectionReason: hrApplications.rejectionReason,
        processedAt: hrApplications.processedAt,
        membershipPaidAt: hrApplications.membershipPaidAt,
        userId: hrApplications.userId,
        createdAt: hrApplications.createdAt,
        updatedAt: hrApplications.updatedAt,
        jobTitle: hrJobs.title,
      })
      .from(hrApplications)
      .leftJoin(hrJobs, eq(hrJobs.id, hrApplications.jobId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(hrApplications.createdAt));

    res.json(rows.map((r: any) => ({ ...rowToApplication(r), jobTitle: r.jobTitle })));
  } catch (err: any) {
    console.error('[GET /hr/applications]', err.message);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// POST /api/hr/applications/:id/shortlist
router.post('/applications/:id/shortlist', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrApplications)
      .set({ status: 'shortlisted', processedAt: new Date(), updatedAt: new Date() })
      .where(eq(hrApplications.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Application not found' });
    res.json({ application: rowToApplication(updated) });
  } catch (err: any) {
    console.error('[POST /hr/applications/:id/shortlist]', err.message);
    res.status(500).json({ error: 'Failed to shortlist application' });
  }
});

// POST /api/hr/applications/:id/reject
router.post('/applications/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const [updated] = await db
      .update(hrApplications)
      .set({
        status: 'rejected',
        rejectionReason: reason || '',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hrApplications.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Application not found' });
    res.json({ application: rowToApplication(updated) });
  } catch (err: any) {
    console.error('[POST /hr/applications/:id/reject]', err.message);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

// POST /api/hr/applications/:id/request-payment — shortlisted → payment_pending
router.post('/applications/:id/request-payment', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrApplications)
      .set({ status: 'payment_pending', processedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(hrApplications.id, req.params.id), eq(hrApplications.status, 'shortlisted')))
      .returning();
    if (!updated) return res.status(400).json({ error: 'Application must be shortlisted first' });
    res.json({ application: rowToApplication(updated) });
  } catch (err: any) {
    console.error('[POST /hr/applications/:id/request-payment]', err.message);
    res.status(500).json({ error: 'Failed to request payment' });
  }
});

// POST /api/hr/applications/:id/confirm-payment — payment_pending → training
router.post('/applications/:id/confirm-payment', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrApplications)
      .set({ status: 'training', membershipPaidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(hrApplications.id, req.params.id), eq(hrApplications.status, 'payment_pending')))
      .returning();
    if (!updated) return res.status(400).json({ error: 'Application must be in payment_pending status' });
    res.json({ application: rowToApplication(updated) });
  } catch (err: any) {
    console.error('[POST /hr/applications/:id/confirm-payment]', err.message);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// POST /api/hr/applications/:id/start-training — payment_pending → training (alias)
router.post('/applications/:id/start-training', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrApplications)
      .set({ status: 'training', updatedAt: new Date() })
      .where(and(eq(hrApplications.id, req.params.id), eq(hrApplications.status, 'payment_pending')))
      .returning();
    if (!updated) return res.status(400).json({ error: 'Application must be in payment_pending status' });
    res.json({ application: rowToApplication(updated) });
  } catch (err: any) {
    console.error('[POST /hr/applications/:id/start-training]', err.message);
    res.status(500).json({ error: 'Failed to start training' });
  }
});

// POST /api/hr/applications/:id/start-assessment — training → assessment
router.post('/applications/:id/start-assessment', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrApplications)
      .set({ status: 'assessment', updatedAt: new Date() })
      .where(and(eq(hrApplications.id, req.params.id), eq(hrApplications.status, 'training')))
      .returning();
    if (!updated) return res.status(400).json({ error: 'Application must be in training status' });
    res.json({ application: rowToApplication(updated) });
  } catch (err: any) {
    console.error('[POST /hr/applications/:id/start-assessment]', err.message);
    res.status(500).json({ error: 'Failed to start assessment' });
  }
});

// POST /api/hr/applications/:id/activate — assessment → active
router.post('/applications/:id/activate', async (req, res) => {
  try {
    const [updated] = await db
      .update(hrApplications)
      .set({ status: 'active', processedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(hrApplications.id, req.params.id), eq(hrApplications.status, 'assessment')))
      .returning();
    if (!updated) return res.status(400).json({ error: 'Application must be in assessment status' });
    res.json({ application: rowToApplication(updated) });
  } catch (err: any) {
    console.error('[POST /hr/applications/:id/activate]', err.message);
    res.status(500).json({ error: 'Failed to activate mentor' });
  }
});

export default router;
