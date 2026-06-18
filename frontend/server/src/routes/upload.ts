import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/drizzle.js';
import { onboardingRequests, documentUploadTokens, kycDocuments, onboardingHistory } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { sendEmailAsync } from '../notifications/delivery/email.js';

const router = Router();

const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomBytes(16).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only PDF, JPG, PNG, DOC, DOCX files are allowed'));
  },
});

function getAppUrl(req: Request): string {
  if (process.env.APP_DOMAIN) return `https://${process.env.APP_DOMAIN}`;
  const host = req.get('host') || '';
  if (host.includes('replit.dev') || host.includes('replit.app')) {
    return `https://${process.env.REPLIT_DEV_DOMAIN || host}`;
  }
  return `https://${host}`;
}

// ─── POST /api/admin/onboarding/:id/request-documents ────────────────────────
// Admin: generate a secure upload token and email the link to the applicant
router.post('/:id/request-documents', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { requestedDocs, customMessage } = req.body as {
    requestedDocs: string[];
    customMessage?: string;
  };

  if (!Array.isArray(requestedDocs) || requestedDocs.length === 0) {
    res.status(400).json({ message: 'Select at least one document type to request' });
    return;
  }

  try {
    const [onboarding] = await db
      .select({
        id: onboardingRequests.id,
        entityName: onboardingRequests.entityName,
        entityEmail: onboardingRequests.entityEmail,
        entityType: onboardingRequests.entityType,
      })
      .from(onboardingRequests)
      .where(eq(onboardingRequests.id, id));

    if (!onboarding) {
      res.status(404).json({ message: 'Onboarding request not found' });
      return;
    }

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(documentUploadTokens).values({
      onboardingId: id,
      token,
      requestedDocs: requestedDocs,
      customMessage: customMessage || null,
      expiresAt,
    });

    const uploadUrl = `${getAppUrl(req)}/upload/${id}/documents?token=${token}`;

    const docLabels: Record<string, string> = {
      registration_certificate: 'Registration Certificate',
      pan_card: 'PAN Card',
      gst_certificate: 'GST Certificate',
      address_proof: 'Address Proof',
      identity_proof: 'Identity Proof (Aadhaar/Passport)',
      authorization_letter: 'Authorization Letter',
      bank_details: 'Bank Account Details',
      qualification_certificate: 'Qualification Certificate',
      experience_letter: 'Experience Letter',
      police_clearance: 'Police Clearance Certificate',
      ngo_registration: 'NGO Registration Certificate',
      fcra_certificate: 'FCRA Certificate',
    };

    const docList = requestedDocs
      .map((d, i) => `${i + 1}. ${docLabels[d] || d.replace(/_/g, ' ')}`)
      .join('\n');

    await sendEmailAsync({
      to: onboarding.entityEmail,
      subject: `Action Required: Upload Documents for MetryxOne Onboarding`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <img src="https://metryx.app/logo.png" alt="MetryxOne" style="height:40px;margin-bottom:24px" />
          <h2 style="color:#344E86;margin-bottom:8px">Document Submission Required</h2>
          <p style="color:#374151">Dear <strong>${onboarding.entityName}</strong>,</p>
          <p style="color:#374151">
            As part of your MetryxOne onboarding, we require the following documents:
          </p>
          <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0">
            ${requestedDocs.map(d => `<p style="margin:4px 0;color:#374151">✅ ${docLabels[d] || d.replace(/_/g, ' ')}</p>`).join('')}
          </div>
          ${customMessage ? `<p style="color:#374151;font-style:italic">"${customMessage}"</p>` : ''}
          <a href="${uploadUrl}"
             style="display:inline-block;background:#344E86;color:#fff;text-decoration:none;
                    padding:12px 28px;border-radius:8px;font-weight:600;margin:16px 0">
            Upload Documents
          </a>
          <p style="color:#9AA4B2;font-size:13px;margin-top:16px">
            This link expires on ${expiresAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}.<br>
            If you have any queries, contact us at support@metryx.app
          </p>
        </div>
      `,
    });

    await db.insert(onboardingHistory).values({
      onboardingId: id,
      action: 'documents_requested',
      performedByName: (req as any).user?.full_name || 'Admin',
      notes: `Requested: ${requestedDocs.join(', ')}`,
    });

    res.json({ success: true, uploadUrl, expiresAt, message: `Upload link sent to ${onboarding.entityEmail}` });
  } catch (err: any) {
    console.error('[POST /request-documents]', err?.message);
    res.status(500).json({ message: 'Failed to send document request' });
  }
});

// ─── GET /api/upload/:id/info?token=<token> ──────────────────────────────────
// Public: validate token and return request details so the upload page can render
router.get('/:id/info', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { token } = req.query as { token: string };

  if (!token) {
    res.status(400).json({ message: 'Upload token is required' });
    return;
  }

  try {
    const [row] = await db
      .select({
        // token fields
        tokenId: documentUploadTokens.id,
        requestedDocs: documentUploadTokens.requestedDocs,
        customMessage: documentUploadTokens.customMessage,
        expiresAt: documentUploadTokens.expiresAt,
        usedAt: documentUploadTokens.usedAt,
        // onboarding fields
        entityName: onboardingRequests.entityName,
        entityEmail: onboardingRequests.entityEmail,
        entityType: onboardingRequests.entityType,
        onboardingStatus: onboardingRequests.status,
      })
      .from(documentUploadTokens)
      .innerJoin(onboardingRequests, eq(onboardingRequests.id, documentUploadTokens.onboardingId))
      .where(
        and(
          eq(documentUploadTokens.onboardingId, id),
          eq(documentUploadTokens.token, token),
        )
      );

    if (!row) {
      res.status(404).json({ message: 'Invalid or expired upload link' });
      return;
    }

    if (new Date(row.expiresAt) < new Date()) {
      res.status(410).json({ message: 'This upload link has expired. Please contact your MetryxOne representative.' });
      return;
    }

    const existingDocs = await db
      .select({
        documentType: kycDocuments.documentType,
        status: kycDocuments.status,
        fileUrl: kycDocuments.fileUrl,
        createdAt: kycDocuments.createdAt,
      })
      .from(kycDocuments)
      .where(eq(kycDocuments.onboardingId, id));

    res.json({
      onboardingId: id,
      entityName: row.entityName,
      entityEmail: row.entityEmail,
      entityType: row.entityType,
      requestedDocs: row.requestedDocs,
      customMessage: row.customMessage,
      expiresAt: row.expiresAt,
      uploadedDocs: existingDocs,
    });
  } catch (err: any) {
    console.error('[GET /upload/info]', err?.message);
    res.status(500).json({ message: 'Failed to validate upload link' });
  }
});

// ─── POST /api/upload/:id/documents?token=<token> ────────────────────────────
// Public: accept file uploads from the applicant
router.post(
  '/:id/documents',
  upload.array('files', 15),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { token } = req.query as { token: string };

    if (!token) {
      res.status(400).json({ message: 'Upload token is required' });
      return;
    }

    try {
      const [tokenRow] = await db
        .select()
        .from(documentUploadTokens)
        .where(
          and(
            eq(documentUploadTokens.onboardingId, id),
            eq(documentUploadTokens.token, token),
          )
        );

      if (!tokenRow) {
        res.status(401).json({ message: 'Invalid upload token' });
        return;
      }

      if (new Date(tokenRow.expiresAt) < new Date()) {
        res.status(410).json({ message: 'This upload link has expired' });
        return;
      }

      const [onboarding] = await db
        .select({
          entityName: onboardingRequests.entityName,
          entityType: onboardingRequests.entityType,
        })
        .from(onboardingRequests)
        .where(eq(onboardingRequests.id, id));

      const files = req.files as Express.Multer.File[];
      const documentTypes: string[] = Array.isArray(req.body.documentTypes)
        ? req.body.documentTypes
        : [req.body.documentTypes];

      if (!files || files.length === 0) {
        res.status(400).json({ message: 'No files uploaded' });
        return;
      }

      const inserted: string[] = [];
      const backendBase = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8000}`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docType = documentTypes[i] || 'unknown';
        const fileUrl = `${backendBase}/files/${file.filename}`;

        await db
          .insert(kycDocuments)
          .values({
            onboardingId: id,
            entityType: onboarding?.entityType || 'unknown',
            entityName: onboarding?.entityName || '',
            documentType: docType,
            fileUrl,
            status: 'pending',
          })
          .onConflictDoNothing();

        inserted.push(docType);
      }

      // Mark token as used
      await db
        .update(documentUploadTokens)
        .set({ usedAt: new Date() })
        .where(eq(documentUploadTokens.id, tokenRow.id));

      await db.insert(onboardingHistory).values({
        onboardingId: id,
        action: 'documents_uploaded',
        performedByName: onboarding?.entityName || 'Applicant',
        notes: `Uploaded: ${inserted.join(', ')}`,
      });

      res.json({ success: true, uploaded: inserted, message: 'Documents uploaded successfully' });
    } catch (err: any) {
      console.error('[POST /upload/documents]', err?.message);
      res.status(500).json({ message: 'Upload failed. Please try again.' });
    }
  }
);

export default router;
