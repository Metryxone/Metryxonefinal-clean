/**
 * Unit tests for selectVideos().
 *
 * These tests run directly against the pure function — no live server required.
 * Run with:  node --import tsx/esm --test src/__tests__/video-selector.unit.test.ts
 *
 * Covered cases:
 *   1. Topic match scoring    — videos whose topics overlap score higher
 *   2. Role filtering         — only videos whose forRoles includes the session role are returned
 *   3. Keyword boost          — message containing "video"/"watch"/"show me"/"see" lifts all scores
 *   4. Two-video cap          — at most 2 videos are ever returned
 *   5. Zero-score exclusion   — videos with no matching topics/role/keyword are excluded
 *   6. Session detectedTopics — topics accumulated on the session are also matched
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectVideos, scoreVideo, VIDEO_CATALOG } from '../utils/video-selector.js';
import type { VideoSession } from '../utils/video-selector.js';

function makeSession(overrides: Partial<VideoSession> = {}): VideoSession {
  return {
    userType: null,
    detectedTopics: [],
    ...overrides,
  };
}

// ─── 1. Topic match scoring ───────────────────────────────────────────────────
test('topic-match: video whose topics overlap with the provided topics scores first', () => {
  const session = makeSession({ userType: 'guest' });
  const results = selectVideos(session, ['exam'], '');

  assert.ok(results.length > 0, 'should return at least one video for topic "exam"');
  const ids = results.map(v => v.id);
  assert.ok(
    ids.includes('v_exam_ready') || ids.includes('v_board_prep'),
    `expected an exam-related video; got: ${ids.join(', ')}`,
  );
});

// ─── 2. Role filtering ────────────────────────────────────────────────────────
// Role is a scoring BOOST (+2), not a hard exclusion gate.
// A video can still appear for an off-role user if there is a topic or keyword match.
// These tests assert both the boost behaviour and the hard-exclusion edge case.
test('role-boost: hr video ranks higher for hr user than for student on the same topic', () => {
  const hrSession = makeSession({ userType: 'hr' });
  const studentSession = makeSession({ userType: 'student' });

  const hrResults = selectVideos(hrSession, ['hr_hiring'], '');
  const studentResults = selectVideos(studentSession, ['hr_hiring'], '');

  const hrIds = hrResults.map(v => v.id);
  const studentIds = studentResults.map(v => v.id);

  assert.ok(hrIds.includes('v_hr_hiring'), 'hr video must appear for hr user with matching topic');
  assert.ok(studentIds.includes('v_hr_hiring'), 'hr video also appears for student when topic matches (role is a boost, not a gate)');
  assert.ok(
    hrIds.indexOf('v_hr_hiring') <= studentIds.indexOf('v_hr_hiring'),
    'v_hr_hiring must rank at least as high for an hr user as for a student',
  );
});

test('role-boost: without a matching topic a role-specific video is excluded for off-role users', () => {
  // 'student' is not in v_hr_hiring.forRoles and 'hr_hiring' is not in topics,
  // so v_hr_hiring should score 0 and be excluded entirely.
  const session = makeSession({ userType: 'student' });
  const results = selectVideos(session, [], '');

  const ids = results.map(v => v.id);
  assert.ok(!ids.includes('v_hr_hiring'), 'hr video must not appear for a student with no matching topic or keyword');
});

// ─── 3. Keyword boost ─────────────────────────────────────────────────────────
test('keyword-boost: message with "video" raises all matching scores', () => {
  const session = makeSession({ userType: 'parent' });

  const withKeyword = selectVideos(session, [], 'can you show me a video about learning');
  const withoutKeyword = selectVideos(session, [], '');

  assert.ok(
    withKeyword.length >= withoutKeyword.length,
    'keyword-boosted query should return at least as many results as plain query',
  );
  assert.ok(withKeyword.length > 0, 'keyword boost should produce at least one result');
});

test('keyword-boost: "watch", "show me", and "see" also trigger the boost', () => {
  const session = makeSession({ userType: 'guest' });

  for (const phrase of ['I want to watch something', 'show me the assessment', 'let me see how it works']) {
    const results = selectVideos(session, [], phrase);
    assert.ok(results.length > 0, `phrase "${phrase}" should produce results via keyword boost`);
  }
});

// ─── 4. Two-video cap ─────────────────────────────────────────────────────────
test('two-video-cap: never more than 2 videos returned regardless of matches', () => {
  const session = makeSession({ userType: 'guest' });
  const results = selectVideos(session, ['exam', 'lbi', 'mentor', 'career', 'institution'], 'show me a video');

  assert.ok(results.length <= 2, `should return at most 2 videos; got ${results.length}`);
});

// ─── 5. Zero-score exclusion ─────────────────────────────────────────────────
test('zero-score-exclusion: role not in any forRoles + no topics + no keyword returns no videos', () => {
  // 'job_seeker' does not appear in any video's forRoles in the catalog,
  // so without matching topics or message keywords every video scores 0.
  const session = makeSession({ userType: 'job_seeker' });
  const results = selectVideos(session, [], '');

  assert.equal(results.length, 0, 'no matching role, no topics, no keyword should yield no results');
});

// ─── 6. Session detectedTopics ───────────────────────────────────────────────
test('session-detected-topics: topics from session.detectedTopics are used for scoring', () => {
  const session = makeSession({ userType: 'guest', detectedTopics: ['mentor'] });
  const results = selectVideos(session, [], '');

  const ids = results.map(v => v.id);
  assert.ok(ids.includes('v_mentor_match'), `expected v_mentor_match; got: ${ids.join(', ')}`);
});

// ─── 7. Catalog coverage ─────────────────────────────────────────────────────
// Every entry in VIDEO_CATALOG must be reachable by at least one role+topic
// combination. If a video's forRoles or topics are misconfigured it will score
// 0 for its own data and this test will catch it immediately.
// Uses scoreVideo() directly so the result is not affected by the top-2 slice
// in selectVideos() — a valid entry with a positive score must not be hidden
// by other high-scoring videos.
test('catalog-coverage: every VIDEO_CATALOG entry scores > 0 for its own topics and first listed role', () => {
  for (const video of VIDEO_CATALOG) {
    const role = video.forRoles[0];
    assert.ok(
      role !== undefined,
      `video "${video.id}" has an empty forRoles array — every video must target at least one role`,
    );

    assert.ok(
      video.topics.length > 0,
      `video "${video.id}" has an empty topics array — every video must have at least one topic`,
    );

    const score = scoreVideo(video, role, video.topics, '');
    assert.ok(
      score > 0,
      `video "${video.id}" scored ${score} for its own topics=${JSON.stringify(video.topics)} and forRoles[0]="${role}" — it may be misconfigured`,
    );
  }
});
