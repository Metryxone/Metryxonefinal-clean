import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.CHAT_TEST_BASE_URL || 'http://localhost:8000';

function uniqSession(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function postChat(message, sessionId, opts = {}) {
  const { preferredLanguage, userRole } = opts;
  const payload = { message, sessionId };
  if (userRole !== undefined) payload.context = { userRole };
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

// ─── English fallback strings (from chat.ts defaults) ────────────────────────
const ENGLISH_GREETING =
  'Good to have you here. Who are you — a parent, student, teacher, or someone from a school or organisation?';
const ENGLISH_THANKS =
  'Of course. Is there anything else on your mind that would help figure out the right next step?';
const ENGLISH_PARENT_OPENING_FRAGMENT = 'Thank you for reaching out';

// ─── Known first words / unique fragments for each language from chat-i18n.ts ─
const LANG_STARTS = {
  hindi:   { greeting: 'आपका', thanks: 'बिल्कुल', parent_opening: 'नमस्ते' },
  tamil:   { greeting: 'வருக',  thanks: 'நிச்சயமாக', parent_opening: 'வணக்கம்' },
  telugu:  { greeting: 'స్వాగతం', thanks: 'తప్పకుండా', parent_opening: 'నమస్తే' },
  marathi: { greeting: 'स्वागत', thanks: 'अवश्य', parent_opening: 'नमस्ते' },
};

// Unique fragments that appear only in student_opening (not in greeting_no_role)
const STUDENT_OPENING_FRAGMENTS = {
  hindi:   'ज़्यादातर छात्र',
  tamil:   'பெரும்பாலான மாணவர்கள்',
  telugu:  'చాలా మంది విద్యార్థులు',
  marathi: 'बहुतेक विद्यार्थी',
};

const NON_ENGLISH_LANGS = ['hindi', 'tamil', 'telugu', 'marathi'];

// ─── Greeting tests ───────────────────────────────────────────────────────────

test('English greeting returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_greet_en');
  const data = await postChat('Hello', sessionId, { preferredLanguage: 'english' });

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes('Good to have you here'),
    `English greeting must contain English text; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} greeting returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_greet_${lang}`);
    const data = await postChat('Hello', sessionId, { preferredLanguage: lang });

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.notEqual(
      data.response,
      ENGLISH_GREETING,
      `[${lang}] greeting must NOT equal the English greeting string`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] greeting must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.startsWith(LANG_STARTS[lang].greeting),
      `[${lang}] greeting must start with "${LANG_STARTS[lang].greeting}"; got: ${data.response.slice(0, 60)}`,
    );
  });
}

// ─── Thanks tests ─────────────────────────────────────────────────────────────

test('English thanks returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_thanks_en');
  const data = await postChat('Thank you so much', sessionId, { preferredLanguage: 'english' });

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes('Is there anything else on your mind') || data.response === ENGLISH_THANKS,
    `English thanks must contain English text; got: ${data.response.slice(0, 120)}`,
  );
  assert.ok(
    !hasNonAscii(data.response),
    `English thanks must not contain non-ASCII characters; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} thanks returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_thanks_${lang}`);
    const data = await postChat('Thank you so much', sessionId, { preferredLanguage: lang });

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.notEqual(
      data.response,
      ENGLISH_THANKS,
      `[${lang}] thanks must NOT equal the English thanks string`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] thanks must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.startsWith(LANG_STARTS[lang].thanks),
      `[${lang}] thanks must start with "${LANG_STARTS[lang].thanks}"; got: ${data.response.slice(0, 60)}`,
    );
  });
}

// ─── Parent opening tests ─────────────────────────────────────────────────────
// The parent_opening script fires when the session stage is 'open' and the
// user type is identified as 'parent'.  A non-greeting message sent with
// context.userRole='parent' causes the server to set session.userType='parent'
// before the scripted-response logic runs, which returns parent_opening.

test('English parent opening returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_parent_en');
  const data = await postChat(
    'My child needs help with studies',
    sessionId,
    { preferredLanguage: 'english', userRole: 'parent' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_PARENT_OPENING_FRAGMENT),
    `English parent opening must contain "${ENGLISH_PARENT_OPENING_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} parent opening returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_parent_${lang}`);
    const data = await postChat(
      'My child needs help with studies',
      sessionId,
      { preferredLanguage: lang, userRole: 'parent' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_PARENT_OPENING_FRAGMENT),
      `[${lang}] parent opening must NOT contain English text "${ENGLISH_PARENT_OPENING_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] parent opening must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.startsWith(LANG_STARTS[lang].parent_opening),
      `[${lang}] parent opening must start with "${LANG_STARTS[lang].parent_opening}"; got: ${data.response.slice(0, 60)}`,
    );
  });
}

// ─── no_role_concern tests ────────────────────────────────────────────────────
// no_role_concern fires when stage is 'open', no userType is set, the message
// is not a greeting, not emotional, and no concern is detected.  Sending a
// neutral informational message without context.userRole triggers this path.

const ENGLISH_NO_ROLE_CONCERN_FRAGMENT = 'I want to make sure I point you in the right direction';

// Unique fragments that appear only in no_role_concern for each language
const NO_ROLE_CONCERN_FRAGMENTS = {
  hindi:   'मैं यह सुनिश्चित',
  tamil:   'நான் உங்களை',
  telugu:  'మీకు సరైన',
  marathi: 'मी तुम्हाला',
};

test('English no_role_concern returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_nrc_en');
  const data = await postChat(
    'I am looking for information',
    sessionId,
    { preferredLanguage: 'english' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_NO_ROLE_CONCERN_FRAGMENT),
    `English no_role_concern must contain "${ENGLISH_NO_ROLE_CONCERN_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} no_role_concern returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_nrc_${lang}`);
    const data = await postChat(
      'I am looking for information',
      sessionId,
      { preferredLanguage: lang },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_NO_ROLE_CONCERN_FRAGMENT),
      `[${lang}] no_role_concern must NOT contain English text "${ENGLISH_NO_ROLE_CONCERN_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] no_role_concern must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(NO_ROLE_CONCERN_FRAGMENTS[lang]),
      `[${lang}] no_role_concern must contain "${NO_ROLE_CONCERN_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── Emotional general tests ──────────────────────────────────────────────────
// emotional_general fires when intent is 'emotional' and no specific user role
// is set (no context.userRole).  "I am feeling anxious" triggers the emotional
// intent regex without hitting any of the early concern-specific handlers (e.g.
// burnout, which catches "overwhelmed"), routing cleanly to emotional_general.

const ENGLISH_EMOTIONAL_GENERAL_FRAGMENT =
  "That's completely understandable — a lot of people feel exactly that.";

// Unique fragments from each language's emotional_general translation
const EMOTIONAL_GENERAL_FRAGMENTS = {
  hindi:   'यह बिल्कुल समझ में आता है',
  tamil:   'இது மிகவும் புரிகிறது',
  telugu:  'ఇది పూర్తిగా అర్థమవుతుంది',
  marathi: 'हे पूर्णपणे समजते',
};

test('English emotional_general returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_emogen_en');
  const data = await postChat(
    'I am feeling anxious',
    sessionId,
    { preferredLanguage: 'english' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_EMOTIONAL_GENERAL_FRAGMENT),
    `English emotional_general must contain "${ENGLISH_EMOTIONAL_GENERAL_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} emotional_general returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_emogen_${lang}`);
    const data = await postChat(
      'I am feeling anxious',
      sessionId,
      { preferredLanguage: lang },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_EMOTIONAL_GENERAL_FRAGMENT),
      `[${lang}] emotional_general must NOT contain English text "${ENGLISH_EMOTIONAL_GENERAL_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] emotional_general must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(EMOTIONAL_GENERAL_FRAGMENTS[lang]),
      `[${lang}] emotional_general must contain "${EMOTIONAL_GENERAL_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── probing_no_concern_parent tests ─────────────────────────────────────────
// probing_no_concern_parent fires when stage is 'probing', session.userType is
// 'parent', and no concern is detected.  Send an opening message with
// userRole='parent' (which returns parent_opening and advances stage to
// 'probing'), then a neutral follow-up with no detectable concern.

const ENGLISH_PROBING_NO_CONCERN_PARENT_FRAGMENT =
  "To point you in the right direction — is there an exam or assessment coming up";

const PROBING_NO_CONCERN_PARENT_FRAGMENTS = {
  hindi:   'सही दिशा दिखाने के लिए',
  tamil:   'சரியான திசையில் அழைத்துச் செல்ல',
  telugu:  'సరైన దిశలో వెళ్ళడానికి',
  marathi: 'योग्य दिशा दाखवण्यासाठी',
};

test('English probing_no_concern_parent returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_pncp_en');
  await postChat('My child needs help with studies', sessionId, {
    preferredLanguage: 'english',
    userRole: 'parent',
  });
  const data = await postChat('I am not sure', sessionId, { preferredLanguage: 'english' });

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_PROBING_NO_CONCERN_PARENT_FRAGMENT),
    `English probing_no_concern_parent must contain "${ENGLISH_PROBING_NO_CONCERN_PARENT_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} probing_no_concern_parent returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_pncp_${lang}`);
    await postChat('My child needs help with studies', sessionId, {
      preferredLanguage: lang,
      userRole: 'parent',
    });
    const data = await postChat('I am not sure', sessionId, { preferredLanguage: lang });

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_PROBING_NO_CONCERN_PARENT_FRAGMENT),
      `[${lang}] probing_no_concern_parent must NOT contain English text "${ENGLISH_PROBING_NO_CONCERN_PARENT_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] probing_no_concern_parent must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(PROBING_NO_CONCERN_PARENT_FRAGMENTS[lang]),
      `[${lang}] probing_no_concern_parent must contain "${PROBING_NO_CONCERN_PARENT_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── probing_no_concern_student tests ────────────────────────────────────────
// probing_no_concern_student fires when stage is 'probing', session.userType is
// 'student', and no concern is detected.  Send an opening message with
// userRole='student' (which returns student_opening and advances stage to
// 'probing'), then a neutral follow-up with no detectable concern.

const ENGLISH_PROBING_NO_CONCERN_STUDENT_FRAGMENT =
  "Let me be more specific — is there an exam you're preparing for";

const PROBING_NO_CONCERN_STUDENT_FRAGMENTS = {
  hindi:   'थोड़ा स्पष्ट करते हैं',
  tamil:   'கொஞ்சம் தெளிவாக சொல்கிறேன்',
  telugu:  'కొంచెం స్పష్టంగా చెప్తాను',
  marathi: 'थोडे स्पष्ट करतो',
};

test('English probing_no_concern_student returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_pncs_en');
  await postChat('I need help with my studies', sessionId, {
    preferredLanguage: 'english',
    userRole: 'student',
  });
  const data = await postChat('I am not sure', sessionId, { preferredLanguage: 'english' });

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_PROBING_NO_CONCERN_STUDENT_FRAGMENT),
    `English probing_no_concern_student must contain "${ENGLISH_PROBING_NO_CONCERN_STUDENT_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} probing_no_concern_student returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_pncs_${lang}`);
    await postChat('I need help with my studies', sessionId, {
      preferredLanguage: lang,
      userRole: 'student',
    });
    const data = await postChat('I am not sure', sessionId, { preferredLanguage: lang });

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_PROBING_NO_CONCERN_STUDENT_FRAGMENT),
      `[${lang}] probing_no_concern_student must NOT contain English text "${ENGLISH_PROBING_NO_CONCERN_STUDENT_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] probing_no_concern_student must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(PROBING_NO_CONCERN_STUDENT_FRAGMENTS[lang]),
      `[${lang}] probing_no_concern_student must contain "${PROBING_NO_CONCERN_STUDENT_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── probing_no_concern_general tests ────────────────────────────────────────
// probing_no_concern_general fires when stage is 'probing', no userType is set,
// and no concern is detected.  Send a first neutral message without a role
// (which returns no_role_concern and advances stage to 'probing'), then a
// second neutral message still with no role and no detectable concern.

const ENGLISH_PROBING_NO_CONCERN_GENERAL_FRAGMENT =
  "To point you in the right direction — is this about learning and focus";

const PROBING_NO_CONCERN_GENERAL_FRAGMENTS = {
  hindi:   'सही दिशा में जाने के लिए',
  tamil:   'படிப்பு மற்றும் கவனம் பற்றியதா',
  telugu:  'నేర్చుకోవడం మరియు దృష్టి గురించా',
  marathi: 'योग्य दिशेसाठी',
};

test('English probing_no_concern_general returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_pncg_en');
  await postChat('I am looking for information', sessionId, { preferredLanguage: 'english' });
  const data = await postChat('I am not sure', sessionId, { preferredLanguage: 'english' });

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_PROBING_NO_CONCERN_GENERAL_FRAGMENT),
    `English probing_no_concern_general must contain "${ENGLISH_PROBING_NO_CONCERN_GENERAL_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} probing_no_concern_general returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_pncg_${lang}`);
    await postChat('I am looking for information', sessionId, { preferredLanguage: lang });
    const data = await postChat('I am not sure', sessionId, { preferredLanguage: lang });

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_PROBING_NO_CONCERN_GENERAL_FRAGMENT),
      `[${lang}] probing_no_concern_general must NOT contain English text "${ENGLISH_PROBING_NO_CONCERN_GENERAL_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] probing_no_concern_general must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(PROBING_NO_CONCERN_GENERAL_FRAGMENTS[lang]),
      `[${lang}] probing_no_concern_general must contain "${PROBING_NO_CONCERN_GENERAL_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── Student opening tests ────────────────────────────────────────────────────
// The student_opening script fires when stage is 'open' and session.userType is
// 'student'.  A non-greeting message with context.userRole='student' sets the
// role before scripted-response logic runs, returning student_opening.

const ENGLISH_STUDENT_OPENING_FRAGMENT = 'Most students come in with one of a few things';

test('English student opening returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_student_en');
  const data = await postChat(
    'I need help with my studies',
    sessionId,
    { preferredLanguage: 'english', userRole: 'student' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_STUDENT_OPENING_FRAGMENT),
    `English student opening must contain "${ENGLISH_STUDENT_OPENING_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} student opening returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_student_${lang}`);
    const data = await postChat(
      'I need help with my studies',
      sessionId,
      { preferredLanguage: lang, userRole: 'student' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_STUDENT_OPENING_FRAGMENT),
      `[${lang}] student opening must NOT contain English text "${ENGLISH_STUDENT_OPENING_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] student opening must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(STUDENT_OPENING_FRAGMENTS[lang]),
      `[${lang}] student opening must contain "${STUDENT_OPENING_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── emotional_student tests ──────────────────────────────────────────────────
// emotional_student fires when stage is 'open', userRole is 'student', and the
// first message has emotional intent.  "I am feeling anxious" is used because it
// reliably triggers 'emotional' intent without matching any specific concern
// keyword, so it routes to emotional_student rather than openProbingQuestion.

const ENGLISH_EMOTIONAL_STUDENT_FRAGMENT =
  "That makes complete sense — and you're not alone in feeling that way.";

const EMOTIONAL_STUDENT_FRAGMENTS = {
  hindi:   'बहुत से छात्र दबाव महसूस करते हैं',
  tamil:   'பல மாணவர்கள் அழுத்தத்தை உணர்கிறார்கள்',
  telugu:  'చాలా మంది విద్యార్థులు ఒత్తిడిని అనుభవిస్తారు',
  marathi: 'बरेच विद्यार्थी दबाव जाणवतात',
};

test('English emotional_student returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_emostudent_en');
  const data = await postChat(
    'I am feeling anxious',
    sessionId,
    { preferredLanguage: 'english', userRole: 'student' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_EMOTIONAL_STUDENT_FRAGMENT),
    `English emotional_student must contain "${ENGLISH_EMOTIONAL_STUDENT_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} emotional_student returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_emostudent_${lang}`);
    const data = await postChat(
      'I am feeling anxious',
      sessionId,
      { preferredLanguage: lang, userRole: 'student' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_EMOTIONAL_STUDENT_FRAGMENT),
      `[${lang}] emotional_student must NOT contain English text "${ENGLISH_EMOTIONAL_STUDENT_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] emotional_student must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(EMOTIONAL_STUDENT_FRAGMENTS[lang]),
      `[${lang}] emotional_student must contain "${EMOTIONAL_STUDENT_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── emotional_career tests ───────────────────────────────────────────────────
// emotional_career fires when stage is 'open', userRole is 'career', and the
// first message has emotional intent.  "I am feeling anxious" is used because it
// reliably triggers 'emotional' intent without matching any specific concern
// keyword, so it routes to emotional_career rather than openProbingQuestion.

const ENGLISH_EMOTIONAL_CAREER_FRAGMENT =
  "figuring out where you fit and what you're actually good at is genuinely hard.";

const EMOTIONAL_CAREER_FRAGMENTS = {
  hindi:   'किस दिशा में जाना है यह न जानना',
  tamil:   'நீங்கள் எங்கு பொருந்துகிறீர்கள்',
  telugu:  'మీరు ఎక్కడ సరిపోతారో',
  marathi: 'तुम्ही कुठे बसता',
};

test('English emotional_career returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_emocareer_en');
  const data = await postChat(
    'I am feeling anxious',
    sessionId,
    { preferredLanguage: 'english', userRole: 'career' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_EMOTIONAL_CAREER_FRAGMENT),
    `English emotional_career must contain "${ENGLISH_EMOTIONAL_CAREER_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} emotional_career returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_emocareer_${lang}`);
    const data = await postChat(
      'I am feeling anxious',
      sessionId,
      { preferredLanguage: lang, userRole: 'career' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_EMOTIONAL_CAREER_FRAGMENT),
      `[${lang}] emotional_career must NOT contain English text "${ENGLISH_EMOTIONAL_CAREER_FRAGMENT}"; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] emotional_career must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(EMOTIONAL_CAREER_FRAGMENTS[lang]),
      `[${lang}] emotional_career must contain "${EMOTIONAL_CAREER_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 120)}`,
    );
  });
}

// ─── open_probing_exam tests ──────────────────────────────────────────────────
// Fired by openProbingQuestion when concern='exam' and role is not 'student'.
// A single parent-role message containing an exam concern keyword triggers it
// directly: kbLookup does not match generic "exam coming up" phrasing, so
// detectConcern returns 'exam' and openProbingQuestion returns this key.

const ENGLISH_OPEN_PROBING_EXAM_FRAGMENT =
  'the overall pressure, confidence, and anxiety going into the exam';

const OPEN_PROBING_EXAM_FRAGMENTS = {
  hindi:   'वे जितना होना चाहिए उतना नहीं पहुँच पाए हैं',
  tamil:   'அவர்கள் இருக்க வேண்டிய இடத்தில் இல்லாத',
  telugu:  'వారు ఉండాల్సిన స్థాయిలో లేని నిర్దిష్ట సబ్జెక్టుల',
  marathi: 'त्यांना असायला हवं तिथपर्यंत ते पोहोचले नाहीत',
};

test('English open_probing_exam returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_opexam_en');
  const data = await postChat(
    'My child has an exam coming up',
    sessionId,
    { preferredLanguage: 'english', userRole: 'parent' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_OPEN_PROBING_EXAM_FRAGMENT),
    `English open_probing_exam must contain "${ENGLISH_OPEN_PROBING_EXAM_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} open_probing_exam returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_opexam_${lang}`);
    const data = await postChat(
      'My child has an exam coming up',
      sessionId,
      { preferredLanguage: lang, userRole: 'parent' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_OPEN_PROBING_EXAM_FRAGMENT),
      `[${lang}] open_probing_exam must NOT contain English text "${ENGLISH_OPEN_PROBING_EXAM_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] open_probing_exam must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(OPEN_PROBING_EXAM_FRAGMENTS[lang]),
      `[${lang}] open_probing_exam must contain "${OPEN_PROBING_EXAM_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 200)}`,
    );
  });
}

// ─── open_probing_exam_student tests ─────────────────────────────────────────
// Same concern='exam' path as above but role='student', so openProbingQuestion
// returns the student variant which uses second-person pronouns ("you" / आप).

const ENGLISH_OPEN_PROBING_EXAM_STUDENT_FRAGMENT =
  'the overall pressure, confidence, and anxiety going into the exam';

const OPEN_PROBING_EXAM_STUDENT_FRAGMENTS = {
  hindi:   'आप जितना होना चाहिए उतना नहीं पहुँच पाए हैं',
  tamil:   'நீங்கள் இருக்க வேண்டிய இடத்தில் இல்லாத',
  telugu:  'మీరు ఉండాల్సిన స్థాయిలో లేని నిర్దిష్ట సబ్జెక్టుల',
  marathi: 'तुम्ही असायला हवं तिथपर्यंत पोहोचला नाही',
};

test('English open_probing_exam_student returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_opexamstu_en');
  const data = await postChat(
    'I have an exam coming up',
    sessionId,
    { preferredLanguage: 'english', userRole: 'student' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_OPEN_PROBING_EXAM_STUDENT_FRAGMENT),
    `English open_probing_exam_student must contain "${ENGLISH_OPEN_PROBING_EXAM_STUDENT_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} open_probing_exam_student returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_opexamstu_${lang}`);
    const data = await postChat(
      'I have an exam coming up',
      sessionId,
      { preferredLanguage: lang, userRole: 'student' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_OPEN_PROBING_EXAM_STUDENT_FRAGMENT),
      `[${lang}] open_probing_exam_student must NOT contain English text "${ENGLISH_OPEN_PROBING_EXAM_STUDENT_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] open_probing_exam_student must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(OPEN_PROBING_EXAM_STUDENT_FRAGMENTS[lang]),
      `[${lang}] open_probing_exam_student must contain "${OPEN_PROBING_EXAM_STUDENT_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 200)}`,
    );
  });
}

// ─── open_probing_betterment tests ────────────────────────────────────────────
// concern='betterment' is detected by detectConcern when the message contains
// "failed in class".  kbLookup's betterment handler only matches "failed in
// 10th/12th/board" (not "class"), so it does NOT intercept this phrasing and
// counsellorResponse proceeds to openProbingQuestion → open_probing_betterment.

const ENGLISH_OPEN_PROBING_BETTERMENT_FRAGMENT =
  'this can be a stressful time';

const OPEN_PROBING_BETTERMENT_FRAGMENTS = {
  hindi:   'यह एक तनावपूर्ण समय हो सकता है',
  tamil:   'மன அழுத்தமான நேரமாக இருக்கலாம்',
  telugu:  'ఒత్తిడిగా ఉన్న సమయంగా ఉండవచ్చు',
  marathi: 'तणावपूर्ण काळ असू शकतो',
};

test('English open_probing_betterment returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_opbetter_en');
  const data = await postChat(
    'My child failed in class',
    sessionId,
    { preferredLanguage: 'english', userRole: 'parent' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_OPEN_PROBING_BETTERMENT_FRAGMENT),
    `English open_probing_betterment must contain "${ENGLISH_OPEN_PROBING_BETTERMENT_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} open_probing_betterment returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_opbetter_${lang}`);
    const data = await postChat(
      'My child failed in class',
      sessionId,
      { preferredLanguage: lang, userRole: 'parent' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_OPEN_PROBING_BETTERMENT_FRAGMENT),
      `[${lang}] open_probing_betterment must NOT contain English text "${ENGLISH_OPEN_PROBING_BETTERMENT_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] open_probing_betterment must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(OPEN_PROBING_BETTERMENT_FRAGMENTS[lang]),
      `[${lang}] open_probing_betterment must contain "${OPEN_PROBING_BETTERMENT_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 200)}`,
    );
  });
}

// ─── open_probing_learning tests ──────────────────────────────────────────────
// concern='learning' is detected when the message contains a focus/attention
// keyword.  kbLookup has no handler for this concern, so the request flows
// straight to openProbingQuestion → open_probing_learning (parent variant).

const ENGLISH_OPEN_PROBING_LEARNING_FRAGMENT =
  'finding it hard to focus and stay on task';

const OPEN_PROBING_LEARNING_FRAGMENTS = {
  hindi:   'ध्यान केंद्रित करने और काम पर टिके रहने में कठिनाई',
  tamil:   'கவனம் செலுத்துவதில் சிரமம் மற்றும் பணியில் நிலையாக இருப்பதைப்',
  telugu:  'కేంద్రీకరించడం మరియు పని మీద నిలబడడంలో కష్టం',
  marathi: 'लक्ष केंद्रित करणे आणि कामावर टिकून राहणे कठीण',
};

test('English open_probing_learning returns the English scripted response', async () => {
  const sessionId = uniqSession('i18n_oplearn_en');
  const data = await postChat(
    'My child cannot focus on studies',
    sessionId,
    { preferredLanguage: 'english', userRole: 'parent' },
  );

  assert.ok(
    typeof data.response === 'string' && data.response.length > 0,
    `response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
  );
  assert.ok(
    data.response.includes(ENGLISH_OPEN_PROBING_LEARNING_FRAGMENT),
    `English open_probing_learning must contain "${ENGLISH_OPEN_PROBING_LEARNING_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
  );
});

for (const lang of NON_ENGLISH_LANGS) {
  test(`${lang} open_probing_learning returns a translated (non-English) scripted response`, async () => {
    const sessionId = uniqSession(`i18n_oplearn_${lang}`);
    const data = await postChat(
      'My child cannot focus on studies',
      sessionId,
      { preferredLanguage: lang, userRole: 'parent' },
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${lang}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );
    assert.ok(
      !data.response.includes(ENGLISH_OPEN_PROBING_LEARNING_FRAGMENT),
      `[${lang}] open_probing_learning must NOT contain English text "${ENGLISH_OPEN_PROBING_LEARNING_FRAGMENT}"; got: ${data.response.slice(0, 200)}`,
    );
    assert.ok(
      hasNonAscii(data.response),
      `[${lang}] open_probing_learning must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );
    assert.ok(
      data.response.includes(OPEN_PROBING_LEARNING_FRAGMENTS[lang]),
      `[${lang}] open_probing_learning must contain "${OPEN_PROBING_LEARNING_FRAGMENTS[lang]}"; got: ${data.response.slice(0, 200)}`,
    );
  });
}

// ─── fallback_student / fallback_career / fallback_general (TODO) ─────────────
// These three keys are defined in chat-i18n.ts and referenced in chat.ts at the
// very bottom of counsellorResponse() (lines ~1010-1041).  That block is only
// reached when session.stage is not one of the four known values ('open',
// 'probing', 'narrowing', 'recommending').  Because every code path that writes
// session.stage uses one of those four literals, the fallback block is currently
// dead code and cannot be triggered through the HTTP API.
//
// The todo markers below document the intent.  If a future change introduces a
// new stage value or a code path that skips the stage handlers, these tests
// should be converted to full assertions using the fragments listed here:
//
//   fallback_student  hindi:   'अभी सबसे मुश्किल क्या लग रहा है'
//                     tamil:   'இப்போது என்ன கஷ்டமாக இருக்கிறது'
//                     telugu:  'ఇప்పుడు ఏది కష్టంగా ఉంది'
//                     marathi: 'आत्ता सर्वात कठीण काय वाटते'
//
//   fallback_career   hindi:   'आप वास्तव में क्या समझने की कोशिश कर रहे हैं'
//                     tamil:   'நீங்கள் என்ன கண்டறிய முயற்சிக்கிறீர்கள்'
//                     telugu:  'మీరు ఏమి అర్థం చేసుకోవాలని ప్రయత్నిస్తున్నారు'
//                     marathi: 'तुम्ही नक्की काय समजून घेण्याचा प्रयत्न करत आहात'
//
//   fallback_general  hindi:   'थोड़ा और बताइए — क्या हो रहा है'
//                     tamil:   'கொஞ்சம் கூடுதலாக சொல்லுங்கள் — என்ன நடக்கிறது'
//                     telugu:  'కొంచెం ఎక్కువగా చెప్పండి — ఏమి జరుగుతుందో'
//                     marathi: 'थोडे अधिक सांगा — काय होत आहे'

test.todo('fallback_student hindi/tamil/telugu/marathi — unreachable dead code path; see comment above');
test.todo('fallback_career hindi/tamil/telugu/marathi — unreachable dead code path; see comment above');
test.todo('fallback_general hindi/tamil/telugu/marathi — unreachable dead code path; see comment above');
