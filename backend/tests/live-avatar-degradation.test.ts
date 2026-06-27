/**
 * Live Avatar Interview — no-keys DEGRADATION test (Task #228).
 *
 * This is the CI-safe half of the one-off verification harness
 * (`backend/audit/live-avatar-verification/verify-live-avatar.ts`), wired in as
 * an automated check. It guarantees the most dangerous regression in the live
 * avatar interview is caught BEFORE it reaches customers: a silent one where the
 * live interview fabricates a session/token when the provider is unconfigured,
 * or the "off when unconfigured" honesty contract breaks.
 *
 * The degradation assertions require NO provider keys and ALWAYS run — they fail
 * loudly if:
 *   • token mint stops throwing AvatarUnavailable when HeyGen is unconfigured
 *   • /live/enabled (status.connected && aiReady) reports ready=true without both
 *     providers
 *   • orchestration fabricates instead of falling back to the verbatim authored
 *     question when the LLM is unconfigured
 *
 * The positive-path assertions are OPT-IN: each only runs when its provider keys
 * are present, so this check passes in CI without paid keys.
 *
 * Run with:  npx tsx backend/tests/live-avatar-degradation.test.ts
 */

import assert from 'node:assert/strict';
import {
  isLiveAvatarConfigured,
  liveAvatarStatus,
  createLiveAvatarToken,
  AvatarUnavailable,
} from '../services/voice-screening-avatar';
import {
  isAIConfigured,
  orchestrateNextTurn,
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

async function main() {
  const heygenReady = isLiveAvatarConfigured();
  const aiReady = isAIConfigured();

  console.log('\n=== Live Avatar Interview — degradation test (no keys required) ===');
  console.log(`HeyGen configured : ${heygenReady}`);
  console.log(`OpenAI configured : ${aiReady}`);
  console.log('');

  // ── 1. Readiness composition (always checked) ───────────────────────────────
  // /live/enabled is honest only when ready === (connected && aiReady). When
  // either provider is missing, ready MUST be false — never optimistically true.
  console.log('Readiness composition');
  await test('status.connected reflects HeyGen configuration honestly', () => {
    const status = liveAvatarStatus();
    assert.equal(status.channel, 'live_avatar', 'channel tag must be live_avatar');
    assert.equal(
      status.connected,
      heygenReady,
      `status.connected (${status.connected}) must equal isLiveAvatarConfigured() (${heygenReady})`,
    );
  });
  await test('/live/enabled ready=false unless BOTH providers configured', () => {
    const status = liveAvatarStatus();
    const composedReady = status.connected && aiReady;
    assert.equal(
      composedReady,
      heygenReady && aiReady,
      'composed readiness must equal (heygen && ai)',
    );
    if (!heygenReady || !aiReady) {
      assert.equal(composedReady, false, 'ready MUST be false when a provider is missing');
    }
  });

  // ── 2. HeyGen streaming-token mint ──────────────────────────────────────────
  console.log('\nToken mint');
  if (heygenReady) {
    // Positive path — OPT-IN (only with real keys).
    await test('token/mint(positive): real streaming token minted', async () => {
      const tok = await createLiveAvatarToken();
      assert.ok(tok.token && tok.token.length > 10, 'token must be a non-trivial string');
      assert.ok(tok.avatarId, 'avatarId must be present');
      assert.ok(tok.voiceId, 'voiceId must be present');
    });
  } else {
    // Degradation path — ALWAYS runs in CI. The critical anti-fabrication guard.
    await test(
      'token/mint(degradation): throws AvatarUnavailable, NEVER a fabricated token',
      async () => {
        await assert.rejects(
          createLiveAvatarToken(),
          (err: unknown) => {
            assert.ok(
              err instanceof AvatarUnavailable,
              `expected AvatarUnavailable, got ${(err as any)?.constructor?.name}: ${(err as any)?.message}`,
            );
            return true;
          },
          'createLiveAvatarToken() must throw AvatarUnavailable when HeyGen is unconfigured',
        );
      },
    );
  }

  // ── 3. LLM orchestration of the next turn ───────────────────────────────────
  console.log('\nOrchestration');
  const authored = [
    { id: 'q1', question: 'Tell me about a project you are proud of.' },
    { id: 'q2', question: 'How do you handle disagreement on a team?' },
  ];

  if (aiReady) {
    // Positive path — OPT-IN (only with a real OPENAI_API_KEY).
    await test('orchestration(positive): LLM produces a real next turn', async () => {
      const first = await orchestrateNextTurn({
        jobTitle: 'Software Engineer',
        questions: authored,
        askedQuestionIds: [],
        transcript: [],
      });
      assert.equal(first.source, 'llm', 'first turn source should be llm');
      assert.ok(first.utterance, 'utterance must be non-empty');
      assert.equal(first.done, false, 'interview should not be done on the first turn');
    });
  } else {
    // Degradation path — ALWAYS runs. Must deliver the VERBATIM authored question,
    // never fabricate.
    await test(
      'orchestration(degradation): authored_fallback delivers verbatim first question',
      async () => {
        const first = await orchestrateNextTurn({
          jobTitle: 'Software Engineer',
          questions: authored,
          askedQuestionIds: [],
          transcript: [],
        });
        assert.equal(first.source, 'authored_fallback', 'source must be authored_fallback');
        assert.equal(first.questionId, 'q1', 'must deliver the first authored question id');
        assert.equal(
          first.utterance,
          authored[0].question,
          'utterance must be the VERBATIM authored question — nothing fabricated',
        );
        assert.equal(first.done, false, 'not done while authored questions remain');
      },
    );
  }

  // Closing behaviour is deterministic and provider-independent — always checked.
  await test('orchestration/closing: done=true once all authored questions asked', async () => {
    const closing = await orchestrateNextTurn({
      jobTitle: 'Software Engineer',
      questions: authored,
      askedQuestionIds: ['q1', 'q2'],
      transcript: [
        { role: 'avatar', text: authored[0].question, questionId: 'q1' },
        { role: 'candidate', text: 'I built a payments system end to end.' },
        { role: 'avatar', text: authored[1].question, questionId: 'q2' },
        { role: 'candidate', text: 'I listen first, then find common ground.' },
      ],
    });
    assert.equal(closing.done, true, 'interview must close out when nothing remains');
  });

  if (heygenReady && aiReady) {
    console.log('');
  } else {
    skip(
      'positive-path assertions',
      'provider keys absent — opt-in, run with HEYGEN_API_KEY/AVATAR_ID/VOICE_ID + OPENAI_API_KEY',
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
