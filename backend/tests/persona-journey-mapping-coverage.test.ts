/**
 * Task #362 — Persona-journey mapping coverage guard (no silent fallbacks).
 *
 * The wizard emits many sub-personas (career_explorer, mid_career_professional, senior_leadership,
 * learning_development, career_transition_professional, teacher_educator, higher_ed_faculty,
 * academic_counsellor, placement_career_cell, …) that the resolver maps to a canonical journey via
 * SUB_PERSONA_TO_JOURNEY / LEGACY_KEY_TO_JOURNEY. If any of those maps to a journey key that no
 * longer exists in CUSTOMER_JOURNEY_MODEL (rename/removal), that persona silently degrades to the
 * amber "we couldn't map a journey" fallback with nothing catching it.
 *
 * This DATA-DRIVEN test iterates EVERY entry in both mapping tables and asserts the target journey
 * key exists in CUSTOMER_JOURNEY_MODEL and carries real lifecycle stages — so a future journey
 * rename/removal that orphans any persona mapping fails loudly here instead of silently.
 *
 * Pure, DB-free: it imports the static registries only; no server, no tables.
 *
 * Run with:  cd backend && npx tsx --test tests/persona-journey-mapping-coverage.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SUB_PERSONA_TO_JOURNEY, LEGACY_KEY_TO_JOURNEY } from '../routes/persona-journey';
import { CUSTOMER_JOURNEY_MODEL } from '../config/customer-journey';

/** Assert a mapped journey key exists in the registry with lifecycle stages. */
function assertJourneyExists(source: string, personaKey: string, journeyKey: string) {
  const journey = CUSTOMER_JOURNEY_MODEL.find((j) => j.key === journeyKey);
  assert.ok(
    journey,
    `${source}["${personaKey}"] → "${journeyKey}" must exist in CUSTOMER_JOURNEY_MODEL ` +
      `(orphaned mapping → silent amber fallback)`,
  );
  assert.ok(
    Array.isArray(journey!.lifecycleStages),
    `${source}["${personaKey}"] → "${journeyKey}" journey must declare lifecycleStages`,
  );
  assert.ok(
    journey!.lifecycleStages.length > 0,
    `${source}["${personaKey}"] → "${journeyKey}" journey must have at least one lifecycle stage`,
  );
}

test('every SUB_PERSONA_TO_JOURNEY target resolves to a real journey with lifecycle stages', () => {
  const entries = Object.entries(SUB_PERSONA_TO_JOURNEY);
  assert.ok(entries.length > 0, 'SUB_PERSONA_TO_JOURNEY has entries');
  for (const [personaKey, journeyKey] of entries) {
    assertJourneyExists('SUB_PERSONA_TO_JOURNEY', personaKey, journeyKey);
  }
});

test('every LEGACY_KEY_TO_JOURNEY target resolves to a real journey with lifecycle stages', () => {
  const entries = Object.entries(LEGACY_KEY_TO_JOURNEY);
  assert.ok(entries.length > 0, 'LEGACY_KEY_TO_JOURNEY has entries');
  for (const [personaKey, journeyKey] of entries) {
    assertJourneyExists('LEGACY_KEY_TO_JOURNEY', personaKey, journeyKey);
  }
});
