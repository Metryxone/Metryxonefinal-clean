import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.CHAT_TEST_BASE_URL || 'http://localhost:8000';

async function postChat(message, sessionId, preferredLanguage = 'english') {
  const res = await fetch(`${BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId, preferredLanguage }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

function uniqSession(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── K-12 school block: unique fragment present in the block response ─────────
// A generic/fallback response would NOT contain this exact phrase.
const K12_FRAGMENT = 'K-12 school solution';

// ─── Coaching institute block: unique fragment present in the block response ──
const COACHING_FRAGMENT = 'competitive exam coaching institutes';

/**
 * K-12 school detection cases.
 *
 * Each phrase is taken directly from one of the regex branches added in task
 * #100 for Hindi (transliterated and native script), Tamil, Telugu, and
 * Marathi.  The test verifies that the K-12 block fires — not a generic
 * fallback — by checking for the unique phrase "K-12 school solution" that
 * only exists in that block's hardcoded response.
 */
const K12_CASES = [
  {
    name: 'Hindi transliterated "school mein" triggers K-12 block',
    message: 'hamare school mein students ke liye kya solution hai',
    script: 'hindi_transliterated',
  },
  {
    name: 'Hindi transliterated "vidyalay" triggers K-12 block',
    message: 'vidyalay ke liye koi behavioural assessment hai kya',
    script: 'hindi_transliterated',
  },
  {
    name: 'Hindi transliterated "shala" triggers K-12 block',
    message: 'amchi shala madhye kahi solution ahe ka',
    script: 'marathi_transliterated',
  },
  {
    name: 'Hindi native script "स्कूल" triggers K-12 block',
    message: 'हमारे स्कूल में बच्चों के लिए कोई समाधान है क्या',
    script: 'hindi',
  },
  {
    name: 'Hindi native script "विद्यालय" triggers K-12 block',
    message: 'हमारे विद्यालय के लिए क्या कोई प्लेटफ़ॉर्म है',
    script: 'hindi',
  },
  {
    name: 'Hindi native script "सरकारी स्कूल" triggers K-12 block',
    message: 'सरकारी स्कूल के लिए भी MetryxOne उपलब्ध है क्या',
    script: 'hindi',
  },
  {
    name: 'Tamil native script "பள்ளி" triggers K-12 block',
    message: 'எங்கள் பள்ளி மாணவர்களுக்கு என்ன தீர்வு உள்ளது',
    script: 'tamil',
  },
  {
    name: 'Tamil native script "பள்ளிக்கூடம்" triggers K-12 block',
    message: 'இந்த பள்ளிக்கூடம் MetryxOne பயன்படுத்தலாமா',
    script: 'tamil',
  },
  {
    name: 'Tamil native script "அரசு பள்ளி" triggers K-12 block',
    message: 'அரசு பள்ளி மாணவர்களுக்கும் இது பொருந்துமா',
    script: 'tamil',
  },
  {
    name: 'Telugu native script "పాఠశాల" triggers K-12 block',
    message: 'మా పాఠశాల విద్యార్థులకు ఏమైనా పరిష్కారం ఉందా',
    script: 'telugu',
  },
  {
    name: 'Telugu native script "ప్రభుత్వ పాఠశాల" triggers K-12 block',
    message: 'ప్రభుత్వ పాఠశాల కోసం MetryxOne అందుబాటులో ఉందా',
    script: 'telugu',
  },
  {
    name: 'Marathi native script "शाळा" triggers K-12 block',
    message: 'आमच्या शाळा साठी काही सोल्युशन आहे का',
    script: 'marathi',
  },
  {
    name: 'Marathi native script "इंग्रजी माध्यम" triggers K-12 block',
    message: 'इंग्रजी माध्यम शाळेसाठी हे उपयुक्त आहे का',
    script: 'marathi',
  },
  {
    name: 'English "cbse" triggers K-12 block',
    message: 'does MetryxOne work for cbse schools',
    script: 'english',
  },
  {
    name: 'English "k-12" triggers K-12 block',
    message: 'what is the k-12 solution for schools',
    script: 'english',
  },
];

for (const c of K12_CASES) {
  test(c.name, async () => {
    const data = await postChat(
      c.message,
      uniqSession(`k12_${c.script}`),
      'english',
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[k12/${c.script}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );

    assert.ok(
      data.response.includes(K12_FRAGMENT),
      `[k12/${c.script}] response must contain "${K12_FRAGMENT}" confirming the K-12 block fired (not a generic fallback); got: ${data.response.slice(0, 300)}`,
    );
  });
}

/**
 * Coaching institute detection cases.
 *
 * Each phrase is taken directly from one of the regex branches added in task
 * #100 for Hindi (transliterated and native script), Tamil, Telugu, and
 * Marathi.  The test verifies that the coaching institute block fires — not a
 * generic fallback — by checking for the unique phrase
 * "competitive exam coaching institutes" that only exists in that block's
 * hardcoded response.
 */
const COACHING_CASES = [
  {
    name: 'Hindi transliterated "coaching mein" triggers coaching block',
    message: 'coaching mein students ke liye kya solution hai',
    script: 'hindi_transliterated',
  },
  {
    name: 'Hindi transliterated "coaching ke liye" triggers coaching block',
    message: 'coaching ke liye koi assessment platform hai kya',
    script: 'hindi_transliterated',
  },
  {
    name: 'Hindi transliterated "tuition centre" triggers coaching block',
    message: 'our tuition centre needs batch analytics',
    script: 'transliterated',
  },
  {
    name: 'Hindi transliterated "padhai kendra" triggers coaching block',
    message: 'hamara padhai kendra batch analytics chahiye',
    script: 'hindi_transliterated',
  },
  {
    name: 'Hindi native script "कोचिंग" triggers coaching block',
    message: 'हमारी कोचिंग के लिए बैच एनालिटिक्स चाहिए',
    script: 'hindi',
  },
  {
    name: 'Hindi native script "पढ़ाई केंद्र" triggers coaching block',
    message: 'हमारे पढ़ाई केंद्र में विद्यार्थियों के लिए बैच एनालिटिक्स चाहिए',
    script: 'hindi',
  },
  {
    name: 'Hindi native script "ट्यूशन" triggers coaching block',
    message: 'मेरा ट्यूशन सेंटर है, क्या MetryxOne मदद करेगा',
    script: 'hindi',
  },
  {
    name: 'Tamil native script "கோச்சிங்" triggers coaching block',
    message: 'கோச்சிங் மாணவர்களுக்கு என்ன தீர்வு உள்ளது',
    script: 'tamil',
  },
  {
    name: 'Tamil native script "பயிற்சி நிலையம்" triggers coaching block',
    message: 'எங்கள் பயிற்சி நிலையம் மாணவர்களுக்கு batch analytics வேண்டும்',
    script: 'tamil',
  },
  {
    name: 'Tamil native script "ட்யூஷன்" triggers coaching block',
    message: 'ட்யூஷன் மாணவர்களுக்கு batch analytics வேண்டும்',
    script: 'tamil',
  },
  {
    name: 'Telugu native script "కోచింగ్ సెంటర్" triggers coaching block',
    message: 'మా కోచింగ్ సెంటర్ లో విద్యార్థులకు batch analytics కావాలి',
    script: 'telugu',
  },
  {
    name: 'Telugu native script "శిక్షణ కేంద్రం" triggers coaching block',
    message: 'మా శిక్షణ కేంద్రం కోసం MetryxOne సహాయపడుతుందా',
    script: 'telugu',
  },
  {
    name: 'Telugu native script "ట్యూషన్" triggers coaching block',
    message: 'ట్యూషన్ సెంటర్ లో batch analytics అవసరం',
    script: 'telugu',
  },
  {
    name: 'Marathi native script "शिकवणी" triggers coaching block',
    message: 'आमच्या शिकवणी साठी काही बॅच अॅनालिटिक्स आहे का',
    script: 'marathi',
  },
  {
    name: 'Marathi native script "कोचिंग क्लास" triggers coaching block',
    message: 'कोचिंग क्लास साठी MetryxOne कसे वापरायचे',
    script: 'marathi',
  },
  {
    name: 'English "coaching institute" triggers coaching block',
    message: 'we run a coaching institute and need batch analytics',
    script: 'english',
  },
  {
    name: 'English institute name "aakash" triggers coaching block',
    message: 'does MetryxOne work for institutes like aakash',
    script: 'english',
  },
];

for (const c of COACHING_CASES) {
  test(c.name, async () => {
    const data = await postChat(
      c.message,
      uniqSession(`coaching_${c.script}`),
      'english',
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[coaching/${c.script}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );

    assert.ok(
      data.response.includes(COACHING_FRAGMENT),
      `[coaching/${c.script}] response must contain "${COACHING_FRAGMENT}" confirming the coaching block fired (not a generic fallback); got: ${data.response.slice(0, 300)}`,
    );
  });
}

// ─── Translated response cases ────────────────────────────────────────────────
// When preferredLanguage is set to a non-English language the K-12 and coaching
// blocks must reply in that language.  We verify:
//   1. The English-only unique fragment is ABSENT (no silent English fallback)
//   2. A known fragment from the translated string is PRESENT
//   3. The response contains non-ASCII characters (proof of script presence)

const TRANSLATED_K12_CASES = [
  {
    name: 'Hindi preferredLanguage: K-12 response in Hindi (no English fragment)',
    message: 'हमारे स्कूल में बच्चों के लिए कोई समाधान है क्या',
    lang: 'hindi',
    expectFragment: 'स्कूल समाधान',
    absentFragment: K12_FRAGMENT,
  },
  {
    name: 'Tamil preferredLanguage: K-12 response in Tamil (no English fragment)',
    message: 'எங்கள் பள்ளி மாணவர்களுக்கு என்ன தீர்வு உள்ளது',
    lang: 'tamil',
    expectFragment: 'பள்ளி தீர்வு',
    absentFragment: K12_FRAGMENT,
  },
  {
    name: 'Telugu preferredLanguage: K-12 response in Telugu (no English fragment)',
    message: 'మా పాఠశాల విద్యార్థులకు ఏమైనా పరిష్కారం ఉందా',
    lang: 'telugu',
    expectFragment: 'పాఠశాల పరిష్కారం',
    absentFragment: K12_FRAGMENT,
  },
  {
    name: 'Marathi preferredLanguage: K-12 response in Marathi (no English fragment)',
    message: 'आमच्या शाळा साठी काही सोल्युशन आहे का',
    lang: 'marathi',
    expectFragment: 'शाळा समाधान',
    absentFragment: K12_FRAGMENT,
  },
];

for (const c of TRANSLATED_K12_CASES) {
  test(c.name, async () => {
    const data = await postChat(
      c.message,
      uniqSession(`k12_trans_${c.lang}`),
      c.lang,
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[k12_translated/${c.lang}] response must be a non-empty string`,
    );

    assert.ok(
      data.response.includes(c.expectFragment),
      `[k12_translated/${c.lang}] response must contain "${c.expectFragment}" confirming translated K-12 block fired; got: ${data.response.slice(0, 300)}`,
    );

    assert.ok(
      !data.response.includes(c.absentFragment),
      `[k12_translated/${c.lang}] English fragment "${c.absentFragment}" must NOT appear in a ${c.lang} response; got: ${data.response.slice(0, 300)}`,
    );

    assert.ok(
      /[^\x00-\x7F]/.test(data.response),
      `[k12_translated/${c.lang}] response must contain non-ASCII characters (native script); got: ${data.response.slice(0, 200)}`,
    );
  });
}

const TRANSLATED_COACHING_CASES = [
  {
    name: 'Hindi preferredLanguage: coaching response in Hindi (no English fragment)',
    message: 'हमारी कोचिंग के लिए बैच एनालिटिक्स चाहिए',
    lang: 'hindi',
    expectFragment: 'कोचिंग संस्थानों',
    absentFragment: COACHING_FRAGMENT,
  },
  {
    name: 'Tamil preferredLanguage: coaching response in Tamil (no English fragment)',
    message: 'எங்கள் பயிற்சி நிலையம் மாணவர்களுக்கு batch analytics வேண்டும்',
    lang: 'tamil',
    expectFragment: 'பயிற்சி நிலையங்களுக்காக',
    absentFragment: COACHING_FRAGMENT,
  },
  {
    name: 'Telugu preferredLanguage: coaching response in Telugu (no English fragment)',
    message: 'మా కోచింగ్ సెంటర్ లో విద్యార్థులకు batch analytics కావాలి',
    lang: 'telugu',
    expectFragment: 'కోచింగ్ సంస్థలకు',
    absentFragment: COACHING_FRAGMENT,
  },
  {
    name: 'Marathi preferredLanguage: coaching response in Marathi (no English fragment)',
    message: 'कोचिंग क्लास साठी MetryxOne कसे वापरायचे',
    lang: 'marathi',
    expectFragment: 'कोचिंग संस्थांसाठी',
    absentFragment: COACHING_FRAGMENT,
  },
];

for (const c of TRANSLATED_COACHING_CASES) {
  test(c.name, async () => {
    const data = await postChat(
      c.message,
      uniqSession(`coaching_trans_${c.lang}`),
      c.lang,
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[coaching_translated/${c.lang}] response must be a non-empty string`,
    );

    assert.ok(
      data.response.includes(c.expectFragment),
      `[coaching_translated/${c.lang}] response must contain "${c.expectFragment}" confirming translated coaching block fired; got: ${data.response.slice(0, 300)}`,
    );

    assert.ok(
      !data.response.includes(c.absentFragment),
      `[coaching_translated/${c.lang}] English fragment "${c.absentFragment}" must NOT appear in a ${c.lang} response; got: ${data.response.slice(0, 300)}`,
    );

    assert.ok(
      /[^\x00-\x7F]/.test(data.response),
      `[coaching_translated/${c.lang}] response must contain non-ASCII characters (native script); got: ${data.response.slice(0, 200)}`,
    );
  });
}
