import { Router, Request, Response } from 'express';
import { pool } from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

function calcIsMinor(dob: string | null): boolean {
  if (!dob) return true;
  const birth = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear() -
    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  return age < 18;
}

// These routes use columns (enrollment_id, date_of_birth, consent_given, submitted_by on enrollment_kyc)
// that are not in the main migration schema. Keeping pool.query for compatibility.
router.get('/admin/enrollment-kyc', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        se.id,
        se.student_name,
        se.student_email,
        se.student_phone,
        se.parent_name,
        se.parent_email,
        se.institute_name,
        se.grade,
        se.date_of_birth,
        se.consent_given,
        se.consent_given_at,
        se.consent_given_by,
        se.enrollment_date,
        se.payment_status,
        COALESCE(json_agg(
          json_build_object(
            'id', ek.id,
            'documentType', ek.document_type,
            'submittedBy', ek.submitted_by,
            'fileUrl', ek.file_url,
            'documentNumber', ek.document_number,
            'status', ek.status,
            'verifiedAt', ek.verified_at,
            'notes', ek.notes,
            'rejectionReason', ek.rejection_reason,
            'createdAt', ek.created_at
          ) ORDER BY ek.created_at DESC
        ) FILTER (WHERE ek.id IS NOT NULL), '[]') AS kyc_docs
      FROM student_enrollments se
      LEFT JOIN enrollment_kyc ek ON ek.enrollment_id = se.id
      GROUP BY se.id
      ORDER BY se.created_at DESC
    `);

    const result = rows.map(r => ({
      ...r,
      isMinor: calcIsMinor(r.date_of_birth),
    }));

    res.json(result);
  } catch (err: any) {
    console.error('[GET /admin/enrollment-kyc]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/admin/enrollment-kyc/doc/:docId/verify', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const { action, notes } = req.body;
    const adminId = (req as any).user?.id;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }

    const { rows } = await pool.query(
      `UPDATE enrollment_kyc
       SET status = $1, verified_by = $2, verified_at = NOW(), notes = $3, updated_at = NOW()
       RETURNING *`,
      [action === 'approve' ? 'verified' : 'rejected', adminId, notes || null]
    );

    if (!rows.length) return res.status(404).json({ message: 'Document not found' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('[PATCH /admin/enrollment-kyc/doc/:id/verify]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/admin/enrollment/:enrollmentId/consent', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enrollmentId } = req.params;
    const { consentGiven, consentGivenBy } = req.body;

    const { rows } = await pool.query(
      `UPDATE student_enrollments
       SET consent_given = $1, consent_given_at = CASE WHEN $1 THEN NOW() ELSE NULL END, consent_given_by = $2
       WHERE id = $3
       RETURNING id, consent_given, consent_given_at, consent_given_by`,
      [consentGiven, consentGivenBy || null, enrollmentId]
    );

    if (!rows.length) return res.status(404).json({ message: 'Enrollment not found' });
    res.json(rows[0]);
  } catch (err: any) {
    console.error('[PATCH /admin/enrollment/:id/consent]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/admin/enrollment/:enrollmentId/dob', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { enrollmentId } = req.params;
    const { dateOfBirth } = req.body;

    const { rows } = await pool.query(
      `UPDATE student_enrollments SET date_of_birth = $1 WHERE id = $2
       RETURNING id, date_of_birth`,
      [dateOfBirth, enrollmentId]
    );

    if (!rows.length) return res.status(404).json({ message: 'Enrollment not found' });
    res.json({ ...rows[0], isMinor: calcIsMinor(rows[0].date_of_birth) });
  } catch (err: any) {
    console.error('[PATCH /admin/enrollment/:id/dob]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
