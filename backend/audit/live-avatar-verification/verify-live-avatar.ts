/**
 * Live Avatar Interview — server-side verification harness (Task #222).
 *
 * Verifies the parts of the live two-way avatar interview that CAN be checked
 * without a human in a browser:
 *   1. HeyGen streaming-token mint            (createLiveAvatarToken)
 *   2. /live/enabled readiness composition    (configured && aiReady)
 *   3. LLM orchestration of the next turn     (orchestrateNextTurn)
 *
 * It is intentionally dual-mode and self-describing:
 *   • NO KEYS  → asserts HONEST DEGRADATION: token mint throws AvatarUnavailable,
 *                ready=false, and orchestration falls back to the next AUTHORED
 *                question (source='authored_fallback') — never a fabricated token,
 *                session, or answer.
 *   • WITH KEYS (HEYGEN_API_KEY/AVATAR_ID/VOICE_ID + OPENAI_API_KEY) → asserts
 *                the POSITIVE path: a real streaming token is minted, ready=true,
 *                and the LLM produces a real next-turn (source='llm').
 *
 * The live WebRTC conversation itself (avatar speaks/listens, webcam capture,
 * off-topic redirect) requires a person in a browser — see RUNBOOK.md.
 *
 * Run:  cd backend && npx tsx audit/live-avatar-verification/verify-live-avatar.ts
 */

import {
  isLiveAvatarConfigured,
  liveAvatarStatus,
  createLiveAvatarToken,
  LIVE_AVATAR_MAX_DURATION_MS,
  AvatarUnavailable,
} from '../../services/voice-screening-avatar';
import {
  isAIConfigured,
  orchestrateNextTurn,
} from '../../services/voice-screening-engine';
import { isLiveAvatarInterviewEnabled } from '../../config/feature-flags';

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${name} — ${detail}`);
}

async function main() {
  const heygenReady = isLiveAvatarConfigured();
  const aiReady = isAIConfigured();
  const flagOn = isLiveAvatarInterviewEnabled();

  console.log('\n=== Live Avatar Interview — server-side verification ===');
  console.log(`flag liveAvatarInterview : ${flagOn ? 'ON' : 'OFF'}`);
  console.log(`HeyGen configured        : ${heygenReady}`);
  console.log(`OpenAI configured        : ${aiReady}`);
  console.log(`max duration             : ${LIVE_AVATAR_MAX_DURATION_MS} ms (${LIVE_AVATAR_MAX_DURATION_MS / 60000} min)`);
  console.log(`mode                     : ${heygenReady && aiReady ? 'POSITIVE (keys present)' : 'DEGRADATION (keys absent)'}`);
  console.log('');

  // ── 1. Readiness composition ──────────────────────────────────────────────
  const status = liveAvatarStatus();
  const composedReady = status.connected && aiReady;
  record(
    'readiness/composition',
    composedReady === (heygenReady && aiReady),
    `/live/enabled ready = connected(${status.connected}) && aiReady(${aiReady}) = ${composedReady}`,
  );

  // ── 2. HeyGen streaming-token mint ────────────────────────────────────────
  if (heygenReady) {
    try {
      const tok = await createLiveAvatarToken();
      const ok = !!tok.token && tok.token.length > 10 && !!tok.avatarId && !!tok.voiceId;
      record(
        'token/mint(positive)',
        ok,
        ok
          ? `real token minted (len=${tok.token.length}), avatarId/voiceId present, cap=${tok.maxDurationMs}ms`
          : `token response incomplete: ${JSON.stringify({ hasToken: !!tok.token, avatarId: tok.avatarId, voiceId: tok.voiceId })}`,
      );
    } catch (err: any) {
      record('token/mint(positive)', false, `expected a real token but threw: ${err?.message || err}`);
    }
  } else {
    try {
      await createLiveAvatarToken();
      record('token/mint(degradation)', false, 'expected AvatarUnavailable with no HeyGen keys, but a token was returned');
    } catch (err: any) {
      const honest = err instanceof AvatarUnavailable;
      record(
        'token/mint(degradation)',
        honest,
        honest
          ? `honest 503: AvatarUnavailable("${err.message}") — no fabricated token`
          : `threw the wrong error type: ${err?.message || err}`,
      );
    }
  }

  // ── 3. LLM orchestration of the next turn ─────────────────────────────────
  const authored = [
    { id: 'q1', question: 'Tell me about a project you are proud of.' },
    { id: 'q2', question: 'How do you handle disagreement on a team?' },
  ];
  // Turn 1: interview just starting — should deliver the FIRST authored question.
  const first = await orchestrateNextTurn({
    jobTitle: 'Software Engineer',
    questions: authored,
    askedQuestionIds: [],
    transcript: [],
  });
  if (aiReady) {
    record(
      'orchestration(positive)',
      first.source === 'llm' && !!first.utterance && !first.done,
      `source=${first.source}, done=${first.done}, utterance="${first.utterance.slice(0, 80)}..."`,
    );
  } else {
    const ok = first.source === 'authored_fallback' && first.questionId === 'q1' && first.utterance === authored[0].question;
    record(
      'orchestration(degradation)',
      ok,
      ok
        ? `authored_fallback delivers the verbatim first authored question (q1) — nothing fabricated`
        : `unexpected fallback: source=${first.source}, qid=${first.questionId}, utterance="${first.utterance.slice(0, 60)}"`,
    );
  }

  // Completion: every authored question asked → must close out with done=true.
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
  record(
    'orchestration/closing',
    closing.done === true,
    `all authored questions asked → done=${closing.done}, source=${closing.source}`,
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  console.log('\n--- summary ---');
  console.log(`${passed}/${checks.length} checks passed${failed ? `, ${failed} FAILED` : ''}`);
  console.log(
    heygenReady && aiReady
      ? 'Server-side seams verified in POSITIVE mode. Now run the human browser interview — see RUNBOOK.md.'
      : 'Server-side seams verified in DEGRADATION mode (honest). Re-run after adding the four provider keys to confirm the positive path, then run RUNBOOK.md.',
  );
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('verification harness crashed:', err);
  process.exit(1);
});
