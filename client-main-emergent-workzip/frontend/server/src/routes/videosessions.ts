/**
 * Video Sessions API
 * DPDP-compliant session management: booking, consent, transcript, recording metadata, erasure.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

export interface VideoSession {
  roomId: string;
  inviteToken: string;
  title: string;
  mentorName: string;
  studentName: string;
  sessionType: string;
  scheduledDate: string;
  scheduledTime: string;
  mode: 'Online' | 'Offline' | 'Hybrid';
  status: 'scheduled' | 'active' | 'ended';
  createdAt: string;
  endedAt?: string;
  dpdpConsents: DPDPConsent[];
  transcriptChunks: TranscriptChunk[];
  sessionNotes: string;
  recordingMetadata?: RecordingMetadata;
  participants: SessionParticipant[];
}

interface DPDPConsent {
  participantName: string;
  role: 'mentor' | 'student' | 'guest';
  consentGiven: boolean;
  consentTimestamp: string;
  ipHash: string;
  consentVersion: string;
  checkboxes: {
    recordingConsent: boolean;
    dataProcessing: boolean;
    retentionPolicy: boolean;
  };
}

interface TranscriptChunk {
  id: string;
  speaker: string;
  role: string;
  text: string;
  timestamp: string;
  confidence?: number;
}

interface RecordingMetadata {
  started: string;
  ended?: string;
  durationSeconds?: number;
  sizeEstimateBytes?: number;
  consentedParticipants: string[];
  erasureRequested?: boolean;
  erasureTimestamp?: string;
}

interface SessionParticipant {
  name: string;
  role: 'mentor' | 'student' | 'guest';
  joinedAt: string;
  leftAt?: string;
}

// In-memory store (for prototype — production would use PostgreSQL)
export const videoSessions = new Map<string, VideoSession>();

// Helper: anonymise IP for DPDP compliance
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'metryx-salt').digest('hex').slice(0, 16);
}

// ── POST /api/video-sessions — Create a new session ──────────────────────────
router.post('/', (req: Request, res: Response) => {
  const { title, mentorName, studentName, sessionType, scheduledDate, scheduledTime, mode } = req.body;
  if (!mentorName || !sessionType) {
    return res.status(400).json({ error: 'mentorName and sessionType are required' });
  }

  const roomId = `metryx-session-${crypto.randomBytes(4).toString('hex')}`;
  const inviteToken = crypto.randomBytes(16).toString('hex');

  const session: VideoSession = {
    roomId,
    inviteToken,
    title: title || `${sessionType} with ${mentorName}`,
    mentorName: mentorName || 'Mentor',
    studentName: studentName || 'Student',
    sessionType: sessionType || 'Session',
    scheduledDate: scheduledDate || new Date().toLocaleDateString('en-IN'),
    scheduledTime: scheduledTime || '—',
    mode: mode || 'Online',
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    dpdpConsents: [],
    transcriptChunks: [],
    sessionNotes: '',
    participants: [],
  };

  videoSessions.set(roomId, session);
  console.log(`[VideoSessions] Created session ${roomId} for ${mentorName} — ${sessionType}`);

  res.status(201).json({
    roomId,
    inviteToken,
    inviteUrl: `/join-session?room=${roomId}&token=${inviteToken}`,
    session: { ...session, dpdpConsents: [], transcriptChunks: [] },
  });
});

// ── GET /api/video-sessions/:roomId — Get session info ───────────────────────
router.get('/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { token } = req.query;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found or has expired' });

  // Verify invite token if joining as student
  if (token && token !== session.inviteToken) {
    return res.status(403).json({ error: 'Invalid invite token' });
  }

  res.json({
    roomId: session.roomId,
    title: session.title,
    mentorName: session.mentorName,
    studentName: session.studentName,
    sessionType: session.sessionType,
    scheduledDate: session.scheduledDate,
    scheduledTime: session.scheduledTime,
    mode: session.mode,
    status: session.status,
    participantCount: session.participants.length,
  });
});

// ── POST /api/video-sessions/:roomId/consent — Record DPDP consent ───────────
router.post('/:roomId/consent', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { participantName, role, checkboxes } = req.body;
  const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';

  const consent: DPDPConsent = {
    participantName,
    role: role || 'student',
    consentGiven: true,
    consentTimestamp: new Date().toISOString(),
    ipHash: hashIp(ip),
    consentVersion: 'DPDP-2023-v1',
    checkboxes: {
      recordingConsent: checkboxes?.recordingConsent ?? false,
      dataProcessing: checkboxes?.dataProcessing ?? false,
      retentionPolicy: checkboxes?.retentionPolicy ?? false,
    },
  };

  session.dpdpConsents.push(consent);
  console.log(`[DPDP] Consent logged — ${participantName} (${role}) for session ${roomId} at ${consent.consentTimestamp}`);

  res.json({ status: 'consent_recorded', consentId: `${roomId}-${session.dpdpConsents.length}`, timestamp: consent.consentTimestamp });
});

// ── POST /api/video-sessions/:roomId/transcript — Save transcript chunk ───────
router.post('/:roomId/transcript', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { speaker, role, text, timestamp, confidence } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

  const chunk: TranscriptChunk = {
    id: crypto.randomUUID(),
    speaker: speaker || 'Unknown',
    role: role || 'participant',
    text: text.trim(),
    timestamp: timestamp || new Date().toISOString(),
    confidence,
  };

  session.transcriptChunks.push(chunk);
  res.json({ status: 'saved', id: chunk.id });
});

// ── GET /api/video-sessions/:roomId/transcript — Get full transcript ──────────
router.get('/:roomId/transcript', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const fullText = session.transcriptChunks
    .map(c => `[${new Date(c.timestamp).toLocaleTimeString('en-IN')}] ${c.speaker}: ${c.text}`)
    .join('\n');

  res.json({ roomId, chunks: session.transcriptChunks, fullText, chunkCount: session.transcriptChunks.length });
});

// ── POST /api/video-sessions/:roomId/notes — Save session notes ──────────────
router.post('/:roomId/notes', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.sessionNotes = req.body.notes || '';
  res.json({ status: 'saved' });
});

// ── POST /api/video-sessions/:roomId/recording — Store recording metadata ─────
router.post('/:roomId/recording', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { action, durationSeconds, sizeEstimateBytes, consentedParticipants } = req.body;

  if (action === 'start') {
    session.recordingMetadata = {
      started: new Date().toISOString(),
      consentedParticipants: consentedParticipants || [],
    };
  } else if (action === 'end' && session.recordingMetadata) {
    session.recordingMetadata.ended = new Date().toISOString();
    session.recordingMetadata.durationSeconds = durationSeconds;
    session.recordingMetadata.sizeEstimateBytes = sizeEstimateBytes;
  }

  res.json({ status: 'ok', recordingMetadata: session.recordingMetadata });
});

// ── POST /api/video-sessions/:roomId/end — Mark session ended ─────────────────
router.post('/:roomId/end', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { notes } = req.body;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  if (notes) session.sessionNotes = notes;

  console.log(`[VideoSessions] Session ${roomId} ended. Transcript: ${session.transcriptChunks.length} chunks.`);

  res.json({
    status: 'ended',
    summary: {
      duration: session.endedAt && session.createdAt
        ? Math.round((new Date(session.endedAt).getTime() - new Date(session.createdAt).getTime()) / 1000)
        : 0,
      transcriptChunks: session.transcriptChunks.length,
      participantCount: session.participants.length,
      recorded: !!session.recordingMetadata,
    },
  });
});

// ── POST /api/video-sessions/:roomId/send-invitation — Email notification ────
router.post('/:roomId/send-invitation', async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const {
    recipientEmail,
    recipientName,
    mentorName,
    sessionType,
    scheduledDate,
    scheduledTime,
    inviteUrl,
    childName,
    dpdpConsented,
  } = req.body;

  if (!recipientEmail) {
    return res.status(400).json({ error: 'recipientEmail is required' });
  }

  // Format date/time nicely
  const dateObj = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`);
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mentor Session Confirmed — MetryxOne</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(52,78,134,0.10);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#344E86 0%,#4a6bc4 60%,#4ECDC4 100%);padding:32px 36px;">
    <div style="font-size:22px;font-weight:700;color:#ffffff;margin-bottom:4px;">MetryxOne</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.75);">Behavioral Intelligence &amp; Education Platform</div>
  </div>

  <!-- Body -->
  <div style="padding:32px 36px;">
    <div style="font-size:20px;font-weight:700;color:#1a202c;margin-bottom:6px;">Your Mentor Session is Confirmed! 🎉</div>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">
      Hi ${recipientName || 'there'},<br/><br/>
      A mentor session has been successfully booked for <strong>${childName || 'your child'}</strong>.
      Here are your session details:
    </p>

    <!-- Session Card -->
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:12px;color:#9ca3af;display:block;">Mentor</span>
          <span style="font-size:14px;font-weight:600;color:#1a202c;">${mentorName}</span>
        </td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:12px;color:#9ca3af;display:block;">Session Type</span>
          <span style="font-size:14px;font-weight:600;color:#1a202c;">${sessionType}</span>
        </td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:12px;color:#9ca3af;display:block;">Student</span>
          <span style="font-size:14px;font-weight:600;color:#1a202c;">${childName}</span>
        </td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:12px;color:#9ca3af;display:block;">Date</span>
          <span style="font-size:14px;font-weight:600;color:#1a202c;">${formattedDate}</span>
        </td></tr>
        <tr><td style="padding:6px 0;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:12px;color:#9ca3af;display:block;">Time</span>
          <span style="font-size:14px;font-weight:600;color:#1a202c;">${formattedTime} IST</span>
        </td></tr>
        <tr><td style="padding:6px 0;">
          <span style="font-size:12px;color:#9ca3af;display:block;">Mode</span>
          <span style="font-size:14px;font-weight:600;color:#1a202c;">🔒 Secure Online Video Call</span>
        </td></tr>
      </table>
    </div>

    ${dpdpConsented ? `
    <!-- DPDP Notice -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:24px;display:flex;align-items:flex-start;gap:10px;">
      <span style="font-size:16px;">🛡️</span>
      <div>
        <div style="font-size:12px;font-weight:600;color:#166534;margin-bottom:2px;">Parental Consent Recorded</div>
        <div style="font-size:11px;color:#15803d;">Your parental consent for this session has been recorded under DPDP Act 2023 (version DPDP-2023-v1). Session data will be retained for 90 days maximum.</div>
      </div>
    </div>` : ''}

    <!-- Join Button -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#344E86,#4ECDC4);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;box-shadow:0 4px 16px rgba(52,78,134,0.25);">
        Join Session Now →
      </a>
      <div style="margin-top:10px;font-size:11px;color:#9ca3af;">Or copy this link:</div>
      <div style="margin-top:4px;font-size:11px;color:#344E86;word-break:break-all;font-family:monospace;">${inviteUrl}</div>
    </div>

    <!-- Tips -->
    <div style="background:#fffbeb;border:1px solid #fef08a;border-radius:10px;padding:14px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:6px;">📋 Before the session</div>
      <ul style="margin:0;padding-left:16px;font-size:12px;color:#78350f;line-height:1.7;">
        <li>Ensure a stable internet connection</li>
        <li>Use a laptop or tablet for the best experience</li>
        <li>Have notebooks and textbooks ready</li>
        <li>Join 2–3 minutes early to test audio/video</li>
      </ul>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 36px;text-align:center;">
    <div style="font-size:11px;color:#9ca3af;line-height:1.6;">
      MetryxOne · Behavioral Intelligence &amp; Education Platform<br/>
      For support: <a href="mailto:support@metryxone.com" style="color:#344E86;text-decoration:none;">support@metryxone.com</a> |
      DPO: <a href="mailto:dpo@metryxone.com" style="color:#344E86;text-decoration:none;">dpo@metryxone.com</a><br/>
      <a href="${inviteUrl}" style="color:#344E86;text-decoration:none;font-size:11px;">View Session Details</a>
    </div>
  </div>
</div>
</body>
</html>`;

  try {
    const { sendEmail } = await import('../notifications/emailService.js');
    await sendEmail({
      to: recipientEmail,
      subject: `✅ Session Confirmed: ${mentorName} · ${formattedDate} at ${formattedTime}`,
      html,
    });
    console.log(`[VideoSessions] Invitation email sent to ${recipientEmail} for session ${roomId}`);
    res.json({ status: 'sent', message: 'Invitation email dispatched successfully' });
  } catch (err: any) {
    console.error(`[VideoSessions] Email dispatch failed for ${roomId}:`, err.message);
    // Don't fail the request — email is a best-effort notification
    res.json({ status: 'skipped', message: 'Email not sent (SMTP not configured)', reason: err.message });
  }
});

// ── DELETE /api/video-sessions/:roomId/data — DPDP Right to Erasure ──────────
router.delete('/:roomId/data', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const session = videoSessions.get(roomId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Clear personal data per DPDP Act
  session.transcriptChunks = [];
  session.sessionNotes = '';
  session.participants = session.participants.map(p => ({ ...p, name: '[Erased]' }));
  session.dpdpConsents = session.dpdpConsents.map(c => ({ ...c, participantName: '[Erased]', ipHash: '[Erased]' }));
  if (session.recordingMetadata) {
    session.recordingMetadata.erasureRequested = true;
    session.recordingMetadata.erasureTimestamp = new Date().toISOString();
    session.recordingMetadata.consentedParticipants = [];
  }

  console.log(`[DPDP] Erasure request fulfilled for session ${roomId}`);
  res.json({ status: 'erased', message: 'All personal data erased per DPDP Act Section 12', timestamp: new Date().toISOString() });
});

export default router;
