export interface SimpleEmailPayload {
  to: string | null;
  subject: string;
  html: string;
}

export async function sendEmail(payload: SimpleEmailPayload): Promise<void> {
  if (!payload.to) {
    console.warn('[Email] No recipient address — skipping');
    return;
  }
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

  const info = await transporter.sendMail({
    from: `"${fromName}" <${smtpUser}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  console.log(`[Email] Sent to ${payload.to}, messageId=${info.messageId}`);
}
