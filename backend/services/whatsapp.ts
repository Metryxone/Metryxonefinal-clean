/**
 * /backend/services/whatsapp.ts
 * WhatsApp notification service for CAPADEX payment events.
 *
 * Supports two modes:
 *   1. WATI (wa.me business API) — set WATI_API_ENDPOINT + WATI_API_TOKEN
 *   2. Plain wa.me link logged to console — fallback when no credentials
 *
 * Configure via environment variables:
 *   WATI_API_ENDPOINT   — e.g. https://live-server-xxxxx.wati.io
 *   WATI_API_TOKEN      — WATI Bearer token
 *   ADMIN_WHATSAPP_NUMBER — admin phone in international format (e.g. 919876543210)
 */

export type WhatsAppNotificationType =
  | 'payment_confirmed_user'
  | 'payment_confirmed_admin';

interface WhatsAppPayload {
  name?:        string;
  email?:       string;
  stageName?:   string;
  concernName?: string;
  amountRupees?: number;
  paymentId?:   string;
  phone?:       string | null;
}

interface SendWhatsAppOptions {
  to:      string;
  type:    WhatsAppNotificationType;
  payload: WhatsAppPayload;
}

function buildMessage(type: WhatsAppNotificationType, payload: WhatsAppPayload): string {
  const { name, email, stageName, concernName, amountRupees, paymentId, phone } = payload;

  switch (type) {
    case 'payment_confirmed_user':
      return (
        `✅ *Payment Confirmed — MetryxOne*\n\n` +
        `Hi ${name || 'there'},\n\n` +
        `Your payment of *₹${amountRupees}* for the *${stageName} Stage* on "${concernName}" has been received.\n\n` +
        `Your assessment is now unlocked. Return to MetryxOne to continue your journey.\n\n` +
        `Payment ID: ${paymentId || 'N/A'}\n\n` +
        `Questions? Reply to this message or email us at support@metryxone.com`
      );

    case 'payment_confirmed_admin':
      return (
        `💰 *New Stage Payment — MetryxOne Admin*\n\n` +
        `*User:* ${name || 'Unknown'}\n` +
        `*Email:* ${email || 'N/A'}\n` +
        `*Phone:* ${phone || 'Not provided'}\n` +
        `*Stage:* ${stageName}\n` +
        `*Concern:* ${concernName || 'N/A'}\n` +
        `*Amount:* ₹${amountRupees}\n` +
        `*Payment ID:* ${paymentId || 'N/A'}\n\n` +
        `Login to admin panel to view: https://metryx.one/admin`
      );
  }
}

export async function sendWhatsAppNotification(opts: SendWhatsAppOptions): Promise<boolean> {
  const { to, type, payload } = opts;
  const message = buildMessage(type, payload);

  const endpoint = process.env.WATI_API_ENDPOINT;
  const token    = process.env.WATI_API_TOKEN;

  if (!endpoint || !token) {
    // No WATI configured — log the message for manual sending
    console.log(`[whatsapp] No WATI credentials — would send to ${to}:\n${message}`);
    return false;
  }

  try {
    const phone = to.replace(/\D/g, '');
    const resp = await fetch(`${endpoint}/api/v1/sendSessionMessage/${phone}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ messageText: message }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error(`[whatsapp] WATI send failed (${resp.status}): ${text}`);
      return false;
    }

    console.log(`[whatsapp] Message sent to ${phone} (type=${type})`);
    return true;
  } catch (err: any) {
    console.error('[whatsapp] Send error:', err?.message || err);
    return false;
  }
}
