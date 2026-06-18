import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';
import { db } from '../db/drizzle.js';
import { users, onboardingRequests, kycDocuments, onboardingHistory as onboardingHistoryTable, studentEnrollments } from '../db/schema.js';
import { eq, and, desc, count, ne } from 'drizzle-orm';
import { sendEmail, sendEmailAsync } from '../notifications/delivery/email.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { buildAgreementEmail } from './mentorAgreement.js';
import { rowsToSnake } from '../db/utils.js';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────
function rowToRequest(r: any) {
  return {
    id: r.id,
    entityType: r.entityType ?? r.entity_type,
    entityName: r.entityName ?? r.entity_name,
    entityEmail: r.entityEmail ?? r.entity_email,
    entityPhone: r.entityPhone ?? r.entity_phone,
    entityId: r.entityId ?? r.entity_id,
    organizationName: r.organizationName ?? r.organization_name,
    address: r.address,
    city: r.city,
    state: r.state,
    pincode: r.pincode,
    website: r.website,
    registrationNumber: r.registrationNumber ?? r.registration_number,
    panNumber: r.panNumber ?? r.pan_number,
    gstNumber: r.gstNumber ?? r.gst_number,
    contactPerson: r.contactPerson ?? r.contact_person,
    contactDesignation: r.contactDesignation ?? r.contact_designation,
    description: r.description,
    documentsVerified: r.documentsVerified ?? r.documents_verified,
    kycVerified: r.kycVerified ?? r.kyc_verified,
    status: r.status,
    reviewNotes: r.reviewNotes ?? r.review_notes,
    rejectionReason: r.rejectionReason ?? r.rejection_reason,
    reviewedBy: r.reviewedBy ?? r.reviewed_by,
    reviewedAt: r.reviewedAt ?? r.reviewed_at,
    approvedAt: r.approvedAt ?? r.approved_at,
    submittedAt: r.submittedAt ?? r.submitted_at,
    createdAt: r.createdAt ?? r.created_at,
    userId: r.userId ?? r.user_id ?? null,
    applicantCode: r.applicantCode ?? r.applicant_code ?? null,
    mentorCode: r.mentorCode ?? r.mentor_code ?? null,
    mentorAgreementStatus: r.mentorAgreementStatus ?? r.mentor_agreement_status ?? null,
    mentorProfileStatus: r.mentorProfileStatus ?? r.mentor_profile_status ?? null,
  };
}

function rowToKyc(r: any) {
  return {
    id: r.id,
    onboardingId: r.onboardingId ?? r.onboarding_id,
    entityType: r.entityType ?? r.entity_type,
    entityName: r.entityName ?? r.entity_name,
    documentType: r.documentType ?? r.document_type,
    documentNumber: r.documentNumber ?? r.document_number,
    fileUrl: r.fileUrl ?? r.file_url,
    status: r.status,
    makerVerifiedBy: r.makerVerifiedBy ?? r.maker_verified_by,
    makerVerifiedAt: r.makerVerifiedAt ?? r.maker_verified_at,
    makerNotes: r.makerNotes ?? r.maker_notes,
    checkerVerifiedBy: r.checkerVerifiedBy ?? r.checker_verified_by,
    checkerVerifiedAt: r.checkerVerifiedAt ?? r.checker_verified_at,
    checkerNotes: r.checkerNotes ?? r.checker_notes,
    rejectionReason: r.rejectionReason ?? r.rejection_reason,
    createdAt: r.createdAt ?? r.created_at,
  };
}

// ── KYC document types per entity ─────────────────────────────────────────────
const KYC_DOCS: Record<string, string[]> = {
  institute: ['registration_certificate', 'pan_card', 'gst_certificate', 'address_proof', 'authorization_letter'],
  ngo:       ['registration_certificate', 'pan_card', '80g_certificate', 'address_proof', 'identity_proof'],
  mentor:    ['identity_proof', 'pan_card', 'qualification_certificate', 'bank_details', 'address_proof'],
  parent:    ['identity_proof', 'address_proof'],
  lei:       ['registration_certificate', 'pan_card', 'address_proof', 'authorization_letter'],
};

async function logHistory(
  onboardingId: string,
  action: string,
  performedBy: string | null,
  performedByName: string,
  notes: string,
  oldStatus: string,
  newStatus: string
) {
  await db.insert(onboardingHistoryTable).values({
    onboardingId,
    action,
    performedBy,
    performedByName,
    notes,
    oldStatus,
    newStatus,
  });
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC: POST /api/onboarding/register
// ═══════════════════════════════════════════════════════════════
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      entityType, entityName, entityEmail, entityPhone,
      organizationName, address, city, state, pincode, website,
      registrationNumber, panNumber, gstNumber,
      contactPerson, contactDesignation, description,
    } = req.body;

    if (!entityType || !entityName || !entityEmail) {
      return res.status(400).json({ error: 'entityType, entityName and entityEmail are required' });
    }
    if (!['institute', 'parent', 'mentor', 'ngo', 'lei'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Check for duplicate pending submission
    const dup = await db.select({ id: onboardingRequests.id })
      .from(onboardingRequests)
      .where(and(
        eq(onboardingRequests.entityEmail, entityEmail),
        eq(onboardingRequests.status, 'pending')
      ));
    if (dup.length) {
      return res.status(409).json({ error: 'A pending request already exists for this email' });
    }

    // For mentor-type applications, pre-assign a human-readable applicant code
    // Uses a raw sequence not in Drizzle schema
    let applicantCode: string | null = null;
    if (entityType === 'mentor') {
      const seqRes = await pool.query(`SELECT nextval('applicant_code_seq') AS n`);
      applicantCode = `MTX-APP-${String(seqRes.rows[0].n).padStart(4, '0')}`;
    }

    // applicant_code / user_id columns exist in DB but not in Drizzle schema, so use pool.query for insert
    const result = await pool.query(
      `INSERT INTO onboarding_requests
         (entity_type, entity_name, entity_email, entity_phone, organization_name,
          address, city, state, pincode, website, registration_number, pan_number,
          gst_number, contact_person, contact_designation, description, applicant_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [entityType, entityName, entityEmail, entityPhone || null, organizationName || null,
       address || null, city || null, state || null, pincode || null, website || null,
       registrationNumber || null, panNumber || null, gstNumber || null,
       contactPerson || null, contactDesignation || null, description || null,
       applicantCode]
    );
    const onboarding = result.rows[0];

    // Seed KYC document placeholders for the entity type
    const docTypes = KYC_DOCS[entityType] || [];
    if (docTypes.length) {
      await db.insert(kycDocuments).values(
        docTypes.map(docType => ({
          onboardingId: onboarding.id,
          entityType,
          entityName,
          documentType: docType,
        }))
      );
    }

    await logHistory(onboarding.id, 'submitted', null, entityName, 'Registration request submitted', '', 'pending');

    // Confirmation email to applicant
    try {
      await sendEmail({
        to: entityEmail,
        name: entityName,
        title: 'Your MetryxOne Registration is Under Review',
        message: `Thank you for registering with MetryxOne, ${entityName}!<br><br>
We have received your <strong>${entityType}</strong> onboarding request. Our team will review your submission and get back to you within 2-3 business days.${
  applicantCode ? `<br><br><strong>Your Application Reference ID: <code style="background:#f0f4ff;padding:2px 8px;border-radius:4px;font-size:1.05em;color:#344E86">${applicantCode}</code></strong><br>Please keep this ID for your records — it uniquely identifies your application and will transition to your Mentor ID upon approval.` : ''
}<br><br>
<strong>What's next?</strong><br>
• Our compliance team will verify your details<br>
• You may be asked to upload supporting documents (KYC)<br>
• Once approved, you will receive your access credentials${applicantCode ? ' and Mentor ID' : ''}<br><br>
If you have questions, reply to this email or contact us at <a href="mailto:support@metryxone.com">support@metryxone.com</a>.`,
      });
    } catch (e) {
      console.warn('[Onboarding] Email send failed (non-fatal):', (e as Error).message);
    }

    // Notify super admins (fire-and-forget — does not block response)
    db.select({ email: users.email, fullName: users.fullName })
      .from(users)
      .where(and(eq(users.role, 'super_admin'), eq(users.isActive, true)))
      .then(admins => {
        for (const admin of admins) {
          sendEmailAsync({
            to: admin.email!,
            name: admin.fullName!,
            title: `New Onboarding Request: ${entityName} (${entityType})`,
            message: `A new <strong>${entityType}</strong> onboarding request has been submitted.<br><br>
<strong>Name:</strong> ${entityName}<br>
<strong>Email:</strong> ${entityEmail}<br>
<strong>Phone:</strong> ${entityPhone || 'N/A'}<br>
<strong>Organization:</strong> ${organizationName || 'N/A'}<br>
<strong>City:</strong> ${city || 'N/A'}<br><br>
Please log in to the Super Admin panel to review and take action.`,
            actionUrl: 'https://metryxone.replit.app',
          });
        }
      })
      .catch(e => console.warn('[Onboarding] Admin notify failed (non-fatal):', (e as Error).message));

    res.status(201).json({ success: true, request: rowToRequest(onboarding) });
  } catch (err: any) {
    console.error('[POST /onboarding/register]', err.message);
    res.status(500).json({ error: 'Failed to submit registration' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC: GET /api/onboarding/status/:email
// ═══════════════════════════════════════════════════════════════
router.get('/status/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const result = await db.select({
      id: onboardingRequests.id,
      entityType: onboardingRequests.entityType,
      entityName: onboardingRequests.entityName,
      status: onboardingRequests.status,
      submittedAt: onboardingRequests.submittedAt,
      reviewNotes: onboardingRequests.reviewNotes,
      rejectionReason: onboardingRequests.rejectionReason,
    })
      .from(onboardingRequests)
      .where(eq(onboardingRequests.entityEmail, email))
      .orderBy(desc(onboardingRequests.submittedAt))
      .limit(1);
    if (!result.length) return res.status(404).json({ error: 'No request found' });
    res.json(rowToRequest(result[0]));
  } catch (err: any) {
    console.error('[GET /onboarding/status]', err.message);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN: GET /api/admin/onboarding
// ═══════════════════════════════════════════════════════════════
// Complex dynamic WHERE + JOIN with mentor_profiles (columns not in Drizzle schema) — keep as pool.query
export async function listOnboarding(req: Request, res: Response) {
  try {
    const { status = 'all', entityType = 'all', search = '' } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    let p = 1;

    if (status !== 'all') { conditions.push(`o.status = $${p++}`); params.push(status); }
    if (entityType !== 'all') { conditions.push(`o.entity_type = $${p++}`); params.push(entityType); }
    if (search) {
      conditions.push(`(o.entity_name ILIKE $${p} OR o.entity_email ILIKE $${p} OR o.organization_name ILIKE $${p})`);
      params.push(`%${search}%`); p++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT o.*, u.full_name AS reviewer_name,
              mp.mentor_code, mp.agreement_status AS mentor_agreement_status,
              mp.status AS mentor_profile_status
       FROM onboarding_requests o
       LEFT JOIN users u ON u.id = o.reviewed_by
       LEFT JOIN mentor_profiles mp ON mp.user_id = o.user_id AND o.entity_type = 'mentor'
       ${where}
       ORDER BY o.submitted_at DESC`,
      params
    );
    res.json(result.rows.map(rowToRequest));
  } catch (err: any) {
    console.error('[GET /admin/onboarding]', err.message);
    res.status(500).json({ error: 'Failed to fetch onboarding requests' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: GET /api/admin/onboarding-stats
// ═══════════════════════════════════════════════════════════════
export async function onboardingStats(req: Request, res: Response) {
  try {
    const [totals, byType, pendingByType] = await Promise.all([
      db.select({ status: onboardingRequests.status, count: count() })
        .from(onboardingRequests)
        .groupBy(onboardingRequests.status),
      db.select({ entityType: onboardingRequests.entityType, count: count() })
        .from(onboardingRequests)
        .groupBy(onboardingRequests.entityType),
      db.select({ entityType: onboardingRequests.entityType, count: count() })
        .from(onboardingRequests)
        .where(eq(onboardingRequests.status, 'pending'))
        .groupBy(onboardingRequests.entityType),
    ]);

    const statusMap: Record<string, number> = {};
    let total = 0;
    for (const row of totals) {
      statusMap[row.status] = row.count;
      total += row.count;
    }

    const byTypeMap: Record<string, number> = {};
    for (const row of byType) byTypeMap[row.entityType] = row.count;

    const pendingByTypeMap: Record<string, number> = {};
    for (const row of pendingByType) pendingByTypeMap[row.entityType] = row.count;

    res.json({
      total,
      pending: statusMap['pending'] || 0,
      under_review: statusMap['under_review'] || 0,
      approved: statusMap['approved'] || 0,
      rejected: statusMap['rejected'] || 0,
      suspended: statusMap['suspended'] || 0,
      byType: byTypeMap,
      pendingByType: pendingByTypeMap,
    });
  } catch (err: any) {
    console.error('[GET /admin/onboarding-stats]', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: GET /api/admin/onboarding/:id/history
// ═══════════════════════════════════════════════════════════════
export async function onboardingHistoryHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await db.select()
      .from(onboardingHistoryTable)
      .where(eq(onboardingHistoryTable.onboardingId, id))
      .orderBy(desc(onboardingHistoryTable.createdAt));
    res.json(result.map(r => ({
      id: r.id,
      action: r.action,
      performedByName: r.performedByName,
      notes: r.notes,
      oldStatus: r.oldStatus,
      newStatus: r.newStatus,
      createdAt: r.createdAt,
    })));
  } catch (err: any) {
    console.error('[GET /admin/onboarding/:id/history]', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}
// Re-export under original name for backwards compatibility
export { onboardingHistoryHandler as onboardingHistory };

// ═══════════════════════════════════════════════════════════════
// ── Generate a readable temporary password ────────────────────────────────────
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(10)).map(b => chars[b % chars.length]).join('') + '@1';
}

// ── Entity type → user role mapping ─────────────────────────────────────────
function entityTypeToRole(entityType: string): string {
  const map: Record<string, string> = {
    mentor: 'mentor',
    institute: 'institute',
    ngo: 'ngo',
    lei: 'lei',
    parent: 'parent',
  };
  return map[entityType] || 'user';
}

// ADMIN: POST /api/admin/onboarding/:id/approve
// ═══════════════════════════════════════════════════════════════
// Complex: uses sequences, mentor_profiles with columns not in Drizzle schema, user_id on onboarding_requests — keep as pool.query
export async function approveOnboarding(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reviewNotes = '' } = req.body;
    const admin = (req as any).user;

    const cur = await pool.query(`SELECT * FROM onboarding_requests WHERE id = $1`, [id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });
    const old = cur.rows[0];

    // ── 1. Create or retrieve a user account for the applicant ────────────────
    let userId: string | null = old.user_id || null;
    let tempPassword: string | null = null;
    let userCreated = false;

    if (!userId) {
      // Check if a user already exists with this email
      const existingUser = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.email, old.entity_email));
      if (existingUser.length) {
        userId = existingUser[0].id;
      } else {
        // Create a new user with a temporary password
        tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 12);
        const role = entityTypeToRole(old.entity_type);
        const newUser = await db.insert(users).values({
          fullName: old.entity_name,
          email: old.entity_email,
          username: old.entity_email,
          passwordHash,
          role,
          roles: JSON.stringify([role]),
          isActive: true,
          isVerified: true,
          metadata: JSON.stringify({ onboarding_id: id, entity_type: old.entity_type }),
        }).returning({ id: users.id });
        userId = newUser[0].id;
        userCreated = true;
      }
    }

    // ── 2. For mentors: create profile (pending_agreement) + generate code + send agreement ──
    // mentor_profiles columns (mentor_code, agreement_status, agreement_token, etc.) not in Drizzle schema — keep as pool.query
    let mentorCode: string | null = null;
    if (old.entity_type === 'mentor' && userId) {
      const agreementToken = crypto.randomBytes(32).toString('hex');
      const tokenExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Generate a new mentor code from the sequence
      const deriveMentorCode = async (): Promise<string> => {
        const seqNum = await pool.query(`SELECT nextval('mentor_code_seq') AS n`);
        return `MTX-M-${String(seqNum.rows[0].n).padStart(4, '0')}`;
      };

      const existingProfile = await pool.query(
        `SELECT id, mentor_code FROM mentor_profiles WHERE user_id = $1`,
        [userId]
      );

      if (existingProfile.rows.length) {
        // Already has a profile — generate new code if missing, reset to pending_agreement
        if (!existingProfile.rows[0].mentor_code) {
          mentorCode = await deriveMentorCode();
        } else {
          mentorCode = existingProfile.rows[0].mentor_code;
        }
        await pool.query(
          `UPDATE mentor_profiles
           SET status = 'pending_agreement',
               mentor_code = $1,
               agreement_status = 'sent',
               agreement_token = $2,
               agreement_token_expires_at = $3,
               agreement_sent_at = NOW(),
               updated_at = NOW()
           WHERE user_id = $4`,
          [mentorCode, agreementToken, tokenExpiry, userId]
        );
      } else {
        // Create a fresh profile with a unique mentor code
        mentorCode = await deriveMentorCode();
        await pool.query(
          `INSERT INTO mentor_profiles
           (user_id, display_name, phone, status, mentor_code, agreement_status,
            agreement_token, agreement_token_expires_at, agreement_sent_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending_agreement', $4, 'sent', $5, $6, NOW(), NOW(), NOW())`,
          [userId, old.entity_name, old.entity_phone || null, mentorCode, agreementToken, tokenExpiry]
        );
      }

      // Send legal agreement email
      const agreementUrl = `${process.env.CLIENT_ORIGIN || 'https://metryxone.replit.app'}/mentor-agreement/${mentorCode}/sign?token=${agreementToken}`;
      const mpRow = (await pool.query(`SELECT * FROM mentor_profiles WHERE mentor_code=$1`, [mentorCode])).rows[0];
      sendEmailAsync({
        to: old.entity_email,
        name: old.entity_name,
        title: 'MetryxOne Mentor Agreement — Action Required',
        message: buildAgreementEmail({ ...mpRow, full_name: old.entity_name, email: old.entity_email }, agreementUrl),
        actionUrl: agreementUrl,
      });
    }

    // ── 3. Approve the onboarding request + link the user ─────────────────────
    // user_id column not in Drizzle schema — keep as pool.query
    const result = await pool.query(
      `UPDATE onboarding_requests
       SET status='approved', review_notes=$1, reviewed_by=$2, reviewed_at=NOW(), approved_at=NOW(),
           updated_at=NOW(), user_id=$3
       WHERE id=$4 RETURNING *`,
      [reviewNotes, admin?.id || null, userId, id]
    );
    const updated = result.rows[0];

    await logHistory(id, 'approved', admin?.id, admin?.fullName || 'Admin', reviewNotes, old.status, 'approved');

    // ── 4. Send approval email (with credentials if a new account was created) ─
    try {
      const credBlock = userCreated && tempPassword
        ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;font-weight:600;">Your Login Credentials</p>
            <p style="margin:0 0 4px;">Email: <strong>${updated.entity_email}</strong></p>
            <p style="margin:0 0 4px;">Password: <strong>${tempPassword}</strong></p>
            <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Please log in and change your password immediately.</p>
           </div>`
        : '';

      await sendEmail({
        to: updated.entity_email,
        name: updated.entity_name,
        title: 'Your MetryxOne Registration has been Approved!',
        message: `Congratulations, <strong>${updated.entity_name}</strong>!<br><br>
Your <strong>${updated.entity_type}</strong> registration with MetryxOne has been <strong style="color:#16a34a;">approved</strong>.<br><br>
${reviewNotes ? `<strong>Notes from our team:</strong> ${reviewNotes}<br><br>` : ''}
${credBlock}
You can now log in to the platform and start using MetryxOne's features. If you need any help, contact us at <a href="mailto:support@metryxone.com">support@metryxone.com</a>.`,
        actionUrl: 'https://metryxone.replit.app/login',
      });
    } catch (e) {
      console.warn('[Onboarding] Approval email failed (non-fatal):', (e as Error).message);
    }

    res.json({
      success: true,
      request: { ...rowToRequest(updated), mentorCode: mentorCode || null, mentorAgreementStatus: old.entity_type === 'mentor' ? 'sent' : null },
      userCreated,
      userId,
      mentorCode: mentorCode || null,
    });
  } catch (err: any) {
    console.error('[POST /admin/onboarding/:id/approve]', err.message);
    res.status(500).json({ error: 'Failed to approve' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: POST /api/admin/onboarding/:id/reject
// ═══════════════════════════════════════════════════════════════
export async function rejectOnboarding(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { rejectionReason = '', reviewNotes = '' } = req.body;
    const admin = (req as any).user;

    const cur = await db.select()
      .from(onboardingRequests)
      .where(eq(onboardingRequests.id, id));
    if (!cur.length) return res.status(404).json({ error: 'Not found' });
    const old = cur[0];

    const result = await db.update(onboardingRequests)
      .set({
        status: 'rejected',
        rejectionReason,
        reviewNotes,
        reviewedBy: admin?.id || null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(onboardingRequests.id, id))
      .returning();
    const updated = result[0];

    await logHistory(id, 'rejected', admin?.id, admin?.fullName || 'Admin', rejectionReason || reviewNotes, old.status, 'rejected');

    // Send rejection email
    try {
      await sendEmail({
        to: updated.entityEmail,
        name: updated.entityName,
        title: 'Update on Your MetryxOne Registration',
        message: `Dear <strong>${updated.entityName}</strong>,<br><br>
After reviewing your <strong>${updated.entityType}</strong> registration request, we are unable to approve it at this time.<br><br>
${rejectionReason ? `<strong>Reason:</strong> ${rejectionReason}<br><br>` : ''}
If you believe this is an error or would like to provide additional information, please contact us at <a href="mailto:support@metryxone.com">support@metryxone.com</a>. You are welcome to reapply after addressing the concerns above.`,
      });
    } catch (e) {
      console.warn('[Onboarding] Rejection email failed (non-fatal):', (e as Error).message);
    }

    res.json({ success: true, request: rowToRequest(updated) });
  } catch (err: any) {
    console.error('[POST /admin/onboarding/:id/reject]', err.message);
    res.status(500).json({ error: 'Failed to reject' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: PATCH /api/admin/onboarding/:id/verify-documents
// ═══════════════════════════════════════════════════════════════
export async function verifyDocuments(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const admin = (req as any).user;

    const result = await db.update(onboardingRequests)
      .set({
        documentsVerified: !!verified,
        updatedAt: new Date(),
      })
      .where(eq(onboardingRequests.id, id))
      .returning();
    if (!result.length) return res.status(404).json({ error: 'Not found' });

    await logHistory(id, verified ? 'documents_verified' : 'documents_unverified',
      admin?.id, admin?.fullName || 'Admin', '', '', '');

    res.json({ success: true, documentsVerified: result[0].documentsVerified });
  } catch (err: any) {
    console.error('[PATCH /admin/onboarding/:id/verify-documents]', err.message);
    res.status(500).json({ error: 'Failed to update' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: PATCH /api/admin/onboarding/:id/verify-kyc
// ═══════════════════════════════════════════════════════════════
export async function verifyKyc(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const admin = (req as any).user;

    const result = await db.update(onboardingRequests)
      .set({
        kycVerified: !!verified,
        updatedAt: new Date(),
      })
      .where(eq(onboardingRequests.id, id))
      .returning();
    if (!result.length) return res.status(404).json({ error: 'Not found' });

    await logHistory(id, verified ? 'kyc_verified' : 'kyc_unverified',
      admin?.id, admin?.fullName || 'Admin', '', '', '');

    res.json({ success: true, kycVerified: result[0].kycVerified });
  } catch (err: any) {
    console.error('[PATCH /admin/onboarding/:id/verify-kyc]', err.message);
    res.status(500).json({ error: 'Failed to update' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: GET /api/admin/kyc
// ═══════════════════════════════════════════════════════════════
export async function listKyc(req: Request, res: Response) {
  try {
    const { status = 'all' } = req.query as Record<string, string>;

    const query = db.select().from(kycDocuments);
    const result = status !== 'all'
      ? await query.where(eq(kycDocuments.status, status)).orderBy(desc(kycDocuments.createdAt))
      : await query.orderBy(desc(kycDocuments.createdAt));

    res.json(result.map(rowToKyc));
  } catch (err: any) {
    console.error('[GET /admin/kyc]', err.message);
    res.status(500).json({ error: 'Failed to fetch KYC documents' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: POST /api/admin/kyc/:id/maker-verify
// ═══════════════════════════════════════════════════════════════
export async function makerVerifyKyc(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { notes = '' } = req.body;
    const admin = (req as any).user;

    const result = await db.update(kycDocuments)
      .set({
        status: 'maker_verified',
        makerVerifiedBy: admin?.id || null,
        makerVerifiedAt: new Date(),
        makerNotes: notes,
        updatedAt: new Date(),
      })
      .where(and(eq(kycDocuments.id, id), eq(kycDocuments.status, 'pending')))
      .returning();
    if (!result.length) return res.status(404).json({ error: 'Document not found or already verified' });

    res.json({ success: true, kyc: rowToKyc(result[0]) });
  } catch (err: any) {
    console.error('[POST /admin/kyc/:id/maker-verify]', err.message);
    res.status(500).json({ error: 'Failed to maker-verify' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: POST /api/admin/kyc/:id/checker-verify
// ═══════════════════════════════════════════════════════════════
export async function checkerVerifyKyc(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { notes = '' } = req.body;
    const admin = (req as any).user;

    const doc = await db.select()
      .from(kycDocuments)
      .where(eq(kycDocuments.id, id));
    if (!doc.length) return res.status(404).json({ error: 'Not found' });
    if (doc[0].status !== 'maker_verified') {
      return res.status(400).json({ error: 'Document must be maker-verified first' });
    }
    if (doc[0].makerVerifiedBy === admin?.id) {
      return res.status(400).json({ error: 'Checker must be different from maker' });
    }

    const result = await db.update(kycDocuments)
      .set({
        status: 'approved',
        checkerVerifiedBy: admin?.id || null,
        checkerVerifiedAt: new Date(),
        checkerNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(kycDocuments.id, id))
      .returning();

    // If all KYC docs for this onboarding are approved, mark kyc_verified
    const onboardingId = result[0].onboardingId;
    const pending = await db.select({ count: count() })
      .from(kycDocuments)
      .where(and(
        eq(kycDocuments.onboardingId, onboardingId),
        ne(kycDocuments.status, 'approved')
      ));
    if (pending[0].count === 0) {
      await db.update(onboardingRequests)
        .set({ kycVerified: true, updatedAt: new Date() })
        .where(eq(onboardingRequests.id, onboardingId));
    }

    res.json({ success: true, kyc: rowToKyc(result[0]) });
  } catch (err: any) {
    console.error('[POST /admin/kyc/:id/checker-verify]', err.message);
    res.status(500).json({ error: 'Failed to checker-verify' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: POST /api/admin/kyc/:id/reject
// ═══════════════════════════════════════════════════════════════
export async function rejectKyc(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;
    const admin = (req as any).user;

    const result = await db.update(kycDocuments)
      .set({
        status: 'rejected',
        rejectedBy: admin?.id || null,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(kycDocuments.id, id))
      .returning();
    if (!result.length) return res.status(404).json({ error: 'Not found' });

    res.json({ success: true, kyc: rowToKyc(result[0]) });
  } catch (err: any) {
    console.error('[POST /admin/kyc/:id/reject]', err.message);
    res.status(500).json({ error: 'Failed to reject KYC' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN: GET /api/admin/student-enrollments
// ═══════════════════════════════════════════════════════════════
export async function listStudentEnrollments(req: Request, res: Response) {
  try {
    const { paymentStatus = 'all' } = req.query as Record<string, string>;

    const conditions = [];
    if (paymentStatus !== 'all') {
      conditions.push(eq(studentEnrollments.paymentStatus, paymentStatus));
    }

    const rows = await db
      .select({
        id: studentEnrollments.id,
        studentName: studentEnrollments.studentName,
        studentEmail: studentEnrollments.studentEmail,
        studentPhone: studentEnrollments.studentPhone,
        parentName: studentEnrollments.parentName,
        parentEmail: studentEnrollments.parentEmail,
        instituteName: studentEnrollments.instituteName,
        grade: studentEnrollments.grade,
        board: studentEnrollments.board,
        enrollmentDate: studentEnrollments.enrollmentDate,
        paymentStatus: studentEnrollments.paymentStatus,
        planType: studentEnrollments.planType,
        amount: studentEnrollments.amount,
        notes: studentEnrollments.notes,
        createdAt: studentEnrollments.createdAt,
        userEmail: users.email,
      })
      .from(studentEnrollments)
      .leftJoin(users, eq(users.id, studentEnrollments.userId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(studentEnrollments.enrollmentDate));

    res.json(rowsToSnake(rows));
  } catch (err: any) {
    console.error('[GET /admin/student-enrollments]', err.message);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
}

export default router;
