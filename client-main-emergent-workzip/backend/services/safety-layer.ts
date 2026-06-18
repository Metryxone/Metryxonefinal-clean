/**
 * OMEGA-X Safety Layer
 *
 * Implements psychologically safe content validation for all CAPADEX narratives.
 * Runs on every narrative string before it reaches the user.
 *
 * Levels:
 *   informational — standard report, no escalation needed
 *   supportive    — content suggesting moderate distress; add supportive framing
 *   referral      — crisis/self-harm signals detected; escalate to counsellor
 *
 * The safety layer NEVER blocks content. It enriches the response with:
 *   - safety_status flag
 *   - safety_flags array (what was detected)
 *   - sanitised narrative (harmful phrases replaced with safe alternatives)
 *   - escalation_message (shown to user when referral-level)
 */

export type SafetyLevel = 'informational' | 'supportive' | 'referral';

export interface SafetyResult {
  safety_status: SafetyLevel;
  safety_flags: string[];
  sanitised_text: string;
  escalation_message: string | null;
  confidence: number;
}

// ─── Pattern Banks ─────────────────────────────────────────────────────────────

const REFERRAL_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /\b(suicid|self.harm|self.injur|hurt.myself|end.my.life|want.to.die|kill.myself)\b/gi, flag: 'self_harm_language' },
  { pattern: /\b(i.can.t.go.on|no.point|hopeless|worthless|burden.to.everyone|no.way.out)\b/gi, flag: 'crisis_language' },
  { pattern: /\b(nothing.will.ever.change|permanently.broken|unfixable|beyond.help)\b/gi, flag: 'catastrophic_determinism' },
];

const SUPPORTIVE_PATTERNS: { pattern: RegExp; flag: string }[] = [
  { pattern: /\b(i.give.up|can.t.cope|falling.apart|breaking.down|losing.my.mind)\b/gi, flag: 'high_distress' },
  { pattern: /\b(panic|terrified|paralysed|frozen|overwhelmed.every.day)\b/gi, flag: 'panic_language' },
  { pattern: /\b(everyone.hates.me|nobody.cares|completely.alone|total.failure)\b/gi, flag: 'shame_absolutism' },
];

const SHAME_LANGUAGE: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\byou.are.failing\b/gi, replacement: 'this area is still developing' },
  { pattern: /\byou.have.failed\b/gi, replacement: 'this area has room to grow' },
  { pattern: /\byou.are.broken\b/gi, replacement: 'there are patterns worth addressing' },
  { pattern: /\bwrong.with.you\b/gi, replacement: 'worth exploring with support' },
  { pattern: /\byou.should.be\b/gi, replacement: 'it can be helpful to' },
  { pattern: /\byou.must\b/gi, replacement: 'you might consider' },
  { pattern: /\byou.need.to.fix\b/gi, replacement: 'there is an opportunity to develop' },
  { pattern: /\bnever.improve\b/gi, replacement: 'may take time and support to shift' },
  { pattern: /\bimpossible.to.change\b/gi, replacement: 'challenging without the right approach' },
];

const CATASTROPHIC_PHRASES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\byou.will.always\b/gi, replacement: 'the current pattern tends to' },
  { pattern: /\byou.will.never\b/gi, replacement: 'without intervention, it may be harder to' },
  { pattern: /\bthis.is.permanent\b/gi, replacement: 'this pattern can shift with the right strategy' },
  { pattern: /\bno.hope\b/gi, replacement: 'real progress requires the right approach' },
  { pattern: /\bcannot.be.helped\b/gi, replacement: 'benefits from specialist support' },
];

const DIAGNOSTIC_LANGUAGE: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\byou.have.ADHD\b/gi, replacement: 'there are attention-related patterns present' },
  { pattern: /\byou.have.depression\b/gi, replacement: 'there are patterns consistent with low mood' },
  { pattern: /\byou.have.anxiety\b/gi, replacement: 'there are anxiety-related patterns present' },
  { pattern: /\byou.are.autistic\b/gi, replacement: 'there are patterns worth exploring with a specialist' },
  { pattern: /\byou.have.OCD\b/gi, replacement: 'there are repetitive pattern markers present' },
];

// ─── Main Validation Function ─────────────────────────────────────────────────

export function validateNarrative(text: string, userName?: string): SafetyResult {
  const flags: string[] = [];
  let sanitised = text;
  let level: SafetyLevel = 'informational';
  let confidence = 0.95;

  // 1. Check for referral-level signals first
  for (const { pattern, flag } of REFERRAL_PATTERNS) {
    if (pattern.test(sanitised)) {
      flags.push(flag);
      level = 'referral';
      confidence = 0.70;
      // Remove the matched phrase — replace with a safe bridge
      sanitised = sanitised.replace(pattern, '[this concern is best addressed with direct support]');
    }
  }

  // 2. Check for supportive-level signals
  if (level !== 'referral') {
    for (const { pattern, flag } of SUPPORTIVE_PATTERNS) {
      if (pattern.test(sanitised)) {
        flags.push(flag);
        level = 'supportive';
        confidence = 0.82;
      }
    }
  }

  // 3. Sanitise shame language (always run)
  for (const { pattern, replacement } of SHAME_LANGUAGE) {
    sanitised = sanitised.replace(pattern, replacement);
  }

  // 4. Sanitise catastrophic phrasing
  for (const { pattern, replacement } of CATASTROPHIC_PHRASES) {
    sanitised = sanitised.replace(pattern, replacement);
  }

  // 5. Remove diagnostic labelling (never diagnose)
  for (const { pattern, replacement } of DIAGNOSTIC_LANGUAGE) {
    sanitised = sanitised.replace(pattern, replacement);
  }

  // 6. Build escalation message if needed
  let escalation_message: string | null = null;
  const firstName = userName ? userName.split(' ')[0] : 'you';

  if (level === 'referral') {
    escalation_message = `${firstName}, based on what you've shared, speaking with a counsellor or mental health professional would be the most helpful next step. This report is a starting point — a professional can provide the personalised, real-time support that will make the most difference. You can reach our counselling team directly via WhatsApp.`;
  } else if (level === 'supportive') {
    escalation_message = `If what you're experiencing feels heavier than this report can address, speaking with someone directly is always a valid and courageous step. Our counselling team is available.`;
  }

  return { safety_status: level, safety_flags: flags, sanitised_text: sanitised, escalation_message, confidence };
}

/** Validate an array of strings and return the highest safety level found. */
export function validateReport(narratives: string[], userName?: string): SafetyResult {
  const results = narratives.map(n => validateNarrative(n, userName));
  const highestLevel = results.reduce<SafetyLevel>((acc, r) => {
    if (r.safety_status === 'referral') return 'referral';
    if (r.safety_status === 'supportive' && acc === 'informational') return 'supportive';
    return acc;
  }, 'informational');

  const allFlags = Array.from(new Set(results.flatMap(r => r.safety_flags)));
  const escalation = results.find(r => r.escalation_message)?.escalation_message ?? null;
  const minConf = Math.min(...results.map(r => r.confidence));

  return {
    safety_status: highestLevel,
    safety_flags: allFlags,
    sanitised_text: results.map(r => r.sanitised_text).join(' '),
    escalation_message: escalation,
    confidence: minConf,
  };
}
