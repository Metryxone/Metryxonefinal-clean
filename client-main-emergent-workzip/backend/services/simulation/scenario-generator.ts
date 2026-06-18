/**
 * CAPADEX Simulation — Behavioral Scenario Generator (0C).
 *
 * Deterministic, seeded generation of simulated behavioral profiles. Given a
 * count and a seed, it produces a reproducible cohort spread across all
 * personas, varying severity, age, and response style so the validation run
 * exercises a realistic distribution rather than a single archetype.
 *
 * Pure / no side effects.
 */
import { PERSONAS, type PersonaDef } from './persona-library';

export type ResponseStyle = 'balanced' | 'acquiescent' | 'extreme' | 'midpoint';

export interface SimProfile {
  id: string;
  personaKey: string;
  /** Concrete age sampled within the persona's range. */
  age: number;
  /** Effective struggle severity 0..1 (persona baseline + variation). */
  severity: number;
  /** Answer reliability 0..1 — lower means noisier, more answer changes. */
  consistency: number;
  responseStyle: ResponseStyle;
}

/** mulberry32 — small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STYLES: ResponseStyle[] = ['balanced', 'acquiescent', 'extreme', 'midpoint'];

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function sampleAge(p: PersonaDef, rnd: () => number): number {
  const [lo, hi] = p.ageRange;
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

/**
 * Generate `count` reproducible profiles. Personas are assigned round-robin so
 * every persona is represented roughly equally even at small counts.
 */
export function generateProfiles(count: number, seed = 0xc0ffee): SimProfile[] {
  const rnd = mulberry32(seed);
  const n = Math.max(0, Math.floor(count));
  const out: SimProfile[] = [];
  for (let i = 0; i < n; i++) {
    const persona = PERSONAS[i % PERSONAS.length];
    const variation = (rnd() - 0.5) * 0.3; // ±0.15
    const severity = clamp01(persona.baseSeverity + variation);
    const consistency = clamp01(0.55 + rnd() * 0.45);
    const responseStyle = STYLES[Math.floor(rnd() * STYLES.length)];
    out.push({
      id: `sim_${seed.toString(16)}_${i}`,
      personaKey: persona.key,
      age: sampleAge(persona, rnd),
      severity,
      consistency,
      responseStyle,
    });
  }
  return out;
}

/**
 * Pick a stratified sample (at least one profile per represented persona where
 * possible) from a generated cohort, capped at `sampleSize`.
 */
export function stratifiedSample(profiles: SimProfile[], sampleSize: number): SimProfile[] {
  if (sampleSize >= profiles.length) return profiles.slice();
  const byPersona = new Map<string, SimProfile[]>();
  for (const p of profiles) {
    const list = byPersona.get(p.personaKey) ?? [];
    list.push(p);
    byPersona.set(p.personaKey, list);
  }
  const picked: SimProfile[] = [];
  const personaKeys = Array.from(byPersona.keys());
  // Round-robin across personas until we hit the sample size.
  let idx = 0;
  while (picked.length < sampleSize) {
    const key = personaKeys[idx % personaKeys.length];
    const list = byPersona.get(key)!;
    if (list.length > 0) picked.push(list.shift()!);
    idx++;
    // Safety: if every bucket is empty, stop.
    if (idx > sampleSize * personaKeys.length + personaKeys.length) break;
    if (personaKeys.every((k) => (byPersona.get(k)?.length ?? 0) === 0)) break;
  }
  return picked.slice(0, sampleSize);
}

/**
 * Map a profile's severity + per-question polarity onto a 1..5 raw answer.
 *
 * The simulant produces the persona's *lived* answer, NOT a pre-scored one —
 * reverse-keying is the engine's job. CAPADEX items are predominantly
 * distress-worded (negatively-keyed, `(-)`): a struggling persona AGREES with
 * them (high value), which the engine then reverse-scores into a low health
 * score. Capability-worded `(+)` items are the opposite — a struggling persona
 * disagrees (low value). Response style + consistency add varied noise.
 */
export function simulateAnswer(
  profile: SimProfile,
  polarity: '(+)' | '(-)' | string,
  jitter: number,
): number {
  // Agreement with a distress-worded (negatively-keyed) statement, 1..5.
  let base = 1 + profile.severity * 4;
  // Capability-worded (+) items invert: a struggling persona answers LOW.
  if (polarity && polarity.includes('+')) base = 6 - base;

  // Response-style shaping.
  switch (profile.responseStyle) {
    case 'acquiescent':
      base = base + 0.5;
      break;
    case 'extreme':
      base = base >= 3 ? base + 1 : base - 1;
      break;
    case 'midpoint':
      base = base * 0.6 + 3 * 0.4;
      break;
    default:
      break;
  }
  // Consistency-scaled noise (deterministic jitter passed in by the caller).
  const noise = (jitter - 0.5) * 2 * (1 - profile.consistency);
  const val = Math.round(base + noise);
  return Math.min(5, Math.max(1, val));
}
