import nodemailer from 'nodemailer';
import { STAGE_CODE_TO_LABEL, stageOrder, LIFECYCLE_STAGE_CODES } from './lib/lifecycle';

function getTransporter() {
  const user = process.env.ZOHO_EMAIL || 'notifications@metryxone.com';
  const pass = process.env.ZOHO_APP_PASSWORD || '';

  return nodemailer.createTransport({
    host: 'smtppro.zoho.in',
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

/**
 * Ops 2.5 (flag operationalReadiness) — generic operational alert email sender.
 * Reused by services/ops/alerting.ts to route alert-rule events over email.
 * Returns false (never throws) so alert routing can degrade honestly.
 */
export async function sendOperationalAlertEmail(toEmail: string, subject: string, body: string): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL || 'notifications@metryxone.com';
    await transporter.sendMail({
      from: `"MetryxOne Ops" <${fromEmail}>`,
      to: toEmail,
      subject,
      text: body,
    });
    return true;
  } catch (e: any) {
    console.error('Failed to send operational alert email:', e?.message || e);
    return false;
  }
}

export async function sendMfaCode(toEmail: string, code: string, adminEmail: string): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;

    await transporter.sendMail({
      from: `"MetryxOne Security" <${fromEmail}>`,
      to: toEmail,
      subject: 'MetryxOne Super Admin MFA Verification Code',
      text: `Your Super Admin MFA verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nAdmin login attempt by: ${adminEmail}\nTimestamp: ${new Date().toISOString()}\n\nIf you did not request this code, please secure the admin account immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 20px; background-color: #344E86; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 22px;">MetryxOne</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0 0; font-size: 13px;">Super Admin Verification</p>
          </div>
          <div style="padding: 30px; background-color: #f8f9fa; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 14px; margin: 0 0 20px 0;">A login attempt was made for the Super Admin panel. Use the code below to complete verification:</p>
            <div style="text-align: center; padding: 20px; background: white; border-radius: 10px; border: 2px dashed #4ECDC4; margin: 0 0 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #344E86;">${code}</span>
            </div>
            <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 0 0 16px 0;">This code expires in <strong>5 minutes</strong>.</p>
            <div style="padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="color: #856404; font-size: 12px; margin: 0;"><strong>Admin:</strong> ${escapeHtml(adminEmail)}</p>
              <p style="color: #856404; font-size: 12px; margin: 4px 0 0 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
          </div>
          <div style="text-align: center; padding: 16px;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0;">&copy; 2026 MetryxOne. If you did not request this, secure the account immediately.</p>
          </div>
        </div>
      `
    });

    console.log(`MFA code sent to ${toEmail} for admin ${adminEmail}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send MFA email:', error?.message || error);
    console.error('SMTP config used - host: smtp.zoho.in, port: 465, user configured:', !!process.env.ZOHO_EMAIL);
    console.error('Full error:', JSON.stringify(error, null, 2));
    return false;
  }
}

export async function sendIntroVerificationOtp(toEmail: string, name: string, code: string): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL || 'notifications@metryxone.com';
    await transporter.sendMail({
      from: `"MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: 'Your MetryxOne Verification Code',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#344E86;padding:28px 32px 20px;">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">MetryxOne</h1>
            <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:12px;">CAPADEX Behavioural Intelligence</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#374151;font-size:15px;font-weight:600;margin:0 0 8px;">Hi ${escapeHtml(name || 'there')},</p>
            <p style="color:#6b7280;font-size:13px;margin:0 0 24px;line-height:1.6;">
              Use the code below to verify your email and begin your behavioural assessment.
              This is a one-time code — valid for <strong>10 minutes</strong>.
            </p>
            <div style="text-align:center;background:#f0f4ff;border:2px dashed #344E86;border-radius:14px;padding:24px;margin:0 0 24px;">
              <p style="color:#344E86;font-size:38px;font-weight:900;letter-spacing:12px;margin:0;">${code}</p>
              <p style="color:#6b7280;font-size:11px;margin:8px 0 0;">Expires in <strong>10 minutes</strong></p>
            </div>
            <p style="color:#374151;font-size:13px;margin:0 0 8px;line-height:1.6;">
              Once verified, your email is saved so you can access your report at any time —
              no account or password required.
            </p>
            <p style="color:#9ca3af;font-size:11px;margin:16px 0 0;">Didn't request this? You can safely ignore this email.</p>
          </div>
          <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="color:#9ca3af;font-size:10px;margin:0;">&copy; 2026 MetryxOne &nbsp;·&nbsp; DPDP Compliant &nbsp;·&nbsp; Private &amp; Confidential</p>
          </div>
        </div>
      `,
    });
    console.log(`[email] Intro verification OTP sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[email] Failed to send intro verification OTP:', error?.message || error);
    console.error('[email] SMTP config — host: smtppro.zoho.in, port: 465, user configured:', !!process.env.ZOHO_EMAIL);
    return false;
  }
}

export async function sendLoginOtp(toEmail: string, name: string, code: string, expiryMinutes: number = 10): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    await transporter.sendMail({
      from: `"MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: 'MetryxOne Login OTP',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#344E86;padding:28px 32px 20px;">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">MetryxOne</h1>
            <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:12px;">Behavioral Intelligence Platform</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#374151;font-size:15px;font-weight:600;margin:0 0 8px;">Hi ${escapeHtml(name || 'there')},</p>
            <p style="color:#6b7280;font-size:13px;margin:0 0 24px;line-height:1.6;">
              Your login code is below. Valid for <strong>${expiryMinutes} minutes</strong>.
            </p>
            <div style="text-align:center;background:#f0f4ff;border:2px dashed #344E86;border-radius:14px;padding:24px;margin:0 0 24px;">
              <p style="color:#344E86;font-size:38px;font-weight:900;letter-spacing:12px;margin:0;">${code}</p>
              <p style="color:#6b7280;font-size:11px;margin:8px 0 0;">Expires in <strong>${expiryMinutes} minutes</strong></p>
            </div>
            <p style="color:#9ca3af;font-size:11px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="color:#9ca3af;font-size:10px;margin:0;">You received this because you have notifications enabled on MetryxOne. &nbsp;·&nbsp; &copy; 2026 MetryxOne · DPDP Compliant</p>
          </div>
        </div>
      `,
    });
    console.log(`Login OTP sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send Login OTP email:', error?.message || error);
    return false;
  }
}

export async function sendCapadexOtp(toEmail: string, name: string, code: string, stageCode?: string): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const otpStageHdr = STAGE_HEADER[stageCode || 'CAP_CUR'] || STAGE_HEADER['CAP_CUR'];
    await transporter.sendMail({
      from: `"MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: `Your MetryxOne ${otpStageHdr.label} Report — Verification Code`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#344E86;padding:28px 32px 20px;">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">MetryxOne</h1>
            <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:12px;">Behavioral Intelligence Platform</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#374151;font-size:15px;font-weight:600;margin:0 0 8px;">Hi ${escapeHtml(name || 'there')},</p>
            <p style="color:#6b7280;font-size:13px;margin:0 0 24px;line-height:1.6;">
              Your <strong>${otpStageHdr.label} Assessment</strong> is complete! Enter the code below to verify your email and view your personalised report.
            </p>
            <div style="text-align:center;background:#f0f4ff;border:2px dashed #344E86;border-radius:14px;padding:24px;margin:0 0 24px;">
              <p style="color:#344E86;font-size:38px;font-weight:900;letter-spacing:12px;margin:0;">${code}</p>
              <p style="color:#6b7280;font-size:11px;margin:8px 0 0;">Expires in <strong>10 minutes</strong></p>
            </div>
            <p style="color:#9ca3af;font-size:11px;margin:0;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="color:#9ca3af;font-size:10px;margin:0;">You received this because you have notifications enabled on MetryxOne. &nbsp;·&nbsp; &copy; 2026 MetryxOne · DPDP Compliant</p>
          </div>
        </div>
      `,
    });
    console.log(`CAPADEX OTP sent to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send CAPADEX OTP:', error?.message || error);
    return false;
  }
}

const STAGE_COPY: Record<string, {
  greeting: (concernName: string) => string;
  sectionHeadline: string;
  sectionBody: string;
  teaserIntro: string;
  teasers: string[];
  ctaHeadline: string;
  ctaBody: (concernName: string) => string;
  ctaButton: string;
  signOff: string;
  teamSignOff: string;
  nextStageUrl: (concernName: string) => string;
}> = {
  CAP_CUR: {
    greeting: (concernName) => `Your Curiosity Stage report for ${concernName} is attached as a PDF. Here is what the data found — and what it points to next.`,
    sectionHeadline: 'Your score maps the surface. Stage 2 reveals what is running underneath it — and most people are surprised by what it finds.',
    sectionBody: 'Scores tell you where you are. They do not explain why the pattern exists, what is sustaining it, or why the things you have already tried have not worked. That is what Stage 2 — the Insight Stage — is built to do. It goes four levels deeper than any score can reach.',
    teaserIntro: 'What Stage 2 — Insight — will uncover for this exact profile:',
    teasers: [
      'The hidden driver behind this specific pattern — not the obvious one, the real one running underneath it.',
      'The 2–3 precise moments each day when this pattern spikes — and the narrow window to interrupt it before it runs.',
      'Why every generic strategy has missed the mark — and what a profile-specific approach looks like instead.',
    ],
    ctaHeadline: 'Something specific is sustaining this pattern. Stage 2 will name it.',
    ctaBody: (concernName) => `Most people who complete Stage 2 describe it as the first time the "${concernName}" pattern actually made sense — not just as a score, but as a system that can be understood and changed. The Insight Stage does not give generic guidance. It reads this specific profile and tells you exactly where the leverage is.`,
    ctaButton: 'Unlock Stage 2 — Insight',
    signOff: 'The data has revealed the shape of the pattern. Stage 2 will show you the machinery behind it — and where to intervene.',
    teamSignOff: '— The MetryxOne Intelligence Team',
    nextStageUrl: (concernName) => `/?stage=CAP_INS&concern=${encodeURIComponent(concernName)}`,
  },
  CAP_INS: {
    greeting: (concernName) => `Your Insight Stage analysis for ${concernName} is complete and attached as a PDF. The root cause and trigger map are below.`,
    sectionHeadline: 'The root cause is mapped. Stage 3 converts that knowledge into a strategy that actually produces measurable change.',
    sectionBody: 'Understanding why a pattern exists is the breakthrough moment — but it is only half the work. The Growth Stage takes the exact root cause and triggers identified here and builds a behaviour-change system designed to interrupt the pattern where it is weakest, not where it is most visible.',
    teaserIntro: 'What Stage 3 — Growth — is built to deliver:',
    teasers: [
      'A behaviour-change sequence targeting the specific triggers identified in this Insight report — not a general plan.',
      'Habit structures matched to this cognitive and emotional profile, so they are sustainable rather than exhausting.',
      'A 30-day momentum framework with checkpoints that tell you whether the approach is working — and what to adjust if not.',
    ],
    ctaHeadline: 'The root cause is clear. Stage 3 builds the strategy that dismantles it.',
    ctaBody: (concernName) => `The "${concernName}" pattern now has a map. The Growth Stage uses that map to build a personalised intervention — structured around this exact profile, not adapted from someone else's. Real change starts here.`,
    ctaButton: 'Unlock Stage 3 — Growth',
    signOff: 'Understanding is powerful. What Stage 3 does is turn that understanding into something the pattern cannot survive.',
    teamSignOff: 'The insight is earned — now comes the action. — The MetryxOne Team',
    nextStageUrl: (concernName) => `/?stage=CAP_GRW&concern=${encodeURIComponent(concernName)}`,
  },
  CAP_GRW: {
    greeting: (concernName) => `Your Growth Stage report for ${concernName} is attached. The personalised action plan built from your profile is below.`,
    sectionHeadline: 'Momentum is built. Stage 4 — Mastery — protects it, deepens it, and makes it hold under pressure.',
    sectionBody: 'Progress built during Growth is real — and fragile without the right structure behind it. High-pressure periods, fatigue, and transitions are where growth reverses. The Mastery Stage is built specifically to prevent that, by installing the advanced self-regulation systems that sustain change when circumstances get difficult.',
    teaserIntro: 'What Stage 4 — Mastery — will install:',
    teasers: [
      'Advanced resilience protocols that keep the gains holding under stress, transitions, and high-stakes periods.',
      'A personalised maintenance system that prevents the slow slide back when life gets busy.',
      'A peak-performance benchmark comparing this profile against top-quartile developmental outcomes — so you know exactly where you stand.',
    ],
    ctaHeadline: 'Progress built without protection does not last. Stage 4 builds the protection.',
    ctaBody: (concernName) => `The "${concernName}" growth that has been built here is the foundation. Stage 4 builds the structure that makes it permanent — so when pressure increases, the progress holds rather than eroding.`,
    ctaButton: 'Unlock Stage 4 — Mastery',
    signOff: 'What you have built here is real. What Stage 4 does is make sure it stays real — even when things get hard.',
    teamSignOff: 'Keep building — The MetryxOne Team',
    nextStageUrl: (concernName) => `/?stage=CAP_MAS&concern=${encodeURIComponent(concernName)}`,
  },
  CAP_MAS: {
    greeting: (concernName) => `Your Mastery Stage profile for ${concernName} is complete and attached. Here is a full breakdown of your advanced behavioural intelligence.`,
    sectionHeadline: 'Mastery reached. The work now is sustaining it under pressure, expanding it, and using it to lift others.',
    sectionBody: 'Reaching the Mastery stage is a rare outcome. Most people plateau at Growth. Getting here means the pattern that once created difficulty has been systematically understood, interrupted, and rebuilt. The question now is what to do with that capability.',
    teaserIntro: 'What advanced development looks like from this point:',
    teasers: [
      'Stress-testing the mastery under genuinely novel conditions — new environments, elevated stakes, unfamiliar pressures.',
      'Identifying adjacent domains where these strengthened capabilities can transfer and compound.',
      'Contributing to others\' development — which, consistently, deepens mastery further than continued solo practice.',
    ],
    ctaHeadline: 'This is not the end of the journey. It is the beginning of a different one.',
    ctaBody: (_concernName) => 'The full profile is built. The next stage of development is about expanding into what this profile makes possible — in performance, in leadership, in how you support the people around you.',
    ctaButton: 'Explore advanced pathways',
    signOff: 'This represents genuine, sustained work. From here, the gains compound — and the reach of this development extends beyond just yourself.',
    teamSignOff: 'You have come a long way. — The MetryxOne Team',
    nextStageUrl: (concernName) => `/advanced-pathways?concern=${encodeURIComponent(concernName)}`,
  },
};

// Single-sourced from the lifecycle canon (lib/lifecycle.ts): coded label + 1-based stage
// number. Values are byte-identical to the prior inline literal (Curiosity 1 / Insight 2 /
// Growth 3 / Mastery 4) — this is read-layer single-sourcing, not a behaviour change.
const STAGE_HEADER: Record<string, { label: string; stageNum: number }> = Object.fromEntries(
  LIFECYCLE_STAGE_CODES.map((code) => [code, { label: STAGE_CODE_TO_LABEL[code], stageNum: stageOrder(code) + 1 }]),
);

export interface DynamicReportSummary {
  behavioural_summary: string;
  pattern_insights: Array<{
    text:              string;
    why_generated:     string;
    confidence_level:  string;
    construct_key:     string;
    hypothesis_label:  string;
  }>;
  growth_opportunities: Array<{ text: string; construct_key: string }>;
  confidence_transparency: {
    overall_confidence:   number;
    hypothesis_count:     number;
    high_confidence_count: number;
    note:                 string;
  };
}

/** Run telemetry — per-item hesitation + backtracks captured during assessment. */
export interface OmegaTelemetry {
  avg_hesitation_ms: number;
  total_backtracks: number;
  telemetry_rows: number;
}

export type CapadexReportInput = {
  concernName: string;
  stageLabel: string;
  stageCode?: string;
  actionPlanSubtitle?: string;
  score: number;
  scoreLevel: string;
  insight: string;
  subdomains: Array<{ subdomain_name: string; avg_score: number; item_count: number }>;
  reportId: string;
  reportUrl?: string;
  recommendations?: Array<{ title: string; expected_outcome?: string; rec_type?: string; domain?: string }>;
  dynamic_report?: DynamicReportSummary;
  // OMEGA-X enriched report envelope (from buildOmegaReport). Loosely typed —
  // rendered defensively so sections hide when fields are absent.
  omega?: Record<string, unknown>;
  // Run telemetry — drives the cognitive-load band in Response Intelligence.
  telemetry?: OmegaTelemetry;
  // Provenance signals (mirrors the SuperAdmin reports console). Always shown
  // in the email via a small strip; pacing falls back to a placeholder when not
  // yet persisted per-report.
  claritySource?: string;
  contradictionCount?: number;
  pacingMs?: number;
  // BIOS synthesised behavioural archetype — omitted when no signal profile exists.
  behavioralArchetype?: { label: string; summary: string; tone: 'caution' | 'observe' | 'positive' } | null;
};

const NARRATIVE_MAP = (
  firstName: string,
  concernName: string,
): Record<string, Record<string, Record<string, { headline: string; story: string }>>> => ({
  CAP_CUR: {
    attention: {
      Advanced:   { headline: `${firstName} has strong natural focus — but there are hidden patterns worth uncovering.`, story: `These Curiosity results show real self-awareness and attention endurance. Yet even the strongest focus has invisible drivers — specific triggers, emotional links, and time-of-day patterns — that only the Insight stage can reveal.` },
      Proficient: { headline: `${firstName} manages attention well — the question is what is holding the ceiling.`, story: `Functioning above average means the gap between current performance and potential is narrow but significant. The Insight stage is built to find exactly what is creating that ceiling.` },
      Developing: { headline: `${firstName}'s attention has clear strengths — and a hidden gap creating the struggle.`, story: `These results show solid foundations, but something is consistently pulling focus off-track. It is rarely what people think it is. The Insight stage finds the real cause — and the strategy to address it.` },
      Emerging:   { headline: `${firstName}'s attention pattern is telling an important story — one worth understanding fully.`, story: `The Curiosity results are just the surface. Behind every attention struggle is a specific pattern of triggers, timing, and habits. The Insight stage maps that pattern precisely so real change becomes possible.` },
    },
    screen: {
      Advanced:   { headline: `${firstName} has strong screen-time awareness — but awareness alone rarely creates change.`, story: `These results show clear understanding of what is happening with screen habits. The Insight stage goes deeper — uncovering the emotional needs being met and building a personalised replacement strategy.` },
      Proficient: { headline: `${firstName} is managing screen time reasonably — but something keeps pulling attention back.`, story: `There is more awareness here than most, yet the pull persists. The Insight stage reveals why — and delivers a pattern-specific plan, not generic advice.` },
      Developing: { headline: `${firstName}'s screen habits have a pattern — and patterns can be decoded and changed.`, story: `What feels like a willpower problem is almost always a trigger-and-reward cycle. The Insight stage maps that specific cycle so it can be interrupted at exactly the right moment.` },
      Emerging:   { headline: `${firstName}'s relationship with screens is more complex than it appears on the surface.`, story: `There are emotional and environmental drivers behind these screen habits that generic tips will never address. The Insight stage is where the real map gets drawn.` },
    },
    default: {
      Advanced:   { headline: `${firstName} shows strong awareness — and there is a deeper layer waiting to be understood.`, story: `These Curiosity results reveal genuine self-awareness around "${concernName}". The Insight stage will show what sits beneath that awareness — the patterns, the triggers, the exact levers to pull.` },
      Proficient: { headline: `${firstName} is doing well — and the Insight stage will show exactly what to do next.`, story: `The results are solid. The Insight stage takes that foundation and builds a precise picture of what is holding the ceiling and how to break through it.` },
      Developing: { headline: `${firstName}'s results reveal something important about "${concernName}".`, story: `These Curiosity results are the first honest look at what is really going on. The Insight stage goes several layers deeper — finding the root cause, not just the symptoms.` },
      Emerging:   { headline: `${firstName}'s Curiosity results are the beginning of a real breakthrough.`, story: `Every significant change starts with accurate information. These results have created that starting point. The Insight stage builds the complete map of the "${concernName}" pattern.` },
    },
  },
  CAP_INS: {
    attention: {
      Advanced:   { headline: `${firstName}'s Insight analysis reveals strong attentional regulation — with specific trigger patterns now mapped.`, story: `The Insight stage has identified the precise drivers behind the attention pattern. The Growth stage builds on this map — creating structured habits and targeted strategies that work with this specific profile.` },
      Proficient: { headline: `${firstName}'s attention profile is well understood — and the Growth stage will act on it.`, story: `The Insight analysis has identified the mechanisms behind the attention pattern. The Growth stage translates that understanding into targeted habits and strategies that produce measurable change.` },
      Developing: { headline: `${firstName}'s Insight results have pinpointed where the attention pattern breaks down.`, story: `The Insight analysis has located the specific triggers and timing patterns behind the attention struggle. The Growth stage uses that map to build the interventions most likely to create lasting change.` },
      Emerging:   { headline: `${firstName}'s Insight stage has located the core of the attention struggle.`, story: `The triggers, timing, and cycles behind the attention pattern are now mapped. The Growth stage converts that precise understanding into a concrete, step-by-step action plan.` },
    },
    screen: {
      Advanced:   { headline: `${firstName}'s Insight analysis shows strong self-awareness — and the emotional drivers are now identified.`, story: `The Insight stage has gone beneath the surface of the screen habits to find what is actually driving them. The Growth stage builds the replacement strategies and environmental changes that create lasting shifts.` },
      Proficient: { headline: `${firstName}'s Insight stage has mapped what keeps pulling attention back to screens.`, story: `The trigger-and-reward cycle behind the screen pattern is now understood. The Growth stage creates the targeted interruptions and alternatives that actually hold under pressure.` },
      Developing: { headline: `${firstName}'s Insight analysis has decoded the reward cycle behind the screen pattern.`, story: `What felt like a willpower problem now has a clear map. The Growth stage is built to interrupt that cycle at exactly the right moments — using the specific profile data revealed in this Insight report.` },
      Emerging:   { headline: `${firstName}'s Insight stage has found what sits beneath the screen habits.`, story: `The emotional and environmental drivers that generic tips never address are now identified. The Growth stage converts that understanding into a step-by-step plan for real, sustained change.` },
    },
    default: {
      Advanced:   { headline: `${firstName}'s Insight stage has revealed the deeper drivers behind "${concernName}".`, story: `The Insight analysis has uncovered what sits beneath the surface of this pattern. The Growth stage will build targeted strategies on top of that precise understanding — moving from insight to measurable action.` },
      Proficient: { headline: `${firstName}'s Insight analysis shows solid pattern recognition — and the Growth stage will build on it.`, story: `The Insight results are strong. The Growth stage takes these findings and creates specific, measurable next steps designed around this exact profile — not generic advice.` },
      Developing: { headline: `${firstName}'s Insight stage has mapped the root causes behind "${concernName}".`, story: `The pattern is now understood at a level that surface-level tips never reach. The Growth stage turns those insights into structured behaviour change — built around what the Insight data revealed.` },
      Emerging:   { headline: `${firstName}'s Insight analysis has given an honest picture of what is driving "${concernName}".`, story: `That honesty is the foundation everything builds on. The Growth stage takes this baseline and constructs a concrete, profile-specific action plan — targeted at the exact patterns identified here.` },
    },
  },
  CAP_GRW: {
    attention: {
      Advanced:   { headline: `${firstName}'s Growth stage reflects real progress in attention regulation — structured habits are taking hold.`, story: `The Growth results show genuine capability development in attention management. The Mastery stage will stress-test and deepen these gains — extending them into higher-pressure contexts where they are hardest to maintain.` },
      Proficient: { headline: `${firstName} has built solid attention progress during the Growth stage.`, story: `Real, measurable progress has been made. The Mastery stage will lock in these patterns and extend them into new and more demanding contexts — converting consistent performance into automatic, pressure-proof behaviour.` },
      Developing: { headline: `${firstName}'s Growth results show a pattern in development — and the Mastery stage is built to accelerate it.`, story: `The foundations are building. The Mastery stage is specifically designed to take what has started to develop here and drive it to consistency — using targeted challenge and structured repetition.` },
      Emerging:   { headline: `${firstName}'s Growth results point to where Mastery-level work will create the breakthrough.`, story: `Structured repetition and targeted challenge are what come next. The Mastery stage addresses the specific gaps identified in the Growth results — where the most focused investment will produce the most visible transformation.` },
    },
    screen: {
      Advanced:   { headline: `${firstName}'s Growth stage shows genuine momentum in screen habit regulation.`, story: `Real habit change has been built. The Mastery stage will extend these gains into high-stress situations — where screen habits are hardest to maintain and where the strongest gains are still available.` },
      Proficient: { headline: `${firstName} has made real progress on screen habits during the Growth stage.`, story: `The patterns are shifting. The Mastery stage converts that progress into automatic, pressure-proof behaviour — so the changes that have been built continue to hold when conditions are at their most demanding.` },
      Developing: { headline: `${firstName}'s Growth stage has started to reshape the screen pattern.`, story: `Change is underway — and the Mastery stage is where it gets tested, strengthened, and made permanent. The specific patterns identified in the Growth results are exactly what the Mastery stage is built to address.` },
      Emerging:   { headline: `${firstName}'s Growth results show where the most targeted support is still needed.`, story: `The Mastery stage addresses these gaps with advanced, precision strategies — building on what the Growth stage started and closing the remaining distance between current performance and lasting change.` },
    },
    default: {
      Advanced:   { headline: `${firstName}'s Growth stage has built strong momentum on "${concernName}".`, story: `Real capability development is visible in these results. The Mastery stage will consolidate and sharpen these gains — converting strong performance into lasting, automatic patterns that hold under pressure.` },
      Proficient: { headline: `${firstName} has made real progress on "${concernName}" during the Growth stage.`, story: `The progress is measurable and genuine. The Mastery stage converts these patterns into durable, self-sustaining behaviour — so what has been built continues to compound over time.` },
      Developing: { headline: `${firstName}'s Growth stage has started the transformation on "${concernName}".`, story: `The direction is right — and the Mastery stage is designed to take that progress and drive it to completion. The specific development areas identified here are exactly where Mastery-level work creates the biggest shift.` },
      Emerging:   { headline: `${firstName}'s Growth results highlight where focused Mastery-level work will have the greatest impact.`, story: `These are the precise areas where the next stage of investment will produce the most visible change. The Mastery stage is precision-targeted at what the Growth results have identified.` },
    },
  },
  CAP_MAS: {
    attention: {
      Advanced:   { headline: `${firstName} has achieved Mastery-level attention regulation — genuine, consolidated capability.`, story: `These results reflect deep, self-sustaining attentional control. The priority now is protecting these gains under pressure and transferring the regulation skills to new, more demanding contexts.` },
      Proficient: { headline: `${firstName} has built strong attention mastery — the work now is sustaining it.`, story: `Sustaining Mastery-level attention regulation means maintaining the environmental conditions and habits that drove these results — and continuing to stress-test them against increasingly demanding situations.` },
      Developing: { headline: `${firstName}'s Mastery results highlight where attention regulation still needs ongoing investment.`, story: `The pattern is embedded in places — and still developing in others. Identifying where and why focus still breaks down under pressure is the immediate priority, with targeted reinforcement to follow.` },
      Emerging:   { headline: `${firstName}'s Mastery results signal that the core attention strategies need to be revisited.`, story: `Protecting earlier attention gains requires identifying what is causing regression. The foundations are there — what is needed now is reinforcing the underlying structures and rebuilding consistency.` },
    },
    screen: {
      Advanced:   { headline: `${firstName} has achieved Mastery-level screen regulation — deep, self-sustaining habit change.`, story: `These results reflect genuine behavioural integration. The focus now is on maintaining this under high stress and transferring the discipline built here into adjacent habits and contexts.` },
      Proficient: { headline: `${firstName} has established strong screen habit mastery — the work now is protecting it.`, story: `Sustaining this level of screen regulation means continuing to monitor trigger patterns and maintaining the replacement behaviours that have created these results — especially when conditions are at their most demanding.` },
      Developing: { headline: `${firstName}'s Mastery results show where screen regulation still needs targeted reinforcement.`, story: `The change is partially embedded — what remains is converting that partial progress into full consistency. Identifying the specific triggers still driving regression is the immediate next step.` },
      Emerging:   { headline: `${firstName}'s Mastery results signal that the underlying screen habit drivers need to be revisited.`, story: `Sustainable change requires addressing what is still pulling the pattern backward. The gains made earlier are worth protecting — and that protection begins with understanding precisely what is causing them to slip.` },
    },
    default: {
      Advanced:   { headline: `${firstName} has reached Mastery-level on "${concernName}" — genuine, consolidated capability.`, story: `These results reflect real, sustained progress. The focus now is sustaining and extending these gains — protecting what has been built under pressure and transferring the skills to adjacent areas of performance.` },
      Proficient: { headline: `${firstName} has achieved strong Mastery results on "${concernName}" — the work now is sustaining them.`, story: `Real progress has been consolidated. Maintaining it means continuing the conditions and practices that drove it — and stress-testing the gains regularly to ensure they hold when circumstances are most challenging.` },
      Developing: { headline: `${firstName}'s Mastery results highlight specific areas within "${concernName}" that need ongoing reinforcement.`, story: `Sustained progress requires targeted attention to what is still developing. Identifying the precise points where the pattern is still inconsistent — and building targeted practice around them — is what comes next.` },
      Emerging:   { headline: `${firstName}'s Mastery results indicate that core patterns around "${concernName}" need to be revisited and strengthened.`, story: `The gains made earlier are worth protecting — and protection begins with understanding what is causing them to slip. Targeted reinforcement of the underlying foundations is the immediate priority.` },
    },
  },
});

const SCORE_CTX_MAP = (score: number): Record<string, Record<string, string>> => ({
  CAP_CUR: {
    Advanced:   `A score of ${score} is among the highest for this concern — reflecting strong self-awareness and cognitive regulation. This signals real capacity for growth at the next level.`,
    Proficient: `A score of ${score} reflects above-average self-awareness and solid performance. There are genuine strengths here, alongside specific areas where targeted support would produce measurable change.`,
    Developing: `A score of ${score} reflects an emerging pattern — enough awareness to identify the concern, with clear room for structured development. This is exactly where the Insight assessment creates the biggest impact.`,
    Emerging:   `A score of ${score} marks an important starting point. Recognising the pattern is the hardest step — and it has been taken. Everything that follows builds from this honest baseline.`,
  },
  CAP_INS: {
    Advanced:   `A score of ${score} in the Insight stage reflects deep pattern recognition and strong self-understanding. These results lay powerful groundwork for the Growth stage ahead.`,
    Proficient: `A score of ${score} shows solid self-awareness at the Insight level. The Growth stage will take these foundations and build targeted strategies around them.`,
    Developing: `A score of ${score} reveals areas where structured development will make the biggest difference. The Growth stage is designed precisely for this — converting insight into measurable progress.`,
    Emerging:   `A score of ${score} is an honest baseline — and the most important kind. The Growth stage turns that raw awareness into a step-by-step plan built around this specific pattern.`,
  },
  CAP_GRW: {
    Advanced:   `A score of ${score} at the Growth stage reflects genuine capability development and strong momentum. The Mastery stage will consolidate and sharpen these gains even further.`,
    Proficient: `A score of ${score} shows real progress at the Growth level. The Mastery stage is where these patterns get locked in and converted into lasting behavioural change.`,
    Developing: `A score of ${score} shows areas that the Mastery stage is specifically built to address — taking what has been learned and driving it to consistent, sustained performance.`,
    Emerging:   `A score of ${score} points to gaps that dedicated Mastery-level work will close. This is where structured repetition and targeted challenge produce the most visible transformation.`,
  },
  CAP_MAS: {
    Advanced:   `A score of ${score} at the Mastery stage is exceptional — reflecting sustained high performance and deep behavioural integration. The focus now is protecting and extending these gains.`,
    Proficient: `A score of ${score} at the Mastery level shows strong, consolidated capability. Sustaining this means continuing the habits and environmental conditions that drove these results.`,
    Developing: `A score of ${score} at the Mastery stage highlights specific areas where sustaining progress will require intentional practice and regular review to prevent regression.`,
    Emerging:   `A score of ${score} is a signal to revisit the strategies that created earlier gains. Sustaining progress at the Mastery level means identifying and reinforcing what has started to slip.`,
  },
});

/**
 * Renders the OMEGA-X intelligence sections for the report email, mirroring the
 * in-app CapadexReportPhase cards: Calibration & confidence, Report quality,
 * Response intelligence (+ cognitive-load telemetry), Behavioural memory, and
 * Forecast. Every section is gated on real data — when a field is absent the
 * section is omitted, and when no omega envelope is supplied this returns ''.
 */
/**
 * Telemetry / provenance strip — always rendered (independent of OMEGA-X gating).
 * Surfaces the three signals shown in the SuperAdmin reports console: clarity
 * source, contradiction count, and run pacing. Pacing is shown as-is; when not
 * persisted per-report the caller passes the placeholder default.
 */
function buildProvenanceStripHtml(
  claritySource: string,
  contradictionCount: number,
  pacingMs: number,
): string {
  const esc = (s: unknown): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  const clarityLabelMap: Record<string, string> = {
    master_curated: 'Master-curated',
    adaptive_bank: 'Adaptive bank',
    static_fallback: 'Static fallback',
  };
  const clarityLabel = clarityLabelMap[claritySource] || 'Master-curated';
  const contraN = Math.max(0, Math.round(num(contradictionCount)));
  const pacing = Math.max(0, Math.round(num(pacingMs)));

  const cell = (label: string, value: string): string =>
    `<td style="vertical-align:top;padding:0 10px;">
       <p style="color:#94A3B8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 3px;">${esc(label)}</p>
       <p style="color:#334155;font-size:12px;font-weight:600;margin:0;">${esc(value)}</p>
     </td>`;

  return `
  <!-- ── Provenance / telemetry strip ── -->
  <div style="padding:12px 28px;border-bottom:1px solid #f1f5f9;">
    <p style="color:#94A3B8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 8px;">How this report was produced</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        ${cell('Question source', clarityLabel)}
        ${cell('Contradictions', `${contraN} flagged`)}
        ${cell('Response pacing', `${pacing} ms avg`)}
      </tr>
    </table>
  </div>`;
}

function buildOmegaSectionsHtml(
  omega: Record<string, unknown> | undefined,
  telemetry: OmegaTelemetry | undefined,
): string {
  if (!omega) return '';

  const esc = (s: unknown): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  const sectionWrap = (label: string, accent: string, inner: string): string => `
  <div style="padding:20px 28px 18px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid ${accent};padding-left:10px;margin-bottom:12px;">
      <p style="color:${accent};font-size:12px;font-weight:600;margin:0;text-transform:uppercase;letter-spacing:.4px;">${esc(label)}</p>
    </div>
    ${inner}
  </div>`;

  const sections: string[] = [];

  // ── Calibration & confidence ──────────────────────────────────────────────
  const cal = omega.calibration as Record<string, unknown> | undefined;
  const insightConf = omega.insight_confidence as Record<string, unknown> | undefined;
  if (cal && cal.overall_percentile != null) {
    const pct = num(cal.overall_percentile);
    const cohortSize = num(cal.cohort_size);
    const backendStatus = (cal.cohort_status ?? omega.cohort_status) as string | undefined;
    const tier: 'verified' | 'provisional' | 'hidden' =
      backendStatus === 'verified' ? 'verified'
      : backendStatus === 'provisional' ? 'provisional'
      : backendStatus === 'masked' ? 'hidden'
      : cohortSize >= 100 ? 'verified' : cohortSize >= 30 ? 'provisional' : 'hidden';
    const ci = cal.confidence_interval as number[] | undefined;
    const rows: string[] = [];
    if (tier === 'verified') {
      rows.push(`<span style="display:inline-block;background:#ECFDF5;color:#047857;border:1px solid #A7F3D0;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">Top ${100 - pct}% of peer group · verified cohort norm</span>`);
    } else if (tier === 'provisional') {
      rows.push(`<span style="display:inline-block;background:#FFFBEB;color:#92400E;border:1px solid #FDE68A;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;">~ Top ${100 - pct}% · provisional · cohort building (n=${cohortSize})</span>`);
    } else {
      rows.push(`<span style="display:inline-block;background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;font-size:11px;font-weight:500;padding:4px 10px;border-radius:20px;">Peer comparison locked — building a privacy-safe cohort (n&lt;30)</span>`);
    }
    if (tier !== 'hidden' && ci && ci.length === 2) {
      rows.push(`<span style="color:#64748B;font-size:11px;margin-left:8px;">95% CI: ${num(ci[0])}–${num(ci[1])}</span>`);
    }
    const confLevel = insightConf?.overall as string | undefined;
    let confLine = '';
    if (confLevel) {
      const confCol: Record<string, { col: string; bg: string; bdr: string }> = {
        High:     { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' },
        Moderate: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' },
        Low:      { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' },
      };
      const cc = confCol[confLevel] || confCol.Moderate;
      confLine = `<p style="margin:10px 0 0;"><span style="display:inline-block;background:${cc.bg};color:${cc.col};border:1px solid ${cc.bdr};font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;">${esc(confLevel)} confidence</span>${insightConf?.evidence_summary ? `<span style="color:#64748B;font-size:11px;margin-left:8px;">${esc(insightConf.evidence_summary)}</span>` : ''}</p>`;
    }
    sections.push(sectionWrap('Calibration &amp; confidence', '#4F46E5',
      `<div>${rows.join(' ')}</div>${confLine}
       <p style="color:#94A3B8;font-size:10px;margin:10px 0 0;line-height:1.6;">Developmental signal only — not a hiring, placement, or suitability prediction.</p>`));
  }

  // ── Report quality ────────────────────────────────────────────────────────
  const qv = omega.quality_validation as {
    gate?: string; overall_score?: number; summary?: string;
    dimensions?: Record<string, { score?: number }>;
  } | undefined;
  if (qv && qv.gate) {
    const gateMeta: Record<string, { col: string; bg: string; bdr: string; label: string }> = {
      pass:   { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0', label: 'Quality verified' },
      review: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', label: 'Under review' },
      fail:   { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', label: 'Quality check failed' },
    };
    const gm = gateMeta[qv.gate] || gateMeta.review;
    const dimLabels: Record<string, string> = {
      scientific: 'Scientific', safety: 'Safety', narrative: 'Narrative',
      intervention: 'Interventions', readability: 'Readability',
    };
    const chips = Object.entries(qv.dimensions || {}).map(([k, d]) => {
      const sc = num(d?.score);
      const col = sc >= 80 ? '#059669' : sc >= 60 ? '#D97706' : '#DC2626';
      return `<span style="display:inline-block;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:3px 9px;margin:0 6px 6px 0;font-size:11px;color:#64748B;">${esc(dimLabels[k] || k)} <strong style="color:${col};">${sc}%</strong></span>`;
    }).join('');
    sections.push(sectionWrap('Report quality', gm.col,
      `<p style="margin:0 0 10px;"><span style="display:inline-block;background:${gm.bg};color:${gm.col};border:1px solid ${gm.bdr};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${esc(gm.label)} · ${num(qv.overall_score)}/100</span></p>
       <div style="margin-bottom:6px;">${chips}</div>
       ${qv.summary ? `<p style="color:#4A5568;font-size:12px;line-height:1.65;margin:0;">${esc(qv.summary)}</p>` : ''}`));
  }

  // ── Response intelligence (+ cognitive-load telemetry) ─────────────────────
  const contra = omega.contradictions as {
    count?: number; has_contradictions?: boolean; reliability_impact?: string;
    interpretation?: string;
    events?: Array<{ type?: string; severity?: string; affected_subdomains?: string[] }>;
  } | undefined;
  if (contra) {
    const impactCol: Record<string, { col: string; bg: string; bdr: string }> = {
      none:        { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' },
      minor:       { col: '#0284C7', bg: '#F0F9FF', bdr: '#BAE6FD' },
      moderate:    { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' },
      significant: { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' },
    };
    const ic = impactCol[contra.reliability_impact || 'minor'] || impactCol.minor;
    const count = num(contra.count);
    const badge = count === 0
      ? 'Consistent'
      : `${count} variation${count > 1 ? 's' : ''} · ${esc(contra.reliability_impact)} impact`;

    let cogLoad = '';
    if (telemetry && telemetry.telemetry_rows > 0) {
      const hesMs = num(telemetry.avg_hesitation_ms);
      const bt = num(telemetry.total_backtracks);
      const band: 'Low' | 'Steady' | 'Elevated' | 'High' =
        hesMs < 1200 && bt <= 1 ? 'Low'
        : hesMs < 2400 && bt <= 3 ? 'Steady'
        : hesMs < 4000 || bt <= 6 ? 'Elevated'
        : 'High';
      const bandTone: Record<string, { col: string; bg: string; bdr: string; note: string }> = {
        Low:      { col: '#047857', bg: '#ECFDF5', bdr: '#A7F3D0', note: 'Quick, confident taps — low cognitive strain on this run.' },
        Steady:   { col: '#0284C7', bg: '#F0F9FF', bdr: '#BAE6FD', note: 'Healthy pacing — considered responses without over-deliberation.' },
        Elevated: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', note: 'Noticeable deliberation — some items required real cognitive work.' },
        High:     { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', note: 'High strain detected — frequent re-considers. Worth pacing kindly.' },
      };
      const bd = bandTone[band];
      cogLoad = `<div style="background:${bd.bg};border:1px solid ${bd.bdr};border-radius:8px;padding:10px 12px;margin:10px 0 0;">
        <p style="margin:0 0 4px;"><span style="display:inline-block;background:${bd.col};color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:2px 7px;border-radius:4px;">Cognitive load</span> <strong style="color:${bd.col};font-size:12px;">${band}</strong> <span style="color:${bd.col};font-size:10px;opacity:.85;">~${Math.round(hesMs)} ms hesitation · ${bt} re-consider${bt === 1 ? '' : 's'}</span></p>
        <p style="color:${bd.col};font-size:11px;line-height:1.55;margin:0;opacity:.9;">${esc(bd.note)}</p>
      </div>`;
    }

    const typeLabels: Record<string, string> = {
      score_reversal: 'Score reversal', emotional_masking: 'Emotional masking',
      self_perception_bias: 'Self-perception bias', defensive_answering: 'Defensive answering',
    };
    let events = '';
    if (contra.has_contradictions && contra.events && contra.events.length > 0) {
      events = '<div style="margin-top:10px;">' + contra.events.slice(0, 3).map(ev => {
        const sevCol = ev.severity === 'high' ? '#DC2626' : ev.severity === 'medium' ? '#D97706' : '#0284C7';
        const sevBg = ev.severity === 'high' ? '#FEF2F2' : ev.severity === 'medium' ? '#FFFBEB' : '#F0F9FF';
        const areas = (ev.affected_subdomains || []).slice(0, 2).join(', ');
        return `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
          <span style="display:inline-block;background:${sevBg};color:${sevCol};font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;">${esc(ev.severity)}</span>
          <span style="color:#374151;font-size:11px;font-weight:600;margin-left:6px;">${esc(typeLabels[ev.type || ''] || ev.type)}</span>
          ${areas ? `<span style="color:#94A3B8;font-size:11px;display:block;margin-top:3px;">Areas: ${esc(areas)}</span>` : ''}
        </div>`;
      }).join('') + '</div>';
    }

    sections.push(sectionWrap('Response intelligence', ic.col,
      `<p style="margin:0 0 8px;"><span style="display:inline-block;background:${ic.bg};color:${ic.col};border:1px solid ${ic.bdr};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${badge}</span></p>
       ${contra.interpretation ? `<p style="color:#4A5568;font-size:12px;line-height:1.65;margin:0;">${esc(contra.interpretation)}</p>` : ''}
       ${cogLoad}${events}`));
  }

  // ── Behavioural memory (returning users only) ──────────────────────────────
  const mem = omega.longitudinal_memory as {
    is_returning_user?: boolean; session_count?: number;
    behavioural_drift?: { direction?: string; first_csi?: number; last_csi?: number; confidence?: string } | null;
    recurring_constructs?: Array<{ construct_key?: string; avg_score?: number; trend?: string; frequency?: number }>;
    resilience_recoveries?: Array<{ rebound_points?: number; concern_name?: string }>;
    growth_patterns?: Array<{ improvement?: number; sessions_span?: number; concern_name?: string }>;
  } | null | undefined;
  if (mem && mem.is_returning_user) {
    const sc = num(mem.session_count);
    const parts: string[] = [];
    const drift = mem.behavioural_drift;
    if (drift && drift.direction) {
      const dCol = drift.direction === 'improving' ? '#059669' : drift.direction === 'declining' ? '#D97706' : '#0284C7';
      const dIcon = drift.direction === 'improving' ? '&uarr;' : drift.direction === 'declining' ? '&darr;' : '&rarr;';
      const dLabel = drift.direction === 'improving' ? 'Positive trajectory detected' : drift.direction === 'declining' ? 'Declining pattern flagged' : 'Stable behavioural pattern';
      parts.push(`<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin-bottom:8px;">
        <p style="margin:0;color:#111827;font-size:12px;font-weight:600;"><span style="color:${dCol};">${dIcon}</span> ${esc(dLabel)}</p>
        <p style="margin:3px 0 0;color:#64748B;font-size:11px;">${Math.round(num(drift.first_csi))} &rarr; ${Math.round(num(drift.last_csi))} across ${sc} sessions${drift.confidence ? ` · ${esc(drift.confidence)} confidence` : ''}</p>
      </div>`);
    }
    if (mem.recurring_constructs && mem.recurring_constructs.length > 0) {
      const chips = mem.recurring_constructs.slice(0, 4).map(rc => {
        const tCol = rc.trend === 'improving' ? '#059669' : rc.trend === 'declining' ? '#DC2626' : '#D97706';
        const tIcon = rc.trend === 'improving' ? '&uarr;' : rc.trend === 'declining' ? '&darr;' : '&rarr;';
        return `<span style="display:inline-block;background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:3px 9px;margin:0 6px 6px 0;font-size:11px;color:#92400E;">${esc(String(rc.construct_key || '').split('/')[0])} <strong style="color:${tCol};">${tIcon} ${num(rc.avg_score)}</strong> ×${num(rc.frequency)}</span>`;
      }).join('');
      parts.push(`<p style="color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px;">Recurring patterns across sessions</p><div>${chips}</div>`);
    }
    const res = mem.resilience_recoveries?.[0];
    if (res) {
      parts.push(`<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:10px 12px;margin-top:8px;"><p style="margin:0;color:#065F46;font-size:11px;line-height:1.55;"><strong>Resilience detected:</strong> recovered +${num(res.rebound_points)} points after a low period on "${esc(res.concern_name)}".</p></div>`);
    }
    const gp = mem.growth_patterns?.[0];
    if (gp) {
      parts.push(`<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 12px;margin-top:8px;"><p style="margin:0;color:#1E40AF;font-size:11px;line-height:1.55;"><strong>Growth pattern:</strong> +${num(gp.improvement)} point improvement over ${num(gp.sessions_span)} sessions on "${esc(gp.concern_name)}".</p></div>`);
    }
    if (parts.length === 0) {
      parts.push(`<p style="color:#64748B;font-size:12px;line-height:1.65;margin:0;">Welcome back. Your earlier sessions are being compared to build your longitudinal behavioural profile. More insights appear as your history grows.</p>`);
    }
    sections.push(sectionWrap(`Behavioural memory · ${sc} assessment${sc > 1 ? 's' : ''}`, '#7C3AED', parts.join('')));
  }

  // ── Forecast ───────────────────────────────────────────────────────────────
  const fc = omega.forecast as {
    trajectory?: string; outlook_6_weeks?: string; outlook_3_months?: string;
    growth_probability?: number; next_milestone?: string; risk_window?: string;
    key_risk_factors?: string[]; key_growth_enablers?: string[];
  } | undefined;
  if (fc && (fc.outlook_6_weeks || fc.outlook_3_months)) {
    const trajMap: Record<string, { col: string; bg: string; bdr: string; icon: string; label: string }> = {
      improving:  { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0', icon: '&uarr;', label: 'Improving' },
      stable:     { col: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE', icon: '&rarr;', label: 'Stable' },
      plateauing: { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A', icon: '&mdash;', label: 'Plateauing' },
      declining:  { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA', icon: '&darr;', label: 'Declining' },
      volatile:   { col: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE', icon: '~', label: 'Volatile' },
    };
    const tc = trajMap[fc.trajectory || 'stable'] || trajMap.stable;
    const gp = Math.min(100, Math.max(0, num(fc.growth_probability)));
    const gpCol = gp >= 70 ? '#059669' : gp >= 50 ? '#D97706' : '#DC2626';
    const factors = (fc.key_risk_factors || []).slice(0, 3).map(rf => `<li style="color:#991B1B;font-size:11px;line-height:1.5;margin-bottom:3px;">${esc(rf)}</li>`).join('');
    const enablers = (fc.key_growth_enablers || []).slice(0, 3).map(ge => `<li style="color:#065F46;font-size:11px;line-height:1.5;margin-bottom:3px;">${esc(ge)}</li>`).join('');
    sections.push(sectionWrap('Forecast intelligence', '#7C3AED',
      `<p style="margin:0 0 10px;"><span style="display:inline-block;background:${tc.bg};color:${tc.col};border:1px solid ${tc.bdr};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${tc.icon} ${tc.label}</span> <span style="color:#475569;font-size:11px;margin-left:6px;">Growth probability <strong style="color:${gpCol};">${gp}%</strong></span></p>
       ${fc.outlook_6_weeks ? `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin-bottom:8px;"><p style="color:#94A3B8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">6-week outlook</p><p style="color:#111827;font-size:12px;line-height:1.6;margin:0;">${esc(fc.outlook_6_weeks)}</p></div>` : ''}
       ${fc.outlook_3_months ? `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin-bottom:8px;"><p style="color:#94A3B8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">3-month outlook</p><p style="color:#374151;font-size:12px;line-height:1.6;margin:0;">${esc(fc.outlook_3_months)}</p></div>` : ''}
       ${fc.next_milestone ? `<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:10px 12px;margin-bottom:8px;"><p style="color:#1D4ED8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">Next milestone</p><p style="color:#1E40AF;font-size:11px;line-height:1.55;margin:0;">${esc(fc.next_milestone)}</p></div>` : ''}
       ${fc.risk_window ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 12px;margin-bottom:8px;"><p style="color:#DC2626;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">Critical risk window</p><p style="color:#991B1B;font-size:11px;line-height:1.55;margin:0;">${esc(fc.risk_window)}</p></div>` : ''}
       ${(factors || enablers) ? `<table width="100%" cellpadding="0" cellspacing="0"><tr>
         ${factors ? `<td width="50%" style="vertical-align:top;padding-right:6px;"><p style="color:#DC2626;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">Risk factors</p><ul style="margin:0;padding-left:16px;">${factors}</ul></td>` : ''}
         ${enablers ? `<td width="50%" style="vertical-align:top;padding-left:6px;"><p style="color:#059669;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px;">Growth enablers</p><ul style="margin:0;padding-left:16px;">${enablers}</ul></td>` : ''}
       </tr></table>` : ''}`));
  }

  return sections.join('\n');
}

export async function sendOnboardingConfirmation(
  toEmail: string,
  name: string,
  entityType: string,
  trackingToken?: string
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL || 'notifications@metryxone.com';
    const safeName = escapeHtml(name || 'there');
    const safeType = escapeHtml(entityType);
    const safeToken = trackingToken ? escapeHtml(trackingToken) : '';
    const trackingBlock = safeToken
      ? `<div style="margin:16px 0 0;padding:12px 14px;background:#f1f5ff;border:1px solid #dbe4ff;border-radius:10px;">
            <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 6px;">Your tracking code</p>
            <p style="font-family:monospace;font-size:13px;color:#344E86;word-break:break-all;margin:0;">${safeToken}</p>
            <p style="color:#6b7280;font-size:11px;margin:8px 0 0;">Keep this code — you'll need it together with your email to check your application status.</p>
          </div>`
      : '';
    await transporter.sendMail({
      from: `"MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: 'We received your MetryxOne onboarding application',
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#344E86;padding:24px 32px;">
            <h1 style="color:#fff;margin:0;font-size:20px;">MetryxOne</h1>
            <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px;">Partner Onboarding</p>
          </div>
          <div style="padding:28px 32px;">
            <p style="color:#374151;font-size:15px;font-weight:600;margin:0 0 10px;">Hi ${safeName},</p>
            <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 12px;">
              Thank you — we've received your <strong>${safeType}</strong> onboarding application.
              Our team will review your details and get back to you. You can check your
              application status any time using your registered email and the tracking code below.
            </p>
            ${trackingBlock}
            <p style="color:#6b7280;font-size:12px;margin:16px 0 0;">If you didn't submit this, you can safely ignore this email.</p>
          </div>
          <div style="text-align:center;padding:14px;background:#f8f9fa;">
            <p style="color:#9ca3af;font-size:11px;margin:0;">&copy; 2026 MetryxOne</p>
          </div>
        </div>`,
    });
    return true;
  } catch (error: any) {
    console.error('Failed to send onboarding confirmation:', error?.message || error);
    return false;
  }
}

export async function sendOnboardingAdminAlert(
  toEmail: string,
  adminName: string,
  entityName: string,
  entityType: string,
  entityEmail: string
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL || 'notifications@metryxone.com';
    await transporter.sendMail({
      from: `"MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: `New onboarding application: ${entityName} (${entityType})`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:24px 28px;">
          <p style="color:#374151;font-size:15px;font-weight:600;margin:0 0 10px;">Hi ${escapeHtml(adminName || 'Admin')},</p>
          <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 12px;">A new partner onboarding application is awaiting review.</p>
          <table style="font-size:13px;color:#374151;border-collapse:collapse;">
            <tr><td style="padding:3px 10px 3px 0;color:#6b7280;">Organisation</td><td>${escapeHtml(entityName)}</td></tr>
            <tr><td style="padding:3px 10px 3px 0;color:#6b7280;">Type</td><td>${escapeHtml(entityType)}</td></tr>
            <tr><td style="padding:3px 10px 3px 0;color:#6b7280;">Email</td><td>${escapeHtml(entityEmail)}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:12px;margin:16px 0 0;">Review it in the Super Admin → Onboarding panel.</p>
        </div>`,
    });
    return true;
  } catch (error: any) {
    console.error('Failed to send onboarding admin alert:', error?.message || error);
    return false;
  }
}

export function buildCapadexReportHtml(
  name: string,
  report: CapadexReportInput
): { html: string; subject: string } {
  const normLevel = report.scoreLevel === 'Mastery' ? 'Advanced' : report.scoreLevel;
  const sc = normLevel === 'Advanced'
    ? { col: '#344E86', bg: '#EEF2FA', bdr: '#D4DBF0' }
    : normLevel === 'Proficient'
    ? { col: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE' }
    : normLevel === 'Developing'
    ? { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' }
    : { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' };

  const scoreBar = Math.max(4, Math.min(100, report.score));
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = name ? name.split(' ')[0] : 'You';

  const appUrl = process.env.APP_URL ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');
  const appBase = appUrl || 'https://metryx.one';
  const logoUrl = appUrl ? `${appUrl}/images/metryx-logo.png` : '';

  const cl = report.concernName.toLowerCase();
  const isAttn   = /attention|distract|focus|span|fidget|restless|wander/.test(cl);
  const isScreen = /screen|phone|social|gaming|internet|digital/.test(cl);
  const isCareerConcern = /career|job|role|profession|transition|stuck|workplace|employ|purpose|direction|leadership|promotion|burnout|meaning|identity/.test(cl);
  const cat = isAttn ? 'attention' : isScreen ? 'screen' : 'default';

  const nMap = NARRATIVE_MAP(escapeHtml(firstName), escapeHtml(report.concernName));

  const sortedSDs = [...report.subdomains].sort((a, b) => Number(b.avg_score) - Number(a.avg_score));
  const topSD   = sortedSDs[0];
  const focusSD = sortedSDs[sortedSDs.length - 1];
  const hasFocus = focusSD && Number(focusSD.avg_score) < 70;

  const stageCode = report.stageCode || 'CAP_CUR';
  const stageCopy = STAGE_COPY[stageCode] || STAGE_COPY['CAP_CUR'];
  const stageHdr  = STAGE_HEADER[stageCode] || STAGE_HEADER['CAP_CUR'];

  const stageNMap = nMap[stageCode] || nMap['CAP_CUR'];
  const staticComputed = stageNMap[cat]?.[normLevel] || stageNMap['default']?.[normLevel] || nMap['CAP_CUR']['default']['Developing'];

  // Dynamic report override — when dynamic_report is supplied, use its content
  // in place of the static NARRATIVE_MAP lookup. Callers only populate this
  // field when the `dynamic_reporting` feature flag is enabled.
  const dynReport = report.dynamic_report;
  const computed = (dynReport && dynReport.pattern_insights && dynReport.pattern_insights.length > 0)
    ? (() => {
        // Headline: top construct label + confidence note
        const topInsight = dynReport.pattern_insights[0];
        const headline = topInsight.hypothesis_label
          ? `${escapeHtml(topInsight.hypothesis_label)} — ${escapeHtml(dynReport.confidence_transparency.note)}`
          : staticComputed.headline;

        // Story: behavioural_summary intro + top 3 pattern_insights texts
        const topInsightTexts = dynReport.pattern_insights
          .slice(0, 3)
          .map((p, i) => `${i + 1}. ${escapeHtml(p.text)}`)
          .join('\n\n');
        const story = dynReport.behavioural_summary
          ? `${escapeHtml(dynReport.behavioural_summary)}\n\n${topInsightTexts}`
          : topInsightTexts || staticComputed.story;

        return { headline, story };
      })()
    : staticComputed;

  const scoreCtxMap = SCORE_CTX_MAP(report.score);
  const stageCtxMap = scoreCtxMap[stageCode] || scoreCtxMap['CAP_CUR'];
  const scoreCtx = stageCtxMap[normLevel] || stageCtxMap['Developing'];

  // OMEGA-X intelligence sections — empty string when no omega envelope supplied.
  const omegaSections = buildOmegaSectionsHtml(report.omega, report.telemetry);

  // Telemetry / provenance strip — always shown (independent of OMEGA-X gating).
  // Mirrors the SuperAdmin reports console: clarity source, contradiction count,
  // and run pacing. Contradiction count prefers the OMEGA-X envelope when present;
  // pacing falls back to a placeholder until persisted per-report.
  const omegaContraCount = (report.omega?.contradictions as { count?: number } | undefined)?.count;
  const provenanceStrip = buildProvenanceStripHtml(
    report.claritySource || 'master_curated',
    omegaContraCount ?? report.contradictionCount ?? 0,
    report.pacingMs ?? 1420,
  );

  const teasers = stageCopy.teasers;

  // Rich subdomain interpretation engine (email version)
  const getEmailSubdomainInsight = (domainName: string, pct: number): { label: string; interpretation: string; action: string } => {
    const n = domainName.toLowerCase().replace(/[^a-z ]/g, '').trim();
    const lvl = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
    type SI = { label: string; interp: [string,string,string,string]; action: [string,string,string,string] };
    const M: Record<string, SI> = {
      'time management': { label: 'Time Management',
        interp: [`A score of ${pct} means hours pass without clear awareness of where they went — a broken time-awareness loop, not carelessness.`,`You can plan your time but struggle to protect it. Something keeps pulling you off the planned path.`,`Time is managed reasonably well — but under pressure or fatigue the structure noticeably breaks down.`,`Time awareness is a clear strength — you protect your schedule from most disruptions reliably.`],
        action: [`Track one hour today: every 15 minutes, write what you were actually doing.`,`Pick one fixed focus block today and treat it like an unmissable appointment.`,`Review yesterday morning and find the one moment time slipped — that's the exact thing to target.`,`Stress-test your time structure by scheduling your hardest task during your weakest hour.`]},
      'cognitive inhibition': { label: 'Impulse Control',
        interp: [`A score of ${pct} means the urge overrides intention roughly 7 out of 10 times — this is a circuit-level pattern, not a character flaw.`,`You can resist the pull sometimes, but sustained resistance is exhausting. You succeed in structured settings and struggle when tired.`,`Reasonable impulse control overall — but stress, boredom, and task transitions still pull you toward distraction reliably.`,`You can resist strong urges even in adverse conditions — a rare, trainable skill.`],
        action: [`Put your phone in a different room for 2 hours. Count how many times you almost went to check it.`,`Before your next session, write down the exact trigger that usually derails you.`,`Identify your two highest-risk drift moments and pre-plan what you will do instead.`,`Practise your impulse control in extreme trigger conditions — late night, high stress — to build full robustness.`]},
      'attention endurance': { label: 'Focus Stamina',
        interp: [`A score of ${pct} means concentrated focus typically lasts under 15 minutes before drifting. Sustained deep work is currently very difficult.`,`Focus holds for 20–30 minutes but fragments after that. The ability is there; endurance is the gap.`,`Focus stamina is solid for most tasks — extended high-demand sessions still take a toll but are manageable.`,`Sustaining concentration for extended periods is a genuine strength — this directly enables deep, high-value work.`],
        action: [`Try one 15-minute focused session with no phone. Duration matters less than consistency right now.`,`Use 25-minute timer blocks with 5-minute breaks — structure matters more than willpower at this stage.`,`Extend your current focus blocks by 10% this week to build endurance incrementally.`,`Your stamina is an asset — use it on your highest-priority task first, before anything fragments your attention.`]},
      'metacognitive awareness': { label: 'Self-Monitoring',
        interp: [`A score of ${pct} means the pattern runs on autopilot — you realise you've drifted long after it started. The noticing muscle needs development.`,`You notice the pattern sometimes — but usually after it's already underway. Getting faster at catching the moment before it kicks in is the key step.`,`You're good at noticing drift. The challenge is that awareness doesn't always translate into stopping — the knowledge-action gap.`,`Self-monitoring is a genuine strength — you catch drift quickly and can describe what happened accurately.`],
        action: [`Set an alarm every 20 minutes today. Each time: "Am I doing what I planned?" Just asking starts rewiring the circuit.`,`After each task, rate your focus 1–10 and write one sentence about what pulled you off.`,`Start each session with one sentence: "I will notice when I drift and immediately…" — completing this plan makes intervention 2–3× more likely.`,`Your self-awareness is sharp — now track the exact conditions that correspond to your strongest and weakest focus periods.`]},
      'executive function': { label: 'Task Control',
        interp: [`A score of ${pct} means when tasks compete, the system struggles to sequence and prioritise them — important things get missed.`,`Task management works under moderate load but shows gaps when demands stack up.`,`Executive function is solid for most demands. Complex or high-pressure situations still create friction but are manageable.`,`Handling multiple competing demands without losing the thread is a clear strength — rare in high-demand environments.`],
        action: [`Write tomorrow's three most important tasks tonight, in order. Then do only the first one until it's done.`,`Spend 5 minutes each morning organising tasks by urgency vs importance.`,`Identify the one task you consistently avoid and schedule it first thing tomorrow.`,`Reduce your daily list to two non-negotiable items and notice what changes in your output quality.`]},
      'emotional regulation': { label: 'Emotional Control',
        interp: [`A score of ${pct} means difficult emotions — frustration, anxiety, boredom — tend to override planned behaviour. The response is fast and intense.`,`Emotions are manageable in most situations but escalate quickly when circumstances stack up.`,`Emotional regulation works well in moderate conditions — high-pressure situations still create challenges but recovery is reasonably quick.`,`Managing emotional intensity without it affecting your behaviour is a real and hard-won strength.`],
        action: [`Next time frustration rises, pause 90 seconds before acting — that window is enough to interrupt the automatic response.`,`At the end of today, identify the moment emotions most affected your decisions. What triggered it?`,`Write your three most reliable emotional triggers and one different response for each.`,`Use your emotional regulation to notice and support others — it compounds your impact.`]},
      'stress management': { label: 'Pressure Handling',
        interp: [`A score of ${pct} means under real pressure, performance drops sharply and the urge to avoid intensifies — the stress response is overriding rational thinking.`,`Stress is manageable in moderate doses but escalates quickly when conditions stack up.`,`Pressure handling is solid. You function well in most demanding situations, though sustained high-pressure environments create wear.`,`Performing well under pressure is a genuine strength — the quality that most separates high performers in competitive environments.`],
        action: [`Add one 10-minute decompression gap into your day — no phone, no tasks. Stress regulation improves with recovery, not just resistance.`,`Identify the physical sensation (tension, shallow breathing) that signals rising stress — that's your cue to pause.`,`Rate your stress at 9am, 1pm, and 6pm today and find the pattern. That data tells you exactly when you're most at risk.`,`Deliberately stress-test your pressure handling in lower-stakes situations so it holds in high-stakes ones.`]},
      'self efficacy': { label: 'Self-Belief',
        interp: [`A score of ${pct} means before attempting something, a voice says "this probably won't go well." That prediction reduces effort, which confirms itself.`,`Confidence varies by context — solid in some areas, fragile in others. That inconsistency is useful information.`,`Self-belief is generally solid. In high-stakes or unfamiliar situations, doubt surfaces but doesn't usually paralyse you.`,`Genuine confidence in your ability to figure things out is here — the foundation that allows you to take risks without needing certainty first.`],
        action: [`Write 3 things you've completed that were harder than expected. Read that list before your next challenge — evidence beats self-talk.`,`Replace "I hope this goes well" with "I've dealt with hard things before, and I'll deal with this."`,`Identify one area where confidence is high and ask what you do differently there. Apply that approach where confidence is low.`,`Your self-belief is strong — take on one challenge this week you've been postponing due to uncertainty.`]},
      'academic motivation': { label: 'Study Drive',
        interp: [`A score of ${pct} means the motivation to study has largely disconnected — something specific caused the circuit to switch off.`,`Motivation comes and goes — accessible for subjects that feel relevant, consistently absent for anything pointless or too difficult.`,`Study motivation is present most of the time. The drop-off happens under low interest or when academic pressure feels disproportionate.`,`Strong internal motivation for learning — the fuel that drives performance far beyond what external pressure alone can produce.`],
        action: [`Connect tomorrow's session to one concrete outcome that matters personally — not "I need to study" but "I need to study X because it affects Y."`,`Start your next session with 5 minutes on the part you actually find interesting. Getting into motion matters most.`,`Write the honest reason study has felt like a drag lately. Naming the real barrier is the first step to removing it.`,`Channel your study drive toward the areas with highest compounding returns, not just the areas you enjoy most.`]},
      'digital wellness': { label: 'Digital Balance',
        interp: [`A score of ${pct} means screen use is consuming far more time and bandwidth than you're aware of — phone is likely the first and last thing you touch daily.`,`You're aware screen time is a problem — but awareness isn't yet translating into consistent change.`,`Digital habits are reasonably managed — the breakdown happens in high-risk moments: boredom, stress, late night, task transitions.`,`Digital self-regulation is a genuine strength — you use technology intentionally rather than being used by it.`],
        action: [`Tonight, put your phone in a different room from where you sleep. Just tonight.`,`Set your most-used social app to greyscale — the reduced visual reward makes it significantly easier to put down.`,`Identify your highest-risk screen moment each day and plan one alternative action for exactly that moment.`,`Audit whether your screen time is creating value proportional to the time invested and adjust accordingly.`]},
      'resilience': { label: 'Bounce-Back',
        interp: [`A score of ${pct} means setbacks are taking longer to recover from than you'd like — the recovery time is affecting your willingness to try again.`,`Recovery from difficulty happens but is slower than it could be. Hard experiences leave a heavier footprint than the situation warrants.`,`Resilience is solid for most challenges. Major setbacks take time but don't usually derail the whole system.`,`Bouncing back quickly from difficulty is a genuine strength — it's what lets you keep taking risks without each failure setting you back significantly.`],
        action: [`Think of a recent setback and write one thing you learned that you wouldn't have learned otherwise. This reframing reduces emotional weight.`,`Write the self-talk that follows your setbacks, then write what you'd say to a friend in the same situation. Apply the latter to yourself.`,`Build a recovery ritual — one specific thing you do after a hard day that reliably resets your state.`,`Use your resilience deliberately — take on something where failure is possible, knowing your recovery capacity makes the risk acceptable.`]},
    };
    const km = (): SI | null => {
      if (/time.?manag|schedul|priorit/.test(n)) return M['time management'];
      if (/inhibit|impulse|self.?control|resist/.test(n)) return M['cognitive inhibition'];
      if (/endur|stamin|sustain|attention.?span/.test(n)) return M['attention endurance'];
      if (/metacog|self.?aware|self.?monitor|monitor/.test(n)) return M['metacognitive awareness'];
      if (/exec|executive/.test(n)) return M['executive function'];
      if (/emotion|mood/.test(n)) return M['emotional regulation'];
      if (/stress|pressure|anxi/.test(n)) return M['stress management'];
      if (/effica|confid|belief/.test(n)) return M['self efficacy'];
      if (/academ|study.?driv|motiv/.test(n)) return M['academic motivation'];
      if (/digital|screen|phone/.test(n)) return M['digital wellness'];
      if (/resil|bounce|recover/.test(n)) return M['resilience'];
      return null;
    };
    const f = M[n] || km();
    if (f) return { label: f.label, interpretation: f.interp[lvl], action: f.action[lvl] };
    const gi = [`A score of ${pct} in this area signals it needs the most focused attention in the overall profile.`,`This domain is in active development — awareness of the gap is there, sustained support will close it.`,`Solid performance here. There's room to grow but the foundation is working.`,`A clear strength — well-developed and able to support growth in other areas.`];
    const ga = [`Spend 5 minutes identifying one specific situation where this shows up as a problem.`,`Track this for three days and look for patterns — when does it work, when does it fail?`,`Raise the bar deliberately by trying this in a more demanding context.`,`Use this strength to compensate for areas still developing.`];
    return { label: domainName, interpretation: gi[lvl], action: ga[lvl] };
  };

  // Pattern analysis for email
  const emailScored = sortedSDs.map(sd => ({ sd, pct: Math.min(100, Math.max(0, Math.round(Number(sd.avg_score)))) }));
  const emailTop = emailScored[0];
  const emailBottom = emailScored[emailScored.length - 1];
  const ebName = (kw: string) => emailScored.find(s => s.sd.subdomain_name.toLowerCase().includes(kw));
  const eMeta   = ebName('metacog') || ebName('awareness') || ebName('monitor');
  const eInhib  = ebName('inhibit') || ebName('impulse') || ebName('control');
  const eStress = ebName('stress') || ebName('pressur');
  const eSelf   = ebName('effica') || ebName('confid');
  const eExec   = ebName('exec') || ebName('follow');
  let emailPatternName = '';
  let emailPatternDesc = '';
  if (eMeta && eInhib && eMeta.pct >= 58 && eInhib.pct < 50) {
    emailPatternName = 'The Knowledge-Action Gap';
    emailPatternDesc = `Your self-awareness score (${eMeta.pct}%) is noticeably higher than impulse control (${eInhib.pct}%). You can see the pattern clearly — but can't stop it in the moment. This is the most precisely addressable pattern in this assessment.`;
  } else if (eMeta && eInhib && eMeta.pct < 45 && eInhib.pct < 45) {
    emailPatternName = 'The Autopilot Pattern';
    emailPatternDesc = `Both self-monitoring (${eMeta.pct}%) and impulse control (${eInhib.pct}%) are below the development threshold. The behaviour runs below conscious awareness — which is why willpower alone hasn't worked. The pattern needs to be surfaced before it can be changed.`;
  } else if (eSelf && eExec && eSelf.pct < 50 && eExec.pct < 55) {
    emailPatternName = 'The Confidence-Performance Loop';
    emailPatternDesc = `Low confidence (${eSelf.pct}%) and low follow-through (${eExec.pct}%) are reinforcing each other. This self-confirming loop needs to be interrupted at the belief level first.`;
  } else if (eStress && eInhib && eStress.pct < 50 && eInhib.pct < 50) {
    emailPatternName = 'The Stress-Overflow Pattern';
    emailPatternDesc = `Pressure handling (${eStress.pct}%) and impulse control (${eInhib.pct}%) are both below threshold. Stress is overflowing into behaviour regulation — stress reduction is the entry point.`;
  } else if (emailTop && emailBottom && emailTop.pct - emailBottom.pct > 35) {
    emailPatternName = 'Clear Strengths, Clear Gaps';
    emailPatternDesc = `There is a ${emailTop.pct - emailBottom.pct}-point spread between your strongest area (${emailTop.pct}%) and your lowest (${emailBottom.pct}%). The strengths are real and usable — the gap is a specific skill that responds well to targeted development.`;
  } else {
    emailPatternName = 'Evenly Spread — System-Level Issue';
    emailPatternDesc = `All domains are in a similar performance band. The issue isn't one missing skill — it's a missing system. Consistency and structure would create the biggest shift from this baseline.`;
  }

  const domainRows = sortedSDs.map((sd, i) => {
    const pct = Math.min(100, Math.max(0, Math.round(Number(sd.avg_score))));
    const col = pct >= 70 ? '#14B8A6' : pct >= 40 ? '#F59E0B' : '#EF4444';
    const tierLabel = pct >= 70 ? 'Strength' : pct >= 40 ? 'Developing' : 'Needs Focus';
    const ins = getEmailSubdomainInsight(sd.subdomain_name, pct);
    const bg = i % 2 === 0 ? '#ffffff' : '#fafbff';
    return `
      <tr style="background:${bg};">
        <td style="padding:9px 14px 4px;color:#374151;font-size:12px;font-weight:600;border-bottom:0;">${ins.label}</td>
        <td style="padding:9px 14px 4px;border-bottom:0;" rowspan="2">
          <div style="background:#f1f5f9;border-radius:99px;height:6px;width:110px;overflow:hidden;">
            <div style="background:${col};height:6px;border-radius:99px;width:${pct}%;"></div>
          </div>
        </td>
        <td style="padding:9px 14px 4px;color:${col};font-size:13px;font-weight:700;border-bottom:0;text-align:right;">${pct}%</td>
        <td style="padding:9px 14px 4px;color:${col};font-size:10px;font-weight:600;border-bottom:0;text-align:right;white-space:nowrap;">${tierLabel}</td>
      </tr>
      <tr style="background:${bg};">
        <td colspan="3" style="padding:0 14px 9px;color:#6B7280;font-size:11px;line-height:1.6;border-bottom:1px solid #f3f4f6;">${ins.interpretation}</td>
      </tr>`; 
  }).join('');

  const teaserItems = teasers.map((t, i) => `
    <tr>
      <td style="padding:5px 0;vertical-align:top;width:22px;">
        <div style="width:18px;height:18px;border-radius:50%;background:#344E86;text-align:center;line-height:18px;color:#fff;font-size:10px;font-weight:400;">${i + 1}</div>
      </td>
      <td style="padding:5px 0 5px 6px;color:#4b5563;font-size:12px;font-weight:400;line-height:1.6;">${t}</td>
    </tr>`).join('');

  const careerBuilderServices = [
    { name: 'Role Alignment Intelligence', stage: 'Available now — Curiosity Stage', desc: 'An immediate analysis of how well your current role fits your behavioural strengths — and what the misalignment cost is in daily performance and satisfaction.', col: '#2563EB', bg: '#EFF6FF', bdr: '#BFDBFE' },
    { name: 'Competency Benchmarking', stage: 'Unlocks at Insight Stage', desc: 'Compare your specific competencies against verified industry standards for your role, sector, and seniority. See exactly where you stand — and where the gap is worth closing.', col: '#344E86', bg: '#EEF2FA', bdr: '#D4DBF0' },
    { name: 'Job Market Prediction', stage: 'Unlocks at Insight Stage', desc: 'Predictive analysis of how your behavioural profile aligns with live market demand. Identify which roles and environments are the strongest fit — and which reproduce the same friction.', col: '#0D9488', bg: '#F0FDF9', bdr: '#CCFBF1' },
    { name: 'Job Studio', stage: 'Unlocks at Growth Stage', desc: 'Profile-matched tools for CV positioning, interview preparation, and personal narrative development — all grounded in your actual behavioural strengths, not what merely sounds good on paper.', col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' },
    { name: 'Career Transition Modelling', stage: 'Unlocks at Mastery Stage', desc: 'A full simulation of potential career moves using your Mastery-stage behavioural profile as the foundation. Predict which transitions are most aligned, most risky, and most likely to produce lasting satisfaction.', col: '#7C3AED', bg: '#F5F3FF', bdr: '#DDD6FE' },
  ];
  const careerBuilderRows = careerBuilderServices.map(svc =>
    `<tr><td style="padding:0 0 10px;">
      <div style="background:${svc.bg};border:1px solid ${svc.bdr};border-radius:10px;border-left:3px solid ${svc.col};padding:12px 14px;">
        <p style="color:${svc.col};font-size:12px;font-weight:700;margin:0 0 2px;">${svc.name}</p>
        <p style="color:#9CA3AF;font-size:10px;font-weight:400;margin:0 0 6px;">${svc.stage}</p>
        <p style="color:#4A5568;font-size:11px;font-weight:400;margin:0;line-height:1.6;">${svc.desc}</p>
      </div>
    </td></tr>`
  ).join('');
  const careerBuilderSection = isCareerConcern ? `
  <!-- ── Career Builder Services ── -->
  <div style="padding:22px 28px 20px;border-top:1px solid #f1f5f9;">
    <div style="border-left:3px solid #0D9488;padding-left:10px;margin-bottom:14px;">
      <p style="color:#0D9488;font-size:11px;font-weight:700;margin:0;text-transform:uppercase;letter-spacing:0.1em;">Career Builder — MetryxOne Intelligence Services</p>
    </div>
    <p style="color:#374151;font-size:13px;font-weight:400;margin:0 0 14px;line-height:1.65;">The following services are progressively unlocked as you advance through the CAPADEX stages. Each one is built around your specific behavioural profile — not generic templates.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${careerBuilderRows}
    </table>
  </div>` : '';

  const subject = `Your ${stageHdr.label} report is ready — ${report.concernName}`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px 0;background:#f0f4f8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">

  <!-- ── Logo header — white, no ribbon ── -->
  <div style="padding:26px 28px 20px;background:#ffffff;border-bottom:2px solid #EEF2FA;text-align:left;">
    ${logoUrl
      ? `<img src="${logoUrl}" alt="MetryxOne" style="height:30px;width:auto;display:block;margin-bottom:8px;" />`
      : `<table cellpadding="0" cellspacing="0"><tr>
           <td style="vertical-align:middle;">
             <div style="width:8px;height:8px;border-radius:50%;background:#344E86;margin-right:7px;"></div>
           </td>
           <td style="vertical-align:middle;">
             <span style="color:#344E86;font-size:20px;font-weight:400;letter-spacing:-0.5px;line-height:1;">MetryxOne</span>
           </td>
         </tr></table>`
    }
    <p style="color:#94A3B8;font-size:11px;font-weight:400;margin:6px 0 0;letter-spacing:0;">Behavioural Intelligence Platform</p>
  </div>

  <!-- ── Concern title band — very light, no dark colours ── -->
  <div style="padding:18px 28px 16px;background:#EEF2FA;border-bottom:1px solid #D4DBF0;border-left:4px solid ${sc.col};">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;">
          <p style="color:#94A3B8;font-size:11px;font-weight:400;margin:0 0 4px;">${stageHdr.label} Assessment &middot; Stage ${stageHdr.stageNum} of 4</p>
          <p style="color:#1E2B4A;font-size:18px;font-weight:400;margin:0 0 3px;line-height:1.3;">${escapeHtml(report.concernName)}</p>
          <p style="color:#6B7280;font-size:12px;font-weight:400;margin:0;">Prepared for ${escapeHtml(name)}</p>
        </td>
        <td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:12px;">
          <div style="display:inline-block;background:${sc.col};border-radius:50px;padding:8px 16px;text-align:center;line-height:1;">
            <div style="color:#ffffff;font-size:22px;font-weight:400;letter-spacing:-0.5px;">${Math.round(report.score)}%</div>
            <div style="color:rgba(255,255,255,0.75);font-size:10px;font-weight:400;margin-top:2px;letter-spacing:0.3px;">${normLevel}</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- ── Greeting ── -->
  <div style="padding:24px 28px 0;">
    <p style="color:#1E2B4A;font-size:15px;font-weight:400;margin:0 0 6px;">Hi ${escapeHtml(firstName)},</p>
    <p style="color:#4A5568;font-size:13px;font-weight:400;margin:0;line-height:1.7;">
      ${stageCopy.greeting(escapeHtml(report.concernName))}
    </p>
  </div>

  <!-- ── Score section ── -->
  <div style="padding:20px 28px;border-bottom:1px solid #f1f5f9;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:88px;vertical-align:top;">
          <div style="width:80px;height:80px;border-radius:50%;background:${sc.bg};border:2px solid ${sc.col};text-align:center;line-height:1;padding-top:16px;box-sizing:border-box;">
            <div style="color:${sc.col};font-size:28px;font-weight:400;">${report.score}</div>
            <div style="color:#9ca3af;font-size:10px;font-weight:400;margin-top:2px;">/100</div>
          </div>
        </td>
        <td style="padding-left:18px;vertical-align:top;">
          <span style="display:inline-block;background:${sc.bg};color:${sc.col};border:1px solid ${sc.bdr};border-radius:20px;padding:3px 12px;font-size:12px;font-weight:400;margin-bottom:8px;">${normLevel}</span>
          <div style="background:#f1f5f9;border-radius:99px;height:5px;margin-bottom:10px;overflow:hidden;">
            <div style="background:${sc.col};height:5px;border-radius:99px;width:${scoreBar}%;"></div>
          </div>
          <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0;line-height:1.7;">${scoreCtx}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- ── Assessment finding ── -->
  <div style="padding:22px 28px 20px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid ${sc.col};padding-left:10px;margin-bottom:14px;">
      <p style="color:#344E86;font-size:12px;font-weight:400;margin:0;">Assessment finding</p>
    </div>
    <p style="color:#1E2B4A;font-size:14px;font-weight:400;margin:0 0 10px;line-height:1.55;">${computed.headline}</p>
    <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0;line-height:1.7;">${computed.story}</p>
  </div>

  ${report.behavioralArchetype ? (() => {
    const a = report.behavioralArchetype!;
    const ac = a.tone === 'positive'
      ? { col: '#059669', bg: '#ECFDF5', bdr: '#A7F3D0' }
      : a.tone === 'caution'
      ? { col: '#DC2626', bg: '#FEF2F2', bdr: '#FECACA' }
      : { col: '#D97706', bg: '#FFFBEB', bdr: '#FDE68A' };
    const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `
  <!-- ── Behavioural intelligence ── -->
  <div style="padding:20px 28px;border-bottom:1px solid #f1f5f9;">
    <div style="background:${ac.bg};border:1px solid ${ac.bdr};border-radius:8px;padding:14px 16px;">
      <p style="color:${ac.col};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 6px;">${esc(a.label)}</p>
      <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0;line-height:1.7;">${esc(a.summary)}</p>
      <p style="color:#9ca3af;font-size:10px;font-weight:400;margin:8px 0 0;">Developmental signal only — based on how you engaged, not what you scored.</p>
    </div>
  </div>` ;
  })() : ''}

  ${report.subdomains.length > 0 ? `
  <!-- ── Domain breakdown ── -->
  <div style="padding:22px 28px 18px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid #344E86;padding-left:10px;margin-bottom:14px;">
      <p style="color:#344E86;font-size:12px;font-weight:700;margin:0;">Cognitive profile — what each score means</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #f1f5f9;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f8faff;">
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:#9ca3af;font-weight:400;border-bottom:1px solid #f1f5f9;">Domain</th>
          <th style="padding:8px 14px;text-align:left;font-size:11px;color:#9ca3af;font-weight:400;border-bottom:1px solid #f1f5f9;">Score</th>
          <th style="padding:8px 14px;text-align:right;font-size:11px;color:#9ca3af;font-weight:400;border-bottom:1px solid #f1f5f9;">%</th>
          <th style="padding:8px 14px;text-align:right;font-size:11px;color:#9ca3af;font-weight:400;border-bottom:1px solid #f1f5f9;">Band</th>
        </tr>
      </thead>
      <tbody>${domainRows}</tbody>
    </table>
    <!-- Performance scale -->
    <div style="margin-top:14px;">
      <p style="color:#9ca3af;font-size:10px;font-weight:400;margin:0 0 6px;">Performance scale</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:40%;background:#EF4444;height:4px;border-radius:4px 0 0 4px;"></td>
          <td style="width:20%;background:#F59E0B;height:4px;"></td>
          <td style="width:20%;background:#3B82F6;height:4px;"></td>
          <td style="width:20%;background:#344E86;height:4px;border-radius:0 4px 4px 0;"></td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
        <tr>
          <td style="width:40%;text-align:center;color:#EF4444;font-size:10px;font-weight:400;">Emerging 0–39</td>
          <td style="width:20%;text-align:center;color:#F59E0B;font-size:10px;font-weight:400;">Developing 40–59</td>
          <td style="width:20%;text-align:center;color:#3B82F6;font-size:10px;font-weight:400;">Proficient 60–79</td>
          <td style="width:20%;text-align:center;color:#344E86;font-size:10px;font-weight:400;">Advanced 80–100</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- ── Pattern analysis ── -->
  ${emailPatternName ? `
  <div style="padding:22px 28px 18px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid #344E86;padding-left:10px;margin-bottom:14px;">
      <p style="color:#344E86;font-size:12px;font-weight:700;margin:0;">Behavioural pattern detected</p>
    </div>
    <div style="background:#EEF2FA;border:1px solid #D4DBF0;border-radius:10px;padding:16px 18px;margin-bottom:16px;">
      <p style="color:#1E2B4A;font-size:14px;font-weight:700;margin:0 0 8px;">${emailPatternName}</p>
      <p style="color:#374151;font-size:12px;font-weight:400;margin:0;line-height:1.7;">${emailPatternDesc}</p>
    </div>
    ${emailTop && emailBottom ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:8px;">
          <div style="background:#F0FDF9;border:1px solid #99F6E4;border-radius:8px;padding:12px 14px;">
            <p style="color:#0F766E;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 6px;">Standout Strength · ${emailTop.pct}%</p>
            <p style="color:#111827;font-size:13px;font-weight:700;margin:0 0 6px;">${getEmailSubdomainInsight(emailTop.sd.subdomain_name, emailTop.pct).label}</p>
            <p style="color:#374151;font-size:11px;font-weight:400;margin:0;line-height:1.6;">${getEmailSubdomainInsight(emailTop.sd.subdomain_name, emailTop.pct).interpretation}</p>
          </div>
        </td>
        <td style="width:50%;vertical-align:top;padding-left:8px;">
          <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:12px 14px;">
            <p style="color:#DC2626;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 6px;">Priority Focus · ${emailBottom.pct}%</p>
            <p style="color:#111827;font-size:13px;font-weight:700;margin:0 0 6px;">${getEmailSubdomainInsight(emailBottom.sd.subdomain_name, emailBottom.pct).label}</p>
            <p style="color:#374151;font-size:11px;font-weight:400;margin:0;line-height:1.6;">${getEmailSubdomainInsight(emailBottom.sd.subdomain_name, emailBottom.pct).interpretation}</p>
          </div>
        </td>
      </tr>
    </table>` : ''}
  </div>

  <!-- ── Where to start ── -->
  <div style="padding:22px 28px 18px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid #059669;padding-left:10px;margin-bottom:14px;">
      <p style="color:#059669;font-size:12px;font-weight:700;margin:0;">Where to start this week</p>
    </div>
    <p style="color:#6B7280;font-size:12px;font-weight:400;margin:0 0 14px;line-height:1.6;">Based on your lowest-scoring domains — these three actions are most likely to move the needle. Start with the first one today.</p>
    ${[...emailScored].sort((a,b) => a.pct - b.pct).slice(0,3).map((s, idx) => {
      const ins = getEmailSubdomainInsight(s.sd.subdomain_name, s.pct);
      return `
    <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="vertical-align:top;width:26px;">
          <div style="width:22px;height:22px;border-radius:50%;background:#344E86;text-align:center;line-height:22px;color:#fff;font-size:11px;font-weight:700;">${idx+1}</div>
        </td>
        <td style="padding-left:10px;vertical-align:top;">
          <p style="color:#9CA3AF;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;margin:0 0 4px;">${ins.label} · ${s.pct}%</p>
          <p style="color:#111827;font-size:13px;font-weight:400;margin:0;line-height:1.6;">${ins.action}</p>
        </td>
      </tr>
    </table>`;
    }).join('')}
  </div>` : ''}` : `
  <!-- ── No subdomain data — profile available in full report ── -->
  <div style="padding:22px 28px 18px;border-bottom:1px solid #f1f5f9;">
    <div style="background:#EEF2FA;border:1px solid #D4DBF0;border-radius:10px;padding:16px 20px;display:flex;align-items:flex-start;gap:12px;">
      <div style="width:32px;height:32px;border-radius:50%;background:#344E86;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:14px;font-weight:700;">&#9432;</span>
      </div>
      <div>
        <p style="color:#1E2B4A;font-size:13px;font-weight:600;margin:0 0 4px;">Your overall score is <span style="color:${sc.col};font-weight:700;">${Math.round(report.score)}%</span> — the complete domain breakdown is ready in your report</p>
        <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0;line-height:1.65;">The full domain breakdown, subdomain scores, and cognitive profile map are ready to view in your personalised report.${report.reportUrl ? ' Click the button below to access the full analysis.' : ''}</p>
      </div>
    </div>
  </div>`}

  ${(topSD || hasFocus) ? `
  <!-- ── Key findings ── -->
  <div style="padding:22px 28px 18px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid #344E86;padding-left:10px;margin-bottom:14px;">
      <p style="color:#344E86;font-size:12px;font-weight:400;margin:0;">Key findings</p>
    </div>
    ${topSD ? `
    <div style="background:#F0FDF9;border:1px solid #A7F3D0;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
      <p style="color:#14B8A6;font-size:11px;font-weight:400;margin:0 0 4px;">Standout strength</p>
      <p style="color:#1E2B4A;font-size:13px;font-weight:400;margin:0 0 4px;">${topSD.subdomain_name}</p>
      <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0;line-height:1.6;">Score: ${Math.round(Number(topSD.avg_score))}% — This is a genuine strength in the overall profile and provides a strong foundation for the next stage of development.</p>
    </div>` : ''}
    ${hasFocus ? `
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 16px;">
      <p style="color:#D97706;font-size:11px;font-weight:400;margin:0 0 4px;">Focus area</p>
      <p style="color:#1E2B4A;font-size:13px;font-weight:400;margin:0 0 4px;">${focusSD.subdomain_name}</p>
      <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0;line-height:1.6;">Score: ${Math.round(Number(focusSD.avg_score))}% — This area has the highest growth potential. With targeted support here, the most immediate and measurable change becomes possible.</p>
    </div>` : ''}
  </div>` : ''}

  ${(report.recommendations && report.recommendations.length > 0) ? `
  <!-- ── Your Action Plan ── -->
  <div style="padding:22px 28px 20px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid #344E86;padding-left:10px;margin-bottom:4px;">
      <p style="color:#344E86;font-size:12px;font-weight:400;margin:0;">Your ${report.stageLabel} action plan</p>
    </div>
    <p style="color:#6B7280;font-size:11px;font-weight:400;margin:0 0 14px;">${report.actionPlanSubtitle || 'Personalised guidance based on your behavioural profile'}</p>
    ${report.recommendations.map((rec, i) => {
      const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const typeLabel = (rec.rec_type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Recommendation';
      const domainLabel = (rec.domain || '').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const bg = i === 0 ? '#F0F4FF' : i === 1 ? '#F0FDF9' : '#FFFBEB';
      const bdr = i === 0 ? '#C7D4FB' : i === 1 ? '#A7F3D0' : '#FDE68A';
      const accent = i === 0 ? '#344E86' : i === 1 ? '#14B8A6' : '#D97706';
      return `
    <div style="background:${bg};border:1px solid ${bdr};border-radius:10px;padding:14px 16px;margin-bottom:10px;border-left:3px solid ${accent};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="display:inline-block;background:${accent};color:#fff;font-size:9px;font-weight:400;padding:2px 8px;border-radius:20px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">${esc(typeLabel)}${domainLabel ? ' · ' + esc(domainLabel) : ''}</div>
          </td>
          <td style="text-align:right;vertical-align:top;">
            <span style="color:#9ca3af;font-size:11px;font-weight:400;">${i + 1} of ${report.recommendations!.length}</span>
          </td>
        </tr>
      </table>
      <p style="color:#1E2B4A;font-size:13px;font-weight:400;margin:0 0 6px;line-height:1.5;">${esc(rec.title)}</p>
      ${rec.expected_outcome ? `<p style="color:#4A5568;font-size:11px;font-weight:400;margin:0;line-height:1.6;"><span style="color:${accent};font-size:10px;">Expected outcome: </span>${esc(rec.expected_outcome)}</p>` : ''}
    </div>`;
    }).join('')}
  </div>` : ''}

  ${omegaSections}

  ${provenanceStrip}

  ${report.reportUrl ? `
  <!-- ── View full report ── -->
  <div style="padding:14px 28px;border-bottom:1px solid #f1f5f9;text-align:center;">
    <a href="${report.reportUrl}" style="display:inline-block;background:#ffffff;color:#344E86;font-size:12px;font-weight:400;padding:10px 28px;border-radius:8px;text-decoration:none;border:1px solid #344E86;">View your full report &rarr;</a>
  </div>` : ''}

  <!-- ── What comes next ── -->
  <div style="padding:22px 28px 20px;border-bottom:1px solid #f1f5f9;">
    <div style="border-left:3px solid #344E86;padding-left:10px;margin-bottom:14px;">
      <p style="color:#344E86;font-size:12px;font-weight:400;margin:0;">What comes next — your path to change</p>
    </div>
    <p style="color:#1E2B4A;font-size:14px;font-weight:400;margin:0 0 10px;line-height:1.55;">${stageCopy.sectionHeadline}</p>
    <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0 0 14px;line-height:1.7;">${stageCopy.sectionBody}</p>
    <p style="color:#344E86;font-size:12px;font-weight:400;margin:0 0 10px;">${stageCopy.teaserIntro}</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${teaserItems}
    </table>
  </div>

  <!-- ── CTA ── -->
  <div style="margin:20px 28px 8px;background:#EEF2FA;border:1px solid #D4DBF0;border-radius:10px;padding:20px 22px;border-left:4px solid #344E86;">
    <p style="color:#1E2B4A;font-size:14px;font-weight:400;margin:0 0 8px;">${stageCopy.ctaHeadline}</p>
    <p style="color:#4A5568;font-size:12px;font-weight:400;margin:0 0 14px;line-height:1.7;">
      ${stageCopy.ctaBody(escapeHtml(report.concernName))}
    </p>
    <a href="${appBase}${stageCopy.nextStageUrl(report.concernName)}" style="display:inline-block;background:#344E86;color:#ffffff;font-size:12px;font-weight:400;padding:10px 22px;border-radius:8px;text-decoration:none;">${stageCopy.ctaButton}</a>
  </div>

  ${careerBuilderSection}

  <!-- ── Sign-off ── -->
  <div style="padding:20px 28px 4px;">
    <p style="color:#4A5568;font-size:13px;font-weight:400;margin:0;line-height:1.7;font-style:italic;">${stageCopy.signOff}</p>
    <p style="color:#94A3B8;font-size:12px;font-weight:400;margin:10px 0 0;">${stageCopy.teamSignOff}</p>
  </div>

  <!-- ── Meta + Disclaimer ── -->
  <div style="padding:16px 28px 20px;">
    <p style="color:#c4cad4;font-size:10px;font-weight:400;margin:0 0 10px;line-height:1.8;">
      Report ID: ${report.reportId.slice(0,8).toUpperCase()} &nbsp;&middot;&nbsp; Generated ${date} &nbsp;&middot;&nbsp; Confidential &nbsp;&middot;&nbsp; DPDP Compliant
    </p>
    <p style="color:#c4cad4;font-size:9.5px;font-weight:400;margin:0;line-height:1.7;border-top:1px solid #f3f4f6;padding-top:10px;">
      <strong style="color:#b0b8c8;">Disclaimer:</strong> This report is for informational and personal development purposes only. It does not constitute a clinical diagnosis, medical advice, or professional psychological assessment. Scores reflect self-reported responses at the time of assessment. Seek professional guidance before making significant decisions based on these results. All data is processed in accordance with India's Digital Personal Data Protection (DPDP) Act 2023 and is kept strictly confidential. &copy; ${new Date().getFullYear()} MetryxOne Pvt. Ltd. All rights reserved.
    </p>
  </div>

  <!-- ── Footer ── -->
  <div style="background:#f8faff;padding:14px 28px;border-top:1px solid #f1f5f9;text-align:center;">
    <p style="color:#c4cad4;font-size:10px;font-weight:400;margin:0;">MetryxOne &nbsp;&middot;&nbsp; Behavioural Intelligence Platform &nbsp;&middot;&nbsp; metryx.one</p>
  </div>

</div>
</body>
</html>
  `;
  return { html, subject };
}

export async function sendCapadexReport(
  toEmail: string,
  name: string,
  report: CapadexReportInput,
  pdfBase64?: string
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const { html, subject } = buildCapadexReportHtml(name, report);

    // Build optional PDF attachment — strip data URI prefix if present
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    if (pdfBase64) {
      const raw = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
      const safeName = (report.concernName || 'Report').replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      const reportShortId = (report.reportId || '').slice(0,8).toUpperCase();
      attachments.push({
        filename: `MetryxOne_${report.stageLabel || 'Curiosity'}_${safeName}_${reportShortId}.pdf`,
        content: Buffer.from(raw, 'base64'),
        contentType: 'application/pdf',
      });
    }

    await transporter.sendMail({
      from: `"MetryxOne Reports" <${fromEmail}>`,
      to: toEmail,
      subject,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    console.log(`CAPADEX report emailed to ${toEmail}${attachments.length > 0 ? ' (with PDF attachment)' : ''}`);
    return true;
  } catch (error: any) {
    console.error('Failed to send CAPADEX report email:', error?.message || error);
    return false;
  }
}

export async function sendCounsellorAssignmentAlert(params: {
  counsellorEmail: string;
  counsellorName: string;
  escalation: {
    id: string;
    user_email: string;
    escalation_type: string;
    severity: string;
    trigger_reason?: string;
  };
  assignedBy: string;
}): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const { counsellorEmail, counsellorName, escalation, assignedBy } = params;
    const sevColor =
      escalation.severity === 'critical' ? '#DC2626'
      : escalation.severity === 'high' ? '#D97706'
      : '#6366F1';
    const typeLabel = (escalation.escalation_type || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    await transporter.sendMail({
      from: `"MetryxOne RIE" <${fromEmail}>`,
      to: counsellorEmail,
      subject: `[${escalation.severity?.toUpperCase()}] Crisis Case Assigned — Action Required`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="background:#344E86;border-radius:12px 12px 0 0;padding:20px 28px;">
    <h1 style="color:white;margin:0;font-size:18px;">Crisis Case Assigned to You</h1>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:12px;">MetryxOne RIE — Counsellor Assignment</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px 28px;background:#f8faff;">
    <p style="color:#374151;font-size:14px;margin:0 0 20px;">Hi ${escapeHtml(counsellorName || 'Counsellor')},<br><br>
    A crisis escalation has been assigned to you and requires your immediate attention.</p>
    <div style="background:white;border-radius:10px;border-left:4px solid ${sevColor};padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Escalation Type</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1f2937;">${typeLabel}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#6b7280;width:140px;">User</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(escalation.user_email)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Severity</td><td><span style="font-weight:700;color:${sevColor};text-transform:uppercase;">${escalation.severity}</span></td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Trigger</td><td style="color:#374151;">${escapeHtml(escalation.trigger_reason || 'Auto-detected')}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Assigned by</td><td style="color:#374151;">${escapeHtml(assignedBy)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="color:#374151;">${new Date().toLocaleString()}</td></tr>
    </table>
    <div style="margin-top:20px;padding:14px;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
      <p style="color:#991B1B;font-size:13px;margin:0;font-weight:600;">⚠️ Please reach out to this user as soon as possible. Log in to the admin panel to view full details.</p>
    </div>
    <div style="margin-top:16px;text-align:center;">
      <a href="https://metryx.one/admin" style="display:inline-block;background:#344E86;color:white;text-decoration:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;">Open Admin Panel →</a>
    </div>
  </div>
  <p style="text-align:center;color:#c4cad4;font-size:10px;margin-top:12px;">MetryxOne · RIE Crisis Alert · Escalation ID: ${escalation.id?.slice(0,8)}</p>
</div>`,
    });
    console.log(`[rie] Counsellor assignment email sent to ${counsellorEmail} for escalation ${escalation.id}`);
    return true;
  } catch (error: any) {
    console.error('[rie] Failed to send counsellor assignment email:', error?.message || error);
    return false;
  }
}

export async function sendCrisisEscalationAlert(escalation: {
  id: string;
  user_email: string;
  escalation_type: string;
  severity: string;
  trigger_reason?: string;
  requires_counsellor?: boolean;
  created_at?: string;
}): Promise<boolean> {
  const adminEmail = process.env.ZOHO_EMAIL;
  if (!adminEmail) return false;
  try {
    const transporter = getTransporter();
    const sevColor = escalation.severity === 'critical' ? '#DC2626' : escalation.severity === 'high' ? '#D97706' : '#6B7280';
    const typeLabel = (escalation.escalation_type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await transporter.sendMail({
      from: `"MetryxOne RIE" <${adminEmail}>`,
      to: adminEmail,
      subject: `🚨 [${escalation.severity?.toUpperCase()}] Crisis Escalation — Mandatory Review Required`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="background:#344E86;border-radius:12px 12px 0 0;padding:20px 28px;display:flex;align-items:center;gap:12px;">
    <span style="font-size:28px;">🚨</span>
    <div>
      <h1 style="color:white;margin:0;font-size:18px;">Crisis Escalation Alert</h1>
      <p style="color:rgba(255,255,255,0.7);margin:2px 0 0;font-size:12px;">MetryxOne RIE — Mandatory Human Review</p>
    </div>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px 28px;background:#f8faff;">
    <div style="background:white;border-radius:10px;border-left:4px solid ${sevColor};padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Escalation Type</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1f2937;">${typeLabel}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#6b7280;width:140px;">User</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(escalation.user_email)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Severity</td><td><span style="font-weight:700;color:${sevColor};text-transform:uppercase;">${escalation.severity}</span></td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Trigger</td><td style="color:#374151;">${escapeHtml(escalation.trigger_reason || 'Auto-detected')}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Counsellor</td><td style="color:#374151;">${escalation.requires_counsellor ? '✅ Required' : 'Not required'}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="color:#374151;">${new Date().toLocaleString()}</td></tr>
    </table>
    <div style="margin-top:20px;padding:14px;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA;">
      <p style="color:#991B1B;font-size:13px;margin:0;font-weight:600;">⚠️ This escalation requires mandatory human review. Please log in to the admin panel immediately.</p>
    </div>
    <div style="margin-top:16px;text-align:center;">
      <a href="https://metryx.one/admin" style="display:inline-block;background:#344E86;color:white;text-decoration:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:600;">Open Admin Panel →</a>
    </div>
  </div>
  <p style="text-align:center;color:#c4cad4;font-size:10px;margin-top:12px;">MetryxOne · RIE Crisis Alert · Escalation ID: ${escalation.id?.slice(0,8)}</p>
</div>`,
    });
    console.log(`[rie] Crisis escalation email sent (escalation ${escalation.id?.slice(0, 8)}, severity ${escalation.severity})`);
    return true;
  } catch (error: any) {
    console.error('[rie] Failed to send crisis alert email:', error?.message || error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Confirmation Emails
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentConfirmationUserParams {
  toEmail:      string;
  name:         string;
  stageName:    string;
  stageCode:    string;
  concernName:  string;
  amountRupees: number;
  paymentId:    string;
  orderId:      string;
}

const STAGE_COLOR: Record<string, string> = {
  CAP_INS: '#10B981',
  CAP_GRW: '#F59E0B',
  CAP_MAS: '#8B5CF6',
};

const STAGE_NEXT_MSG: Record<string, string> = {
  CAP_INS: 'Return to MetryxOne and open your Insight report to see the root-cause analysis of your pattern.',
  CAP_GRW: 'Return to MetryxOne and open your Growth plan — your personalised 30-day behaviour-change strategy is ready.',
  CAP_MAS: 'Return to MetryxOne to access your full Mastery profile and schedule your 1-on-1 analyst debrief.',
};

export async function sendPaymentConfirmationUser(p: PaymentConfirmationUserParams): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail   = process.env.ZOHO_EMAIL!;
    const color       = STAGE_COLOR[p.stageCode] || '#344E86';
    const nextMsg     = STAGE_NEXT_MSG[p.stageCode] || 'Return to MetryxOne to continue your assessment journey.';

    await transporter.sendMail({
      from:    `"MetryxOne" <${fromEmail}>`,
      to:      p.toEmail,
      subject: `✅ Payment Confirmed — ${p.stageName} Stage Unlocked | MetryxOne`,
      html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:#344E86;padding:28px 32px 20px;">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">MetryxOne</h1>
    <p style="color:rgba(255,255,255,0.65);margin:4px 0 0;font-size:12px;">Behavioral Intelligence Platform</p>
  </div>

  <div style="padding:32px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:${color}18;border:2px solid ${color}40;border-radius:50%;width:60px;height:60px;line-height:60px;font-size:28px;">✅</div>
    </div>

    <p style="color:#374151;font-size:15px;font-weight:600;margin:0 0 6px;">Hi ${escapeHtml(p.name || 'there')},</p>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.6;">
      Your payment of <strong style="color:#111827;">₹${p.amountRupees}</strong> for the
      <strong style="color:${color};">${p.stageName} Stage</strong> has been confirmed.
      Your assessment is now unlocked.
    </p>

    <div style="background:${color}0D;border:1.5px solid ${color}30;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="color:${color};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">What's Unlocked</p>
      <p style="color:#374151;font-size:14px;margin:0 0 8px;font-weight:600;">${escapeHtml(p.stageName)} Stage — "${escapeHtml(p.concernName)}"</p>
      <p style="color:#6b7280;font-size:13px;margin:0;line-height:1.6;">${nextMsg}</p>
    </div>

    <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:28px;">
      <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 10px;">Payment Details</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="color:#6b7280;padding:3px 0;width:40%;">Amount</td><td style="color:#111827;font-weight:600;">₹${p.amountRupees}</td></tr>
        <tr><td style="color:#6b7280;padding:3px 0;">Stage</td><td style="color:#111827;">${p.stageName}</td></tr>
        <tr><td style="color:#6b7280;padding:3px 0;">Concern</td><td style="color:#111827;">${escapeHtml(p.concernName || 'N/A')}</td></tr>
        <tr><td style="color:#6b7280;padding:3px 0;">Payment ID</td><td style="color:#111827;font-family:monospace;font-size:11px;">${p.paymentId}</td></tr>
      </table>
    </div>

    <div style="text-align:center;">
      <a href="https://metryx.one" style="display:inline-block;background:#344E86;color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;">Continue Your Journey →</a>
    </div>
  </div>

  <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #f3f4f6;">
    <p style="color:#9ca3af;font-size:10px;margin:0;">
      Questions? Reply to this email or contact support@metryxone.com<br>
      &copy; 2026 MetryxOne · DPDP Compliant · <a href="https://metryx.one" style="color:#9ca3af;">metryx.one</a>
    </p>
  </div>
</div>`,
    });

    console.log(`[payment] Confirmation email sent to ${p.toEmail} for ${p.stageName}`);
    return true;
  } catch (error: any) {
    console.error('[payment] Failed to send user confirmation:', error?.message || error);
    return false;
  }
}

export interface PaymentConfirmationAdminParams {
  adminEmail:   string;
  userEmail:    string;
  name:         string;
  stageName:    string;
  stageCode:    string;
  concernName:  string;
  amountRupees: number;
  paymentId:    string;
  orderId:      string;
  phone:        string | null;
}

export async function sendPaymentConfirmationAdmin(p: PaymentConfirmationAdminParams): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail   = process.env.ZOHO_EMAIL!;
    const color       = STAGE_COLOR[p.stageCode] || '#344E86';

    await transporter.sendMail({
      from:    `"MetryxOne Payments" <${fromEmail}>`,
      to:      p.adminEmail,
      subject: `💰 New Payment — ${p.stageName} Stage · ₹${p.amountRupees} · ${p.name || p.userEmail}`,
      html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:#1e293b;padding:20px 28px;">
    <h1 style="color:#fff;margin:0;font-size:17px;font-weight:700;">MetryxOne · Payment Alert</h1>
    <p style="color:rgba(255,255,255,0.5);margin:3px 0 0;font-size:11px;">Admin notification — do not reply</p>
  </div>

  <div style="padding:28px;">
    <div style="background:${color}0D;border-left:4px solid ${color};border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:24px;">
      <p style="color:${color};font-size:13px;font-weight:700;margin:0 0 4px;">₹${p.amountRupees} received for ${p.stageName} Stage</p>
      <p style="color:#6b7280;font-size:12px;margin:0;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
    </div>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="color:#9ca3af;padding:8px 0;width:38%;">User Name</td><td style="color:#111827;font-weight:600;">${escapeHtml(p.name || '—')}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="color:#9ca3af;padding:8px 0;">Email</td><td style="color:#111827;">${escapeHtml(p.userEmail)}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="color:#9ca3af;padding:8px 0;">Phone</td><td style="color:#111827;">${escapeHtml(p.phone || 'Not provided')}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="color:#9ca3af;padding:8px 0;">Stage</td><td style="color:${color};font-weight:600;">${p.stageName}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="color:#9ca3af;padding:8px 0;">Concern</td><td style="color:#111827;">${escapeHtml(p.concernName || 'N/A')}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="color:#9ca3af;padding:8px 0;">Amount</td><td style="color:#111827;font-weight:700;">₹${p.amountRupees}</td></tr>
      <tr style="border-bottom:1px solid #f3f4f6;"><td style="color:#9ca3af;padding:8px 0;">Payment ID</td><td style="color:#111827;font-family:monospace;font-size:11px;">${p.paymentId}</td></tr>
      <tr><td style="color:#9ca3af;padding:8px 0;">Order ID</td><td style="color:#111827;font-family:monospace;font-size:11px;">${p.orderId}</td></tr>
    </table>

    <div style="text-align:center;">
      <a href="https://metryx.one/admin" style="display:inline-block;background:#344E86;color:#fff;text-decoration:none;padding:11px 28px;border-radius:9px;font-size:13px;font-weight:700;">View in Admin Panel →</a>
    </div>
  </div>

  <div style="background:#f9fafb;padding:12px 28px;text-align:center;border-top:1px solid #f3f4f6;">
    <p style="color:#9ca3af;font-size:10px;margin:0;">MetryxOne Payment Notification &nbsp;·&nbsp; &copy; 2026 MetryxOne</p>
  </div>
</div>`,
    });

    console.log(`[payment] Admin notification sent to ${p.adminEmail} for ${p.stageName} (₹${p.amountRupees})`);
    return true;
  } catch (error: any) {
    console.error('[payment] Failed to send admin notification:', error?.message || error);
    return false;
  }
}

// ─── EI Drop Alert ─────────────────────────────────────────────────────────
// Fires when a user's Employability Index score drops ≥ 5 points between
// two consecutive snapshots. Non-blocking fire-and-forget from ei-resolution.ts.

export async function sendEIDropAlert(
  toEmail:   string,
  prevScore: number,
  newScore:  number,
  drop:      number,
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail   = process.env.ZOHO_EMAIL!;
    const html = `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:#0B3C5D;padding:22px 28px;">
    <h1 style="color:#fff;margin:0;font-size:17px;font-weight:700;">Employability Index Alert</h1>
    <p style="color:rgba(255,255,255,0.55);margin:4px 0 0;font-size:12px;">Your EI score changed significantly</p>
  </div>
  <div style="padding:28px;">
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;text-align:center;background:#F8FAFC;border-radius:12px;padding:18px;border:1px solid #E2E8F0;">
        <p style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Previous</p>
        <p style="font-size:36px;font-weight:800;color:#0B3C5D;margin:0;line-height:1;">${prevScore}</p>
      </div>
      <div style="flex:1;text-align:center;background:#FEF2F2;border-radius:12px;padding:18px;border:1px solid #FECACA;">
        <p style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Current</p>
        <p style="font-size:36px;font-weight:800;color:#EF4444;margin:0;line-height:1;">${newScore}</p>
        <p style="font-size:12px;color:#EF4444;margin:6px 0 0;font-weight:600;">&#9660; ${drop} points</p>
      </div>
    </div>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 16px;">
      Your Employability Index has dropped by <strong>${drop} points</strong>. This typically reflects a recent change in your assessed profile or assessment results.
    </p>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px;">
      Open your <strong>Career Dashboard → Interventions tab</strong> to see personalised actions ranked by expected EI recovery impact.
    </p>
    <p style="font-size:11px;color:#CBD5E1;margin:0;">
      This is an automated alert from the MetryxOne Employability Intelligence system. You are receiving this because a significant change was detected in your EI snapshot.
    </p>
  </div>
</div>
    `.trim();

    await transporter.sendMail({
      from:    `"MetryxOne Intelligence" <${fromEmail}>`,
      to:      toEmail,
      subject: `Your Employability Index dropped by ${drop} points`,
      html,
    });
    return true;
  } catch (e) {
    console.warn('[email] sendEIDropAlert failed:', (e as Error).message);
    return false;
  }
}

export async function sendAssessmentEmail(params: {
  toEmail: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
}): Promise<boolean> {
  try {
    const { toEmail, candidateName, jobTitle, companyName } = params;
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const baseUrl = process.env.APP_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://app.metryxone.com');
    // Deep-link that opens the behavioural assessment with the candidate's email
    // pre-bound. Completing it with this email lets the employer intelligence bridge
    // attach the results back to this candidate (capadex_sessions.guest_email join).
    const assessmentLink = `${baseUrl}/?assess=1&email=${encodeURIComponent(toEmail)}`;

    await transporter.sendMail({
      from: `"${companyName} via MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: `${companyName} invited you to complete a behavioural assessment`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:24px 20px;background:#344E86;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">MetryxOne</h1>
    <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px;">Behavioural Intelligence Assessment</p>
  </div>
  <div style="padding:28px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;">
    <p style="color:#374151;font-size:14px;margin:0 0 16px;">Hi ${escapeHtml(candidateName)},</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px;">
      <strong>${escapeHtml(companyName)}</strong> has invited you to complete a short behavioural assessment as part of your application for the
      <strong>${escapeHtml(jobTitle)}</strong> role.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">
      This assessment takes approximately <strong>8–12 minutes</strong> and helps the hiring team understand your strengths, working style, and potential — beyond just your CV.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${assessmentLink}" style="display:inline-block;padding:14px 32px;background:#344E86;color:#fff;font-weight:bold;font-size:14px;border-radius:10px;text-decoration:none;">
        Start Your Assessment →
      </a>
    </div>
    <div style="padding:12px 16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;margin-bottom:16px;">
      <p style="color:#1e40af;font-size:12px;margin:0;"><strong>Your results are confidential.</strong> MetryxOne never shares raw data — only aggregated insights are visible to employers.</p>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
      Powered by MetryxOne Behavioural Intelligence · <a href="${baseUrl}" style="color:#9ca3af;">${baseUrl}</a>
    </p>
  </div>
</div>`.trim(),
    });
    return true;
  } catch (e) {
    console.warn('[email] sendAssessmentEmail failed:', (e as Error).message);
    return false;
  }
}

export async function sendOfferLetterEmail(params: {
  toEmail: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  ctcStr: string;
  currency: string;
  joiningDate: string;
  validity: string;
  notes: string;
}): Promise<boolean> {
  try {
    const { toEmail, candidateName, jobTitle, companyName, ctcStr, joiningDate, validity, notes } = params;
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const baseUrl = process.env.APP_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://app.metryxone.com');

    await transporter.sendMail({
      from: `"${companyName}" <${fromEmail}>`,
      to: toEmail,
      subject: `Offer Letter — ${jobTitle} at ${companyName}`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:28px 24px;background:#344E86;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0 0 4px;font-size:22px;">${escapeHtml(companyName)}</h1>
    <p style="color:rgba(255,255,255,0.75);margin:0;font-size:13px;">Offer of Employment</p>
  </div>
  <div style="padding:32px 28px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:15px;color:#374151;margin:0 0 20px;">Dear <strong>${escapeHtml(candidateName)}</strong>,</p>
    <p style="font-size:14px;color:#374151;margin:0 0 20px;">
      We are delighted to extend this offer of employment for the position of <strong>${escapeHtml(jobTitle)}</strong> at <strong>${escapeHtml(companyName)}</strong>.
    </p>
    <div style="background:#f9fafb;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 0;color:#6b7280;font-weight:600;width:40%;">Position</td>
          <td style="padding:8px 0;color:#111827;font-weight:600;">${escapeHtml(jobTitle)}</td>
        </tr>
        ${ctcStr ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;font-weight:600;">Total Compensation</td><td style="padding:8px 0;color:#059669;font-weight:700;">${escapeHtml(ctcStr)}</td></tr>` : ''}
        ${joiningDate ? `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#6b7280;font-weight:600;">Joining Date</td><td style="padding:8px 0;color:#111827;">${escapeHtml(joiningDate)}</td></tr>` : ''}
        ${validity ? `<tr><td style="padding:8px 0;color:#6b7280;font-weight:600;">Offer Valid Until</td><td style="padding:8px 0;color:#dc2626;">${escapeHtml(validity)}</td></tr>` : ''}
      </table>
    </div>
    ${notes ? `<div style="padding:14px 18px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;margin-bottom:20px;"><p style="font-size:13px;color:#92400e;margin:0;">${escapeHtml(notes)}</p></div>` : ''}
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">
      To accept this offer, please reply to this email or contact your HR representative. Please review all terms carefully before accepting.
    </p>
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">
      This offer letter was sent via MetryxOne · <a href="${baseUrl}" style="color:#9ca3af;">${baseUrl}</a>
    </p>
  </div>
</div>`.trim(),
    });
    return true;
  } catch (e) {
    console.warn('[email] sendOfferLetterEmail failed:', (e as Error).message);
    return false;
  }
}

// Escape free-text that an employer types so it renders safely inside HTML email.
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function sendTeamInviteEmail(params: {
  toEmail: string;
  memberName: string;
  companyName: string;
  inviterEmail: string;
  accessLevel: string;
}): Promise<boolean> {
  try {
    const { toEmail, memberName, companyName, inviterEmail, accessLevel } = params;
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const baseUrl = process.env.APP_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://app.metryxone.com');
    const safeCompany = escapeHtml(companyName);
    const safeName = escapeHtml(memberName);
    const safeAccess = escapeHtml(accessLevel);
    const safeInviter = escapeHtml(inviterEmail);

    await transporter.sendMail({
      from: `"${companyName} via MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: `You've been invited to join ${companyName}'s hiring team`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:24px 20px;background:#344E86;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">MetryxOne</h1>
    <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px;">Hiring Team Invitation</p>
  </div>
  <div style="padding:28px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="color:#374151;font-size:14px;margin:0 0 16px;">Hi ${safeName},</p>
    <p style="color:#374151;font-size:14px;margin:0 0 16px;">
      <strong>${safeCompany}</strong> has invited you to join their hiring team on MetryxOne${safeInviter ? ` (invited by ${safeInviter})` : ''}.
      You have been added with <strong>${safeAccess}</strong> access.
    </p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">
      To get started, sign in to MetryxOne using <strong>${escapeHtml(toEmail)}</strong>. If you don't have an account yet, you can create one with this email address.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${baseUrl}" style="display:inline-block;padding:14px 32px;background:#344E86;color:#fff;font-weight:bold;font-size:14px;border-radius:10px;text-decoration:none;">
        Open MetryxOne →
      </a>
    </div>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
      Powered by MetryxOne · <a href="${baseUrl}" style="color:#9ca3af;">${baseUrl}</a>
    </p>
  </div>
</div>`.trim(),
    });
    return true;
  } catch (e) {
    console.warn('[email] sendTeamInviteEmail failed:', (e as Error).message);
    return false;
  }
}

export async function sendTalentOutreachEmail(params: {
  toEmail: string;
  candidateName: string;
  companyName: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  try {
    const { toEmail, candidateName, companyName, subject, message } = params;
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const baseUrl = process.env.APP_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://app.metryxone.com');
    const safeCompany = escapeHtml(companyName);
    const safeName = escapeHtml(candidateName);
    // The body is recruiter-authored free text — escape it, preserve line breaks.
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

    await transporter.sendMail({
      from: `"${companyName} via MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: subject || `An opportunity at ${companyName}`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:24px 20px;background:#344E86;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">${safeCompany}</h1>
    <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px;">An opportunity for you</p>
  </div>
  <div style="padding:28px 24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="color:#374151;font-size:14px;margin:0 0 16px;">Hi ${safeName},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">${safeMessage}</p>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
      Sent by ${safeCompany} via MetryxOne · <a href="${baseUrl}" style="color:#9ca3af;">${baseUrl}</a>
    </p>
  </div>
</div>`.trim(),
    });
    return true;
  } catch (e) {
    console.warn('[email] sendTalentOutreachEmail failed:', (e as Error).message);
    return false;
  }
}

/**
 * Applicant self-completion request. The recruiter triggers this so the APPLICANT
 * fills in their own missing details (résumé, phone, etc.) via a token-scoped link.
 * All dynamic content (company, name, recruiter note, missing items) is escaped.
 */
export async function sendApplicantCompletionRequest(params: {
  toEmail: string;
  candidateName: string;
  companyName: string;
  jobTitle?: string;
  missing: string[];
  link: string;
  note?: string;
}): Promise<boolean> {
  try {
    const { toEmail, candidateName, companyName, jobTitle, missing, link, note } = params;
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL!;
    const baseUrl = process.env.APP_BASE_URL ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://app.metryxone.com');
    const safeCompany = escapeHtml(companyName);
    const safeName = escapeHtml(candidateName || 'there');
    const safeRole = jobTitle ? escapeHtml(jobTitle) : '';
    const safeLink = encodeURI(link);
    const safeNote = note ? escapeHtml(note).replace(/\n/g, '<br/>') : '';
    const items = (missing || []).map(m => `<li style="margin:4px 0;">${escapeHtml(m)}</li>`).join('');
    const missingBlock = items
      ? `<p style="color:#374151;font-size:14px;margin:0 0 8px;">To complete your application, please add:</p>
         <ul style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;padding-left:20px;">${items}</ul>`
      : `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px;">Please review and complete your application details.</p>`;

    await transporter.sendMail({
      from: `"${companyName} via MetryxOne" <${fromEmail}>`,
      to: toEmail,
      subject: `Complete your application${safeRole ? ` for ${jobTitle}` : ''} — ${companyName}`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">
  <div style="text-align:center;padding:24px 20px;background:#344E86;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">${safeCompany}</h1>
    <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px;">Complete your application</p>
  </div>
  <div style="padding:28px 24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="color:#374151;font-size:14px;margin:0 0 16px;">Hi ${safeName},</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">
      ${safeCompany} would like you to complete your application${safeRole ? ` for <strong>${safeRole}</strong>` : ''}.
    </p>
    ${safeNote ? `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;padding:12px 14px;background:#f8fafc;border-left:3px solid #344E86;border-radius:4px;">${safeNote}</p>` : ''}
    ${missingBlock}
    <div style="text-align:center;margin:0 0 22px;">
      <a href="${safeLink}" style="display:inline-block;padding:14px 32px;background:#344E86;color:#fff;font-weight:bold;font-size:14px;border-radius:10px;text-decoration:none;">
        Complete my application
      </a>
    </div>
    <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0 0 16px;">
      This secure link is unique to you and expires in 14 days. If the button doesn't work, copy and paste this link:<br/>
      <a href="${safeLink}" style="color:#344E86;word-break:break-all;">${safeLink}</a>
    </p>
    <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;">
      Sent by ${safeCompany} via MetryxOne · <a href="${baseUrl}" style="color:#9ca3af;">${baseUrl}</a>
    </p>
  </div>
</div>`.trim(),
    });
    return true;
  } catch (e) {
    console.warn('[email] sendApplicantCompletionRequest failed:', (e as Error).message);
    return false;
  }
}

// ── Invoice / GST document delivery (Task #6) ────────────────────────────────
export async function sendInvoiceEmail(params: {
  toEmail: string;
  name?: string | null;
  docTypeLabel: string;
  invoiceNumber: string;
  totalLabel: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<boolean> {
  try {
    const transporter = getTransporter();
    const fromEmail = process.env.ZOHO_EMAIL || 'notifications@metryxone.com';
    const greeting = params.name ? `Dear ${params.name},` : 'Hello,';
    const subject = `${params.docTypeLabel} ${params.invoiceNumber} from MetryxOne`;
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
  <div style="background:#344E86;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:18px;">MetryxOne</h2>
  </div>
  <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p>${greeting}</p>
    <p>Please find attached your <strong>${params.docTypeLabel}</strong>
       (<strong>${params.invoiceNumber}</strong>) for <strong>${params.totalLabel}</strong>.</p>
    <p style="color:#64748b;font-size:13px;">This is a computer-generated document. If you have any questions, simply reply to this email.</p>
    <p style="margin-top:24px;">Regards,<br/>MetryxOne Billing</p>
  </div>
</div>`.trim();

    await transporter.sendMail({
      from: `"MetryxOne Billing" <${fromEmail}>`,
      to: params.toEmail,
      subject,
      html,
      attachments: [{ filename: params.pdfFilename, content: params.pdfBuffer, contentType: 'application/pdf' }],
    });
    console.log(`[email] invoice ${params.invoiceNumber} emailed to ${params.toEmail}`);
    return true;
  } catch (e: any) {
    console.error('[email] sendInvoiceEmail failed:', e?.message || e);
    return false;
  }
}
