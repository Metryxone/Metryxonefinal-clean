/**
 * Voice Screening — no-keys DEGRADATION test (Task #231).
 *
 * Sibling of `backend/tests/live-avatar-degradation.test.ts`. It guards the most
 * dangerous regression in the employer VOICE SCREENING channel (browser-recorded
 * Whisper STT -> LLM rubric scoring): a silent one where the screening fabricates
 * a transcript or a rubric score when the speech/LLM provider is unconfigured,
 * instead of degrading honestly.
 *
 * The degradation assertions require NO provider keys and ALWAYS run — they fail
 * loudly if:
 *   • transcribeAudio() returns a fabricated transcript instead of throwing
 *     VoiceAIUnavailable when OpenAI is unconfigured
 *   • scoreScreening() invents rubric numbers instead of throwing
 *     VoiceAIUnavailable when there ARE answers but no provider
 *   • the zero-answers ABSTAIN contract breaks (overall/recommendation must be
 *     null, every dimension null, abstained=true — never a fabricated 0)
 *
 * The positive-path assertions are OPT-IN: each only runs when OPENAI_API_KEY
 * (or AI_INTEGRATIONS_OPENAI_API_KEY) is present, so this check passes in CI
 * without paid keys.
 *
 * Run with:  npx tsx backend/tests/voice-screening-degradation.test.ts
 */

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  isAIConfigured,
  transcribeAudio,
  scoreScreening,
  VoiceAIUnavailable,
  VOICE_DIMENSIONS,
  type AnswerInput,
} from '../services/voice-screening-engine';

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(label: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function skip(label: string, why: string) {
  console.log(`  ↷  ${label}  (skipped: ${why})`);
  skipped++;
}

// A small, non-empty audio-ish buffer. transcribeAudio() must reach getClient()
// (which throws when unconfigured) BEFORE any network call — the bytes never
// matter because there is no provider to send them to.
const FAKE_AUDIO = Buffer.from('not-real-audio-bytes-but-non-empty-payload', 'utf8');

const ANSWERS: AnswerInput[] = [
  {
    question: 'Tell me about a project you are proud of.',
    transcript: 'I built a payments system end to end and shipped it to production.',
    expectedResponse: 'A clear, specific example with the candidate’s own contribution.',
    scoringCriteria: 'Reward specificity, ownership, and measurable impact.',
  },
  {
    question: 'How do you handle disagreement on a team?',
    transcript: 'I listen first, then look for common ground and the shared goal.',
  },
];

async function main() {
  const aiReady = isAIConfigured();

  console.log('\n=== Voice Screening — degradation test (no keys required) ===');
  console.log(`OpenAI configured : ${aiReady}`);
  console.log('');

  // ── 1. AI readiness is honest ───────────────────────────────────────────────
  console.log('Readiness');
  await test('isAIConfigured() reflects env honestly (no optimistic true)', () => {
    const expected = !!(
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    );
    assert.equal(aiReady, expected, 'isAIConfigured() must equal raw env presence');
  });

  // ── 2. Transcription ────────────────────────────────────────────────────────
  console.log('\nTranscription');
  // Empty buffer is provider-independent: honestly returns an empty transcript,
  // never a fabricated one — always checked.
  await test('transcribe(empty): returns empty transcript, fabricates nothing', async () => {
    const res = await transcribeAudio(Buffer.alloc(0));
    assert.equal(res.transcript, '', 'empty audio must yield an empty transcript');
    assert.equal(res.bytes, 0, 'byte count must be honest (0)');
  });

  if (aiReady) {
    // Positive path — OPT-IN (only with a real key, and a real recording).
    skip(
      'transcribe(positive): real STT transcript',
      'requires a real audio recording — exercised by the live employer flow, not this CI check',
    );
  } else {
    // Degradation path — ALWAYS runs. The critical anti-fabrication guard.
    await test(
      'transcribe(degradation): throws VoiceAIUnavailable, NEVER a fabricated transcript',
      async () => {
        await assert.rejects(
          transcribeAudio(FAKE_AUDIO),
          (err: unknown) => {
            assert.ok(
              err instanceof VoiceAIUnavailable,
              `expected VoiceAIUnavailable, got ${(err as any)?.constructor?.name}: ${(err as any)?.message}`,
            );
            assert.equal((err as VoiceAIUnavailable).status, 503, 'must map to HTTP 503');
            return true;
          },
          'transcribeAudio() must throw VoiceAIUnavailable when OpenAI is unconfigured',
        );
      },
    );
  }

  // ── 3. Rubric scoring ───────────────────────────────────────────────────────
  console.log('\nRubric scoring');
  // Zero captured answers → ABSTAIN. Provider-independent, always checked. This
  // is the null != 0 contract: no signal must never become a fabricated 0.
  await test('score(no answers): abstains honestly — null overall, null dims, no 0s', async () => {
    const report = await scoreScreening({ jobTitle: 'Software Engineer', answers: [] });
    assert.equal(report.abstained, true, 'must abstain with zero answers');
    assert.equal(report.overallScore, null, 'overall MUST be null, never 0');
    assert.equal(report.recommendation, null, 'recommendation MUST be null when abstaining');
    assert.equal(report.answeredCount, 0, 'answeredCount must be 0');
    assert.equal(
      report.dimensions.length,
      VOICE_DIMENSIONS.length,
      'every dimension must still be represented',
    );
    for (const d of report.dimensions) {
      assert.equal(d.score, null, `dimension ${d.key} MUST be null (not a fabricated 0)`);
    }
  });

  // Answers present but no transcripts → still abstains (no captured speech).
  await test('score(blank transcripts): abstains — empty speech is no signal', async () => {
    const report = await scoreScreening({
      jobTitle: 'Software Engineer',
      answers: [
        { question: 'Q1', transcript: '' },
        { question: 'Q2', transcript: null },
      ],
    });
    assert.equal(report.abstained, true, 'blank transcripts must abstain');
    assert.equal(report.overallScore, null, 'overall MUST be null, never 0');
  });

  if (aiReady) {
    // Positive path — OPT-IN (only with a real OPENAI_API_KEY).
    await test('score(positive): real transcripts produce a real rubric', async () => {
      const report = await scoreScreening({ jobTitle: 'Software Engineer', answers: ANSWERS });
      assert.equal(report.abstained, false, 'must not abstain when transcripts are present');
      assert.equal(report.answeredCount, ANSWERS.length, 'must count the answered questions');
      assert.equal(
        report.dimensions.length,
        VOICE_DIMENSIONS.length,
        'all five dimensions must be present',
      );
    });
  } else {
    // Degradation path — ALWAYS runs. With real transcripts but no provider, the
    // scorer MUST throw rather than invent rubric numbers.
    await test(
      'score(degradation): real transcripts + no provider throws, NEVER fabricates scores',
      async () => {
        await assert.rejects(
          scoreScreening({ jobTitle: 'Software Engineer', answers: ANSWERS }),
          (err: unknown) => {
            assert.ok(
              err instanceof VoiceAIUnavailable,
              `expected VoiceAIUnavailable, got ${(err as any)?.constructor?.name}: ${(err as any)?.message}`,
            );
            assert.equal((err as VoiceAIUnavailable).status, 503, 'must map to HTTP 503');
            return true;
          },
          'scoreScreening() must throw VoiceAIUnavailable when answers exist but OpenAI is unconfigured',
        );
      },
    );
  }

  if (!aiReady) {
    skip(
      'positive-path scoring assertions',
      'OPENAI_API_KEY absent — opt-in, run with OPENAI_API_KEY (or the OpenAI integration)',
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(58)}`);
  console.log(
    `  ${passed} passed   ${skipped} skipped   ${failed > 0 ? failed + ' FAILED' : 'all green'}`,
  );
  console.log('');
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('degradation test crashed:', err);
  process.exit(1);
});
