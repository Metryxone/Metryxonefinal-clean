import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.CHAT_TEST_BASE_URL || 'http://localhost:8000';

function uniqSession(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function postChat(message, sessionId, opts = {}) {
  const { preferredLanguage } = opts;
  const payload = { message, sessionId };
  if (preferredLanguage !== undefined) payload.preferredLanguage = preferredLanguage;
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function hasNonAscii(str) {
  return /[^\x00-\x7F]/.test(str);
}

const NON_ENGLISH_LANGS = ['hindi', 'tamil', 'telugu', 'marathi'];

// ─── Unique fragments per concern per language ────────────────────────────────
// Each fragment is a short, distinctive string present only in the translated
// version of that concern key (not in the English fallback).

const CONCERN_FRAGMENTS = {
  betterment: {
    english_fragment: 'Betterment or Compartment exam is not a dead end',
    hindi:   'बेटरमेंट या कम्पार्टमेंट परीक्षा',
    tamil:   'Betterment அல்லது Compartment தேர்வு',
    telugu:  'బెటర్‌మెంట్ లేదా కంపార్ట్‌మెంట్ పరీక్ష',
    marathi: 'बेटरमेंट किंवा कंपार्टमेंट परीक्षा',
    trigger: 'My child failed in the board exam and needs betterment exam help',
  },
  tuition: {
    english_fragment: 'Coaching Dependency',
    hindi:   'कोचिंग पर निर्भरता',
    tamil:   'கோச்சிங் சார்பு',
    telugu:  'కోచింగ్ ఆధారపడటం',
    marathi: 'कोचिंगवर अवलंबित्व',
    trigger: 'My child cannot study without tuition and is completely dependent on coaching',
  },
  stream: {
    english_fragment: 'Stream selection after Class 10',
    hindi:   'कक्षा 10 के बाद स्ट्रीम',
    tamil:   'வகுப்பு 10க்கு பிறகு Stream',
    telugu:  'తరగతి 10 తర్వాత స్ట్రీమ్',
    marathi: 'इयत्ता 10 नंतर Stream',
    trigger: 'Which stream should my child pick after 10th, pcm or pcb, confused about stream selection',
  },
  phone: {
    english_fragment: 'Digital Distraction',
    hindi:   'डिजिटल विकर्षण',
    tamil:   'டிஜிட்டல் திசைதிருப்பல்',
    telugu:  'డిజిటల్ దారిమళ్ళింపు',
    marathi: 'डिजिटल विचलन',
    trigger: 'My child spends all day on phone and social media and is not studying for board exams',
  },
  topper: {
    english_fragment: 'Topper Pressure',
    hindi:   'टॉपर का दबाव',
    tamil:   'Topper அழுத்தம்',
    telugu:  'టాపర్ ఒత్తిడి',
    marathi: 'Topper दबाव',
    trigger: 'Everyone keeps comparing my child to the class topper and it is affecting their confidence',
  },
  burnout: {
    english_fragment: 'Academic Burnout',
    hindi:   'शैक्षणिक बर्नआउट',
    tamil:   'கல்வி burnout',
    telugu:  'విద్యా burnout',
    marathi: 'शैक्षणिक burnout',
    trigger: 'My child is completely overwhelmed and burnt out from too much pressure from studies',
  },
};

const CONCERN_KEYS = Object.keys(CONCERN_FRAGMENTS);

// ─── English fallback tests ───────────────────────────────────────────────────

for (const concern of CONCERN_KEYS) {
  const { trigger, english_fragment } = CONCERN_FRAGMENTS[concern];

  test(`English ${concern} response returns English scripted text`, async () => {
    const sessionId = uniqSession(`i18n_init_en_${concern}`);
    const data = await postChat(trigger, sessionId, { preferredLanguage: 'english' });

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[english/${concern}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      data.response.includes(english_fragment),
      `[english/${concern}] response must contain "${english_fragment}"; got: ${data.response.slice(0, 200)}`,
    );
  });
}

// ─── Non-English translation tests ───────────────────────────────────────────

for (const concern of CONCERN_KEYS) {
  const { trigger, english_fragment } = CONCERN_FRAGMENTS[concern];

  for (const lang of NON_ENGLISH_LANGS) {
    const fragment = CONCERN_FRAGMENTS[concern][lang];

    test(`${lang} ${concern} response is translated and contains expected script`, async () => {
      const sessionId = uniqSession(`i18n_init_${lang}_${concern}`);
      const data = await postChat(trigger, sessionId, { preferredLanguage: lang });

      assert.ok(
        typeof data.response === 'string' && data.response.length > 0,
        `[${lang}/${concern}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
      );
      assert.ok(
        !data.response.includes(english_fragment),
        `[${lang}/${concern}] response must NOT contain English fragment "${english_fragment}"; got: ${data.response.slice(0, 200)}`,
      );
      assert.ok(
        hasNonAscii(data.response),
        `[${lang}/${concern}] response must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
      );
      assert.ok(
        data.response.includes(fragment),
        `[${lang}/${concern}] response must contain "${fragment}"; got: ${data.response.slice(0, 200)}`,
      );
    });
  }
}
