import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';
import { db } from '../db/drizzle.js';
import { users, mentorProfiles } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sendEmail } from '../notifications/delivery/email.js';
import multer from 'multer';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';

const router = Router();

const uploadsDir = path.resolve('uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `agreement_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const ROLE_TITLES: Record<string, string> = {
  subject_tutor: 'Subject Tutor',
  exam_strategist: 'Exam Strategist',
  performance_coach: 'Performance Coach',
  psychological_counsellor: 'Psychological Counsellor',
  career_counsellor: 'Career Counsellor',
  employability_coach: 'Employability Coach',
  interview_coach: 'Interview Coach',
  leadership_coach: 'Leadership Coach',
  hr_consultant: 'HR Consultant',
  corporate_trainer: 'Corporate Trainer',
};

const ROLE_AGREEMENT: Record<string, { scope: string; kpis: string; responsibilities: string }> = {
  subject_tutor: {
    scope: 'Deliver subject-specific academic instruction to improve conceptual understanding and academic performance of enrolled students via the MetryxOne platform.',
    responsibilities: '• Plan and deliver structured lessons aligned to curriculum\n• Simplify complex concepts using appropriate pedagogy\n• Conduct periodic assessments and provide written feedback\n• Assign and review practice work within agreed timelines\n• Maintain session records and attendance logs in the dashboard',
    kpis: '• Student assessment score improvement ≥15% over 8 weeks\n• Session completion rate ≥90%\n• Parent/student satisfaction rating ≥4.0/5.0\n• Response time to student queries ≤24 hours',
  },
  psychological_counsellor: {
    scope: 'Support students\' mental health, emotional well-being, and behavioural development through confidential counselling sessions on the MetryxOne platform.',
    responsibilities: '• Conduct individual and group counselling sessions\n• Assess psychological concerns using validated tools\n• Provide coping strategies and psychoeducation\n• Maintain strictly confidential session records\n• Coordinate with parents and institutes where appropriate and with consent',
    kpis: '• Student well-being index improvement ≥20% over 6 sessions\n• Session completion rate ≥85%\n• Crisis response within 2 hours\n• Satisfaction rating ≥4.2/5.0',
  },
  exam_strategist: {
    scope: 'Optimise student performance in competitive and board examinations through structured planning, pattern analysis, and strategic coaching on the MetryxOne platform.',
    responsibilities: '• Design personalised study plans aligned to exam timelines\n• Analyse past exam patterns and identify high-yield areas\n• Conduct and evaluate mock tests with detailed feedback\n• Train students in time management and question prioritisation\n• Provide performance analytics reports monthly',
    kpis: '• Mock test improvement ≥20% over baseline\n• Study plan adherence rate ≥80%\n• Exam pass rate of mentored students ≥85%\n• Satisfaction rating ≥4.1/5.0',
  },
  performance_coach: {
    scope: 'Enhance overall student productivity, discipline, goal achievement, and personal effectiveness through structured coaching on the MetryxOne platform.',
    responsibilities: '• Set SMART goals collaboratively with each student\n• Build and monitor personalised study routines and habits\n• Track progress weekly and adjust plans accordingly\n• Address procrastination, motivation blocks, and performance anxiety\n• Provide accountability check-ins between formal sessions',
    kpis: '• Goal achievement rate ≥70% within 90 days\n• Study habit consistency score improvement ≥25%\n• Student self-efficacy rating improvement ≥15%\n• Satisfaction rating ≥4.0/5.0',
  },
  career_counsellor: {
    scope: 'Guide students and young professionals in making informed career decisions, exploring pathways, and building goal-oriented plans through the MetryxOne Employability Index platform.',
    responsibilities: '• Conduct career interest and aptitude assessments\n• Map student profiles to career pathways and higher education options\n• Provide guidance on course selection, entrance exams and scholarships\n• Build personalised career roadmaps with milestones\n• Coordinate with placement cells and industry partners where applicable',
    kpis: '• Career clarity score improvement ≥30% post-sessions\n• Goal-setting completion rate ≥85%\n• Session completion rate ≥88%\n• Satisfaction rating ≥4.1/5.0',
  },
  employability_coach: {
    scope: 'Develop job-readiness, workplace competencies, and professional soft skills of students and early-career professionals through the MetryxOne Employability Index platform.',
    responsibilities: '• Assess employability gaps using MetryxOne EI reports\n• Design personalised skill-building plans for workplace readiness\n• Conduct mock workplace scenario sessions and feedback reviews\n• Train in communication, teamwork, critical thinking and adaptability\n• Track improvement against Employability Index benchmarks',
    kpis: '• Employability Index score improvement ≥20%\n• Skill gap closure rate ≥70% within 12 weeks\n• Session completion rate ≥90%\n• Satisfaction rating ≥4.2/5.0',
  },
  interview_coach: {
    scope: 'Prepare students and graduates for campus placements, internship drives, and professional interviews through targeted coaching on the MetryxOne platform.',
    responsibilities: '• Conduct mock interviews and provide structured feedback\n• Train on aptitude tests, group discussions and HR rounds\n• Review and improve resume and LinkedIn profiles\n• Provide sector-specific interview strategy guidance\n• Track placement outcomes and iterate coaching approach accordingly',
    kpis: '• Mock interview score improvement ≥25%\n• Placement/offer conversion rate of mentored candidates ≥60%\n• Session completion rate ≥90%\n• Satisfaction rating ≥4.3/5.0',
  },
  leadership_coach: {
    scope: 'Develop leadership capabilities, strategic thinking, and executive presence in mid-to-senior professionals through the MetryxOne Enterprise Model platform.',
    responsibilities: '• Conduct leadership style and 360-degree feedback assessments\n• Design individual leadership development plans\n• Coach on decision-making, influence, and stakeholder management\n• Facilitate structured reflection and accountability sessions\n• Provide quarterly progress reviews aligned to organisational goals',
    kpis: '• Leadership effectiveness score improvement ≥20%\n• Goal achievement rate ≥75% within 6 months\n• Session completion rate ≥85%\n• Satisfaction rating ≥4.4/5.0',
  },
  hr_consultant: {
    scope: 'Advise organisations on talent strategy, workforce capability building, and HR practices through the MetryxOne Enterprise Model platform.',
    responsibilities: '• Analyse workforce behavioural data from MetryxOne assessments\n• Design talent management and succession planning frameworks\n• Advise on learning & development needs at team and organisational level\n• Support HR teams in translating psychometric data into actionable interventions\n• Deliver periodic workforce health and capability reports',
    kpis: '• Workforce capability index improvement ≥15% annually\n• Recommendation adoption rate ≥70%\n• Client engagement satisfaction ≥4.3/5.0\n• Report delivery adherence ≥95%',
  },
  corporate_trainer: {
    scope: 'Design and deliver structured learning and development programmes for corporate teams using MetryxOne Enterprise assessment insights.',
    responsibilities: '• Design training content aligned to MetryxOne Enterprise assessment outcomes\n• Deliver instructor-led and blended learning workshops\n• Measure pre- and post-training capability shifts\n• Coordinate with HR and L&D teams on programme deployment\n• Provide training effectiveness reports and recommendations',
    kpis: '• Training effectiveness score improvement ≥25%\n• Programme completion rate ≥90%\n• Knowledge retention rate ≥70% at 30-day follow-up\n• Satisfaction rating ≥4.2/5.0',
  },
};

function getAgreementContent(mentorType: string) {
  const roleKey = mentorType?.toLowerCase().replace(/[\s-]/g, '_') || 'subject_tutor';
  return ROLE_AGREEMENT[roleKey] || ROLE_AGREEMENT['subject_tutor'];
}

// These routes use columns (mentor_code, agreement_token, etc.) not in the main migration,
// so we use pool.query for the complex JOIN queries and Drizzle where possible.
router.get('/mentor-agreement/:mentorCode/info', async (req: Request, res: Response) => {
  try {
    const { mentorCode } = req.params;
    const { token } = req.query as { token: string };
    if (!token) return res.status(400).json({ message: 'Token required' });

    const { rows } = await pool.query(
      `SELECT mp.*, u.email, u.full_name FROM mentor_profiles mp
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.mentor_code = $1 AND mp.agreement_token = $2`,
      [mentorCode, token]
    );

    if (!rows.length) return res.status(404).json({ message: 'Invalid link' });
    const mp = rows[0];
    if (mp.agreement_token_expires_at && new Date(mp.agreement_token_expires_at) < new Date()) {
      return res.status(410).json({ message: 'This agreement link has expired. Please contact support@metryxone.com.' });
    }
    if (mp.agreement_status === 'completed') {
      return res.json({ alreadyCompleted: true, mentorCode: mp.mentor_code, displayName: mp.display_name });
    }

    const agreement = getAgreementContent(mp.mentor_type);
    res.json({
      mentorCode: mp.mentor_code,
      displayName: mp.display_name || mp.full_name,
      mentorType: mp.mentor_type,
      roleTitle: ROLE_TITLES[mp.mentor_type] || mp.mentor_type,
      agreementStatus: mp.agreement_status,
      scope: agreement.scope,
      responsibilities: agreement.responsibilities,
      kpis: agreement.kpis,
    });
  } catch (err: any) {
    console.error('[GET /mentor-agreement/:code/info]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/mentor-agreement/:mentorCode/submit',
  upload.single('signedAgreement'),
  async (req: Request, res: Response) => {
    try {
      const { mentorCode } = req.params;
      const { token, acknowledged } = req.body;
      if (!token) return res.status(400).json({ message: 'Token required' });
      if (acknowledged !== 'true') return res.status(400).json({ message: 'Acknowledgement required' });

      const { rows } = await pool.query(
        `SELECT * FROM mentor_profiles WHERE mentor_code = $1 AND agreement_token = $2`,
        [mentorCode, token]
      );
      if (!rows.length) return res.status(404).json({ message: 'Invalid link' });
      const mp = rows[0];
      if (mp.agreement_token_expires_at && new Date(mp.agreement_token_expires_at) < new Date()) {
        return res.status(410).json({ message: 'Agreement link expired. Contact support@metryxone.com.' });
      }

      const fileUrl = req.file ? `/files/${req.file.filename}` : null;
      const newStatus = fileUrl ? 'completed' : 'acknowledged';
      const newMentorStatus = fileUrl ? 'active' : 'pending_agreement';

      await pool.query(
        `UPDATE mentor_profiles
         SET agreement_status = $1,
             agreement_acknowledged_at = NOW(),
             agreement_file_url = COALESCE($2, agreement_file_url),
             status = $3,
             activated_at = CASE WHEN $3 = 'active' THEN NOW() ELSE activated_at END,
             updated_at = NOW()
         WHERE mentor_code = $4`,
        [newStatus, fileUrl, newMentorStatus, mentorCode]
      );

      if (newStatus === 'completed') {
        try {
          const userRows = await db.select({ email: users.email, fullName: users.fullName })
            .from(users).where(eq(users.id, mp.user_id));
          if (userRows.length) {
            await sendEmail({
              to: userRows[0].email!,
              name: userRows[0].fullName!,
              title: 'Welcome to MetryxOne Mentor Marketplace!',
              message: `Dear <strong>${userRows[0].fullName}</strong>,<br><br>
Your signed agreement has been received and your mentor profile is now <strong style="color:#16a34a;">ACTIVE</strong>.<br><br>
<strong>Your Mentor ID: ${mentorCode}</strong><br><br>
You are now live on the MetryxOne Mentor Marketplace. Students and parents can discover and book sessions with you.<br><br>
Log in to your dashboard to complete your profile, set your availability, and start accepting bookings.`,
              actionUrl: 'https://metryxone.replit.app/login',
            });
          }
        } catch (e) {
          console.warn('[Mentor Agreement] Activation email failed (non-fatal):', e);
        }
      }

      res.json({ success: true, status: newStatus, mentorStatus: newMentorStatus });
    } catch (err: any) {
      console.error('[POST /mentor-agreement/:code/submit]', err.message);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post('/admin/mentors/:mentorCode/resend-agreement', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { mentorCode } = req.params;
    const { rows } = await pool.query(
      `SELECT mp.*, u.email, u.full_name FROM mentor_profiles mp
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.mentor_code = $1`,
      [mentorCode]
    );
    if (!rows.length) return res.status(404).json({ message: 'Mentor not found' });
    const mp = rows[0];

    const newToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE mentor_profiles SET agreement_token=$1, agreement_token_expires_at=$2, agreement_status='sent', agreement_sent_at=NOW(), updated_at=NOW() WHERE mentor_code=$3`,
      [newToken, expiry, mentorCode]
    );

    const agreementUrl = `${process.env.CLIENT_ORIGIN || 'https://metryxone.replit.app'}/mentor-agreement/${mentorCode}/sign?token=${newToken}`;
    try {
      await sendEmail({
        to: mp.email,
        name: mp.full_name || mp.display_name,
        title: 'MetryxOne Mentor Agreement — Action Required',
        message: buildAgreementEmail(mp, agreementUrl),
        actionUrl: agreementUrl,
      });
    } catch (e) {
      console.warn('[Mentor Agreement] Resend email failed:', e);
    }

    res.json({ success: true, agreementUrl });
  } catch (err: any) {
    console.error('[POST /admin/mentors/:code/resend-agreement]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export function buildAgreementEmail(mp: any, agreementUrl: string): string {
  const roleTitle = ROLE_TITLES[mp.mentor_type] || 'Mentor';
  return `Dear <strong>${mp.display_name || mp.full_name}</strong>,<br><br>
Congratulations on being selected as a <strong>${roleTitle}</strong> on the MetryxOne platform.<br><br>
<strong>Your Mentor ID: ${mp.mentor_code}</strong><br><br>
To activate your mentor dashboard and become visible in the MetryxOne Mentor Marketplace, please complete the following steps:<br><br>
<ol>
  <li>Click the link below to review your role-specific service agreement</li>
  <li>Acknowledge that you have read and accept the terms</li>
  <li>Upload your signed copy of the agreement (PDF or image)</li>
</ol>
<div style="margin:24px 0;text-align:center;">
  <a href="${agreementUrl}" style="background:#344E86;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Review & Sign Agreement</a>
</div>
This link expires in <strong>14 days</strong>. Once your agreement is submitted, your profile will be activated and you will be live on the marketplace.<br><br>
If you have any questions, contact us at <a href="mailto:support@metryxone.com">support@metryxone.com</a>.`;
}

export default router;
