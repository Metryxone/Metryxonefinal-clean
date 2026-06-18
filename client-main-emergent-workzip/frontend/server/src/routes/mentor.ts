import { Router, Request, Response } from 'express';
import { db } from '../db/drizzle.js';
import { pool } from '../db/client.js';
import {
  users,
  mentorProfiles,
  mentorBookings,
  mentorReviews,
  bookingMessages,
  lbiSessions,
  lbiModules,
  mentorSessionNotes,
} from '../db/schema.js';
import { eq, and, desc, asc, sql, gte, getTableColumns } from 'drizzle-orm';
import { trigger as scenarioTrigger } from '../notifications/scenarioEngine.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// ─── Helper: map DB row → API shape ───
function rowToMentor(row: any) {
  return {
    id: String(row.profile_id),
    userId: row.user_id,
    displayName: row.display_name || row.full_name || 'Mentor',
    fullName: row.full_name,
    title: row.title,
    mentorType: row.mentor_type || 'subject_tutor',
    verified: row.is_verified || false,
    featured: row.is_featured || false,
    rating: parseFloat(row.rating) || 0,
    totalReviews: parseInt(row.total_reviews) || 0,
    totalSessions: parseInt(row.total_sessions) || 0,
    subjects: row.subjects || [],
    psychologicalAreas: row.psychological_areas || [],
    specializations: row.specializations || [],
    lbiDomains: row.lbi_domains || [],
    languages: row.languages || [],
    experienceYears: parseInt(row.experience_years) || 0,
    hourlyRate: parseFloat(row.hourly_rate) || 0,
    currency: row.currency || 'INR',
    mode: row.mode || 'online',
    city: row.city,
    bio: row.bio,
    education: row.education || [],
    certifications: row.certifications || [],
    ageGroups: row.age_groups || [],
    availability: row.availability || {},
    profileImageUrl: row.profile_image_url,
    linkedinUrl: row.linkedin_url,
    aiMatchTags: row.ai_match_tags || [],
    status: row.status || 'pending',
  };
}

// ─── GET /api/mentor-marketplace ───
// Public list with filters + sorting
// Kept as raw SQL due to complex dynamic WHERE with ILIKE, ANY(), and dynamic ORDER BY
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      search = '',
      mentorType = '',
      subject = '',
      mode = '',
      minRating = '',
      sort = 'rating_desc',
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions: string[] = ["mp.status = 'active'"];
    const params: any[] = [];
    let p = 1;

    if (search) {
      conditions.push(`(mp.display_name ILIKE $${p} OR mp.bio ILIKE $${p} OR $${p} = ANY(mp.subjects) OR $${p} = ANY(mp.specializations))`);
      params.push(`%${search}%`);
      p++;
    }
    if (mentorType) {
      conditions.push(`mp.mentor_type = $${p}`);
      params.push(mentorType);
      p++;
    }
    if (subject) {
      conditions.push(`$${p} = ANY(mp.subjects)`);
      params.push(subject);
      p++;
    }
    if (mode) {
      conditions.push(`(mp.mode = $${p} OR mp.mode = 'hybrid')`);
      params.push(mode);
      p++;
    }
    if (minRating) {
      conditions.push(`mp.rating >= $${p}`);
      params.push(parseFloat(minRating));
      p++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'mp.rating DESC, mp.total_sessions DESC';
    if (sort === 'rate_asc') orderBy = 'mp.hourly_rate ASC';
    else if (sort === 'rate_desc') orderBy = 'mp.hourly_rate DESC';
    else if (sort === 'experience') orderBy = 'mp.experience_years DESC';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM mentor_profiles mp ${where}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT mp.*, u.full_name,
              COALESCE(mp.display_name, u.full_name) AS display_name
       FROM mentor_profiles mp
       LEFT JOIN users u ON u.id = mp.user_id
       ${where}
       ORDER BY mp.is_featured DESC, ${orderBy}
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      mentors: result.rows.map(r => ({ ...rowToMentor(r), id: String(r.id) })),
      totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
    });
  } catch (err: any) {
    console.error('[GET /mentor-marketplace]', err.message);
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// ─── GET /api/mentor-marketplace/suggestions ───
// AI-based LBI matching — returns top mentor suggestions for a child
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { childId, limit = '6' } = req.query as Record<string, string>;
    const parsedLimit = parseInt(limit);

    if (!childId) {
      // No child — return featured mentors
      const rows = await db
        .select({
          ...getTableColumns(mentorProfiles),
          fullName: users.fullName,
          displayName: sql<string>`COALESCE(${mentorProfiles.displayName}, ${users.fullName})`.as('display_name'),
        })
        .from(mentorProfiles)
        .leftJoin(users, eq(users.id, mentorProfiles.userId))
        .where(eq(mentorProfiles.status, 'active'))
        .orderBy(desc(mentorProfiles.isFeatured), desc(mentorProfiles.rating))
        .limit(parsedLimit);

      return res.json({
        suggestions: rows.map(r => {
          const flat = flattenMentorRow(r);
          return { ...rowToMentor(flat), id: String(flat.id), matchScore: 80, matchReason: 'Top-rated mentor' };
        }),
      });
    }

    // Fetch child's LBI session scores by domain
    const lbiRows = await db
      .select({
        percentageScore: lbiSessions.percentageScore,
        moduleName: lbiModules.moduleName,
        subModules: lbiModules.subModules,
      })
      .from(lbiSessions)
      .innerJoin(lbiModules, eq(lbiModules.id, lbiSessions.moduleId))
      .where(and(eq(lbiSessions.childId, childId), eq(lbiSessions.status, 'Completed')))
      .orderBy(desc(lbiSessions.completedAt));

    // Build a domain weakness map from LBI scores
    const weakDomains: string[] = [];
    const domainScores: Record<string, number> = {};

    for (const row of lbiRows) {
      const score = parseFloat(row.percentageScore as string) || 0;
      const moduleName: string = row.moduleName || '';
      domainScores[moduleName] = score;
      if (score < 60) weakDomains.push(moduleName.toLowerCase());
    }

    // Map weak LBI domains to mentor specialization areas
    const domainToMentorType: Record<string, string[]> = {
      'focus': ['subject_tutor', 'performance_coach'],
      'emotional': ['psychological_counsellor'],
      'social': ['psychological_counsellor'],
      'motivation': ['performance_coach'],
      'resilience': ['performance_coach', 'psychological_counsellor'],
      'exam': ['exam_strategist', 'subject_tutor'],
      'academic': ['subject_tutor', 'exam_strategist'],
      'cognitive': ['subject_tutor'],
    };

    const preferredTypes = new Set<string>();
    for (const domain of weakDomains) {
      for (const [key, types] of Object.entries(domainToMentorType)) {
        if (domain.includes(key)) types.forEach(t => preferredTypes.add(t));
      }
    }
    if (preferredTypes.size === 0) preferredTypes.add('subject_tutor');

    const typeList = Array.from(preferredTypes);

    // Kept as raw SQL due to ANY($1::text[]) in ORDER BY CASE expression
    const result = await pool.query(
      `SELECT mp.*, u.full_name,
              COALESCE(mp.display_name, u.full_name) AS display_name
       FROM mentor_profiles mp
       LEFT JOIN users u ON u.id = mp.user_id
       WHERE mp.status = 'active'
       ORDER BY
         CASE WHEN mp.mentor_type = ANY($1::text[]) THEN 0 ELSE 1 END,
         mp.is_featured DESC,
         mp.rating DESC
       LIMIT $2`,
      [typeList, parsedLimit]
    );

    const suggestions = result.rows.map(r => {
      const mentor = { ...rowToMentor(r), id: String(r.id) };
      let matchScore = 70;
      let matchReason = 'Highly rated mentor';

      if (preferredTypes.has(mentor.mentorType)) {
        matchScore = 85 + Math.min(mentor.rating * 2, 13);
        const typeLabels: Record<string, string> = {
          subject_tutor: 'academic support',
          psychological_counsellor: 'emotional & social skills',
          exam_strategist: 'exam preparation',
          performance_coach: 'motivation & focus',
        };
        matchReason = `Matched to your child's ${typeLabels[mentor.mentorType] || 'learning needs'}`;
      }

      return { ...mentor, matchScore: Math.min(Math.round(matchScore), 99), matchReason };
    });

    res.json({ suggestions, weakDomains, preferredTypes: typeList });
  } catch (err: any) {
    console.error('[GET /mentor-marketplace/suggestions]', err.message);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// ─── GET /api/mentor-marketplace/:id ───
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Support lookup by either integer profile ID or user UUID
    const numericId = parseInt(id);
    const isNumeric = !isNaN(numericId);

    const profileRows = await db
      .select({
        ...getTableColumns(mentorProfiles),
        fullName: users.fullName,
        email: users.email,
        displayName: sql<string>`COALESCE(${mentorProfiles.displayName}, ${users.fullName})`.as('display_name'),
      })
      .from(mentorProfiles)
      .leftJoin(users, eq(users.id, mentorProfiles.userId))
      .where(
        isNumeric
          ? eq(mentorProfiles.id, numericId)
          : eq(mentorProfiles.userId, id)
      )
      .limit(1);

    if (!profileRows.length) return res.status(404).json({ error: 'Mentor not found' });

    const row = profileRows[0];
    const profileId = (row as any).id;
    const flat = flattenMentorRow(row);
    const profile = { ...rowToMentor(flat), id: String(profileId) };

    // Fetch reviews
    const reviewRows = await db
      .select({
        id: mentorReviews.id,
        rating: mentorReviews.rating,
        comment: mentorReviews.comment,
        createdAt: mentorReviews.createdAt,
        reviewerName: users.fullName,
      })
      .from(mentorReviews)
      .leftJoin(users, eq(users.id, mentorReviews.reviewerId))
      .where(eq(mentorReviews.mentorId, profileId))
      .orderBy(desc(mentorReviews.createdAt))
      .limit(20);

    // Fetch upcoming available slots (next 14 days)
    const slotRows = await db
      .select({
        id: mentorBookings.id,
        slotDate: mentorBookings.slotDate,
        startTime: mentorBookings.startTime,
        endTime: mentorBookings.endTime,
      })
      .from(mentorBookings)
      .where(
        and(
          eq(mentorBookings.mentorId, profileId),
          eq(mentorBookings.status, 'available'),
          gte(mentorBookings.slotDate, sql`CURRENT_DATE`)
        )
      )
      .orderBy(asc(mentorBookings.slotDate), asc(mentorBookings.startTime))
      .limit(20);

    res.json({
      profile,
      reviews: reviewRows.map(r => ({
        id: String(r.id),
        reviewerName: r.reviewerName || 'Anonymous',
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
      availability: slotRows.map(r => ({
        id: r.id,
        date: r.slotDate,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
    });
  } catch (err: any) {
    console.error('[GET /mentor-marketplace/:id]', err.message);
    res.status(500).json({ error: 'Failed to fetch mentor profile' });
  }
});

// ─── POST /api/mentor-marketplace/:id/book ───
router.post('/:id/book', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { childId, slotDate, startTime, endTime, mode = 'online', notes = '' } = req.body;
    const user = (req as any).user;

    if (!childId || !slotDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'childId, slotDate, startTime, endTime are required' });
    }

    const inserted = await db
      .insert(mentorBookings)
      .values({
        mentorId: parseInt(id),
        childId,
        parentId: user?.id || null,
        slotDate,
        startTime,
        endTime,
        mode,
        status: 'pending',
        notes,
      })
      .returning({ id: mentorBookings.id });

    // Fire booking.created scenario notification — non-blocking
    setImmediate(() => {
      scenarioTrigger('booking.created', {
        recipientId: user?.id || childId,
        mentorName: `Mentor #${id}`,
        date: slotDate,
        time: startTime,
      }).catch(() => {});
    });

    res.json({ bookingId: inserted[0].id, status: 'pending', message: 'Booking requested. The mentor will confirm shortly.' });
  } catch (err: any) {
    console.error('[POST /mentor-marketplace/:id/book]', err.message);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ─── GET /api/mentor-marketplace/bookings — list bookings for current parent ───
router.get('/bookings', async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows } = await pool.query(
      `SELECT mb.*, 
              mp.display_name AS mentor_display_name, mp.title AS mentor_title,
              mp.profile_image_url AS mentor_photo, mp.rating AS mentor_rating,
              mp.subjects AS mentor_subjects, mp.lbi_domains AS mentor_lbi_domains,
              mp.hourly_rate AS mentor_rate, mp.is_verified AS mentor_verified,
              c.name AS child_name, c.grade AS child_grade
       FROM mentor_bookings mb
       JOIN mentor_profiles mp ON mp.id = mb.mentor_id
       JOIN children c ON c.id = mb.child_id
       WHERE mb.parent_id = $1
       ORDER BY mb.slot_date DESC, mb.start_time DESC`,
      [user.id]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[GET /mentor-marketplace/bookings]', err.message);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ─── GET /api/mentor-marketplace/bookings/:bookingId/messages ───
router.get('/bookings/:bookingId/messages', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { bookingId } = req.params;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { rows: booking } = await pool.query(
      `SELECT id FROM mentor_bookings WHERE id = $1 AND (parent_id = $2 OR EXISTS(
        SELECT 1 FROM mentor_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.id = mentor_id AND u.id = $2
      ))`,
      [bookingId, user.id]
    );
    if (!booking.length) return res.status(403).json({ error: 'Access denied' });
    const { rows } = await pool.query(
      `SELECT id, sender_id, sender_name, sender_role, message, created_at
       FROM booking_messages WHERE booking_id = $1 ORDER BY created_at ASC`,
      [bookingId]
    );
    res.json(rows);
  } catch (err: any) {
    console.error('[GET /mentor-marketplace/bookings/:id/messages]', err.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ─── POST /api/mentor-marketplace/bookings/:bookingId/messages ───
router.post('/bookings/:bookingId/messages', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { bookingId } = req.params;
  const { message } = req.body;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
  try {
    const { rows: booking } = await pool.query(
      `SELECT id FROM mentor_bookings WHERE id = $1 AND (parent_id = $2 OR EXISTS(
        SELECT 1 FROM mentor_profiles mp JOIN users u ON u.id = mp.user_id WHERE mp.id = mentor_id AND u.id = $2
      ))`,
      [bookingId, user.id]
    );
    if (!booking.length) return res.status(403).json({ error: 'Access denied' });
    const senderRole = user.role === 'mentor' ? 'mentor' : 'parent';
    const { rows } = await pool.query(
      `INSERT INTO booking_messages (booking_id, sender_id, sender_name, sender_role, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [bookingId, user.id, user.fullName || user.full_name || 'Parent', senderRole, message.trim()]
    );
    res.json(rows[0]);
  } catch (err: any) {
    console.error('[POST /mentor-marketplace/bookings/:id/messages]', err.message);
    res.status(500).json({ error: 'Failed to post message' });
  }
});

// ─── Helper: flatten Drizzle select result with spread mentorProfiles ───
// Drizzle returns { id, userId, ..., fullName, displayName } when using
// spread on the table. This helper maps column names to the snake_case
// keys that rowToMentor expects.
function flattenMentorRow(row: any): any {
  return {
    id: row.id,
    profile_id: row.id,
    user_id: row.userId,
    display_name: row.displayName,
    full_name: row.fullName,
    title: row.title,
    bio: row.bio,
    mentor_type: row.mentorType,
    subjects: row.subjects,
    psychological_areas: row.psychologicalAreas,
    specializations: row.specializations,
    lbi_domains: row.lbiDomains,
    languages: row.languages,
    experience_years: row.experienceYears,
    hourly_rate: row.hourlyRate,
    currency: row.currency,
    mode: row.mode,
    city: row.city,
    education: row.education,
    certifications: row.certifications,
    age_groups: row.ageGroups,
    availability: row.availability,
    profile_image_url: row.profileImageUrl,
    linkedin_url: row.linkedinUrl,
    is_verified: row.isVerified,
    is_featured: row.isFeatured,
    rating: row.rating,
    total_reviews: row.totalReviews,
    total_sessions: row.totalSessions,
    ai_match_tags: row.aiMatchTags,
    status: row.status,
    email: row.email,
  };
}

// ── Mentor Session Notes (Gap 5) ───────────────────────────────────────────
router.post('/bookings/:bookingId/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const {
      childId, sessionDate, sessionType,
      domainsWorkedOn, sessionSummary, progressObserved,
      areasForImprovement, homeworkAssigned, nextSessionGoals,
      parentVisibility, studentVisibility, overallProgress,
    } = req.body;

    if (!sessionSummary) {
      return res.status(400).json({ error: 'sessionSummary is required' });
    }

    const booking = await db
      .select()
      .from(mentorBookings)
      .where(eq(mentorBookings.id, bookingId))
      .limit(1);
    if (!booking.length) return res.status(404).json({ error: 'Booking not found' });

    const mentorProfile = await db
      .select()
      .from(mentorProfiles)
      .where(eq(mentorProfiles.userId, req.user!.id))
      .limit(1);

    const [note] = await db.insert(mentorSessionNotes).values({
      bookingId,
      mentorId: mentorProfile[0]?.id ?? null,
      childId: childId || booking[0].childId || null,
      sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
      sessionType: sessionType || booking[0].sessionType || 'ongoing',
      domainsWorkedOn: domainsWorkedOn || [],
      sessionSummary,
      progressObserved: progressObserved || null,
      areasForImprovement: areasForImprovement || null,
      homeworkAssigned: homeworkAssigned || null,
      nextSessionGoals: nextSessionGoals || null,
      parentVisibility: parentVisibility ?? true,
      studentVisibility: studentVisibility ?? true,
      overallProgress: overallProgress || 'on-track',
    }).returning();

    res.status(201).json(note);
  } catch (err) {
    console.error('[Mentor Notes] submit error:', err);
    res.status(500).json({ error: 'Failed to save session note' });
  }
});

router.get('/bookings/:bookingId/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const notes = await db
      .select()
      .from(mentorSessionNotes)
      .where(eq(mentorSessionNotes.bookingId, bookingId))
      .orderBy(desc(mentorSessionNotes.createdAt));
    res.json(notes);
  } catch (err) {
    console.error('[Mentor Notes] fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch session notes' });
  }
});

router.get('/child/:childId/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { childId } = req.params;
    const notes = await db
      .select()
      .from(mentorSessionNotes)
      .where(eq(mentorSessionNotes.childId, childId))
      .orderBy(desc(mentorSessionNotes.createdAt));
    res.json(notes);
  } catch (err) {
    console.error('[Mentor Notes] child fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

export default router;
