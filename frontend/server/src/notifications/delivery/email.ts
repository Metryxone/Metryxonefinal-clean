interface EmailPayload {
  to: string;
  name?: string;
  title?: string;
  message?: string;
  actionUrl?: string | null;
  subject?: string;
  html?: string;
}

function buildHtml(payload: EmailPayload): string {
  const actionButton = payload.actionUrl
    ? `<a href="${payload.actionUrl}"
         style="display:inline-block;margin-top:16px;padding:10px 20px;
                background:#344E86;color:#fff;border-radius:6px;
                text-decoration:none;font-weight:600;">
         View Details
       </a>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;background:#f4f4f5;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#344E86;padding:24px 32px;">
      <span style="color:#fff;font-size:20px;font-weight:700;">MetryxOne</span>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;color:#111;">${payload.title}</h2>
      <p style="color:#555;line-height:1.6;margin:0;">${payload.message}</p>
      ${actionButton}
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #eee;">
      <p style="margin:0;font-size:12px;color:#999;">
        You received this because you have notifications enabled on MetryxOne.
        <a href="#" style="color:#344E86;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromName = process.env.EMAIL_FROM_NAME ?? 'MetryxOne';

  if (!smtpUser || !smtpPass) {
    console.warn('[Email] SMTP_USER/SMTP_PASS not set — skipping email delivery');
    return;
  }

  const { createTransport } = await import('nodemailer');
  const transporter = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  const emailSubject = payload.subject ?? payload.title ?? 'MetryxOne Notification';
  const emailHtml = payload.html ?? buildHtml(payload);

  const info = await transporter.sendMail({
    from: `"${fromName}" <${smtpUser}>`,
    to: payload.to,
    subject: emailSubject,
    html: emailHtml,
  });

  console.log(`[Email] Sent to ${payload.to}, messageId=${info.messageId}`);
}

export function sendEmailAsync(payload: EmailPayload): void {
  setImmediate(() => {
    sendEmail(payload).catch(err =>
      console.warn('[Email] Async send failed (non-fatal):', err.message)
    );
  });
}
