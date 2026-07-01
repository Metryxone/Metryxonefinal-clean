/**
 * AI prompt-injection input guard (Phase 2.4 remediation — AI-M1).
 *
 * Dependency-free, defensive neutralization of the most common prompt-injection
 * vectors in USER-provided free text BEFORE it is concatenated into an LLM prompt.
 * Conservative by design: only high-confidence, multi-token attack patterns and
 * model chat-template control tokens are neutralized, so benign user text
 * (résumés, career narratives, interview answers) is left intact.
 *
 * Security-control convention (mirrors CSRF in this codebase): DEFAULT ON.
 * Disabled ONLY via the explicit env kill-switch AI_INPUT_GUARD_DISABLED=1.
 * This is NOT a default-off feature flag — hardening must protect by default.
 */

export interface InputGuardResult {
  clean: string;
  flagged: boolean;
  matched: string[];
}

// Model / chat-template control tokens that must never appear in user content.
const CONTROL_TOKENS: RegExp[] = [
  /<\|im_(?:start|end|sep)\|>/gi,
  /<\|endoftext\|>/gi,
  /<\|eot_id\|>/gi,
  /\[\/?INST\]/gi,
  /<<\/?SYS>>/gi,
  /<\/s>/gi,
];

// High-confidence instruction-override / exfiltration patterns.
const INJECTION_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'override_instructions', re: /\b(?:ignore|disregard|forget|override)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|all|any)\b[^.\n]{0,24}\b(?:instruction|prompt|message|rule|direction)s?\b/gi },
  { name: 'reveal_system_prompt', re: /\b(?:reveal|show|print|repeat|output|display|expose)\b[^.\n]{0,30}\b(?:system\s+prompt|your\s+instructions?|initial\s+prompt|the\s+prompt\s+above)\b/gi },
  { name: 'role_reassignment', re: /\byou\s+are\s+now\s+(?:a|an|the|no\s+longer)\b[^.\n]{0,60}/gi },
  { name: 'developer_mode', re: /\b(?:developer|jailbreak|dan)\s+mode\b/gi },
];

// Injected chat-role markers at the start of a line (e.g. "system:", "assistant:").
const ROLE_MARKER = /^[ \t]*(system|assistant|developer)[ \t]*:/gim;

export function isAiInputGuardEnabled(): boolean {
  return process.env.AI_INPUT_GUARD_DISABLED !== '1';
}

/**
 * Scan and neutralize a single user-provided string. Pure function — never throws,
 * always returns a result. Detection is by before/after comparison to avoid
 * RegExp.lastIndex pitfalls with the global flag.
 */
export function scanUserInput(input: string): InputGuardResult {
  if (typeof input !== 'string' || input.length === 0) {
    return { clean: typeof input === 'string' ? input : '', flagged: false, matched: [] };
  }
  const matched: string[] = [];
  let clean = input;

  for (const re of CONTROL_TOKENS) {
    const before = clean;
    clean = clean.replace(re, ' ');
    if (clean !== before) matched.push('control_token');
  }
  for (const { name, re } of INJECTION_PATTERNS) {
    const before = clean;
    clean = clean.replace(re, '[filtered]');
    if (clean !== before) matched.push(name);
  }
  {
    const before = clean;
    clean = clean.replace(ROLE_MARKER, '$1\u200b:');
    if (clean !== before) matched.push('role_marker');
  }

  return { clean, flagged: matched.length > 0, matched: Array.from(new Set(matched)) };
}

/** Convenience: returns the neutralized string (no-op when the guard is disabled). */
export function guardUserInput(input: string): string {
  if (!isAiInputGuardEnabled()) return input;
  return scanUserInput(input).clean;
}
