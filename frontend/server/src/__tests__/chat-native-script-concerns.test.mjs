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

function hasNonAscii(str) {
  return /[^\x00-\x7F]/.test(str);
}

/**
 * Each case uses a native-script (Hindi/Tamil/Telugu/Marathi) phrase that
 * appears directly in one of the six concern-detection regexes in chat.ts.
 * The tests confirm:
 *   1. sensitive: true is set (the right concern block fired)
 *   2. The response contains a known fragment from the English fallback text,
 *      proving the correct initial_* key was used.
 */
const CASES = [
  {
    name: 'Hindi "नापास" triggers betterment concern block',
    script: 'hindi',
    message: 'मेरे बच्चे के साथ नापास हो गया और अब क्या करें',
    expectInResponse: 'Betterment',
    concern: 'betterment',
  },
  {
    name: 'Marathi "नापास झालो" triggers betterment concern block',
    script: 'marathi',
    message: 'माझा मुलगा बोर्ड मध्ये नापास झालो आहे',
    expectInResponse: 'Betterment',
    concern: 'betterment',
  },
  {
    name: 'Tamil "தோல்வி" triggers betterment concern block',
    script: 'tamil',
    message: 'என் பிள்ளை board exam-ல் தோல்வி அடைந்தார்',
    expectInResponse: 'Betterment',
    concern: 'betterment',
  },
  {
    name: 'Telugu "ఫెయిల్" triggers betterment concern block',
    script: 'telugu',
    message: 'నా పిల్లాడు 10th board లో ఫెయిల్ అయ్యాడు',
    expectInResponse: 'Betterment',
    concern: 'betterment',
  },
  {
    name: 'Tamil "ட்யூஷன் இல்லாம" triggers tuition dependency concern block',
    script: 'tamil',
    message: 'என் மகன் ட்யூஷன் இல்லாம படிக்க மாட்டான்',
    expectInResponse: 'Coaching Dependency',
    concern: 'tuition',
  },
  {
    name: 'Hindi "ट्यूशन निर्भर" triggers tuition dependency concern block',
    script: 'hindi',
    message: 'मेरा बच्चा कोचिंग निर्भर हो गया है बिना ट्यूशन के नहीं पढ़ता',
    expectInResponse: 'Coaching Dependency',
    concern: 'tuition',
  },
  {
    name: 'Telugu "ట్యూషన్ లేకుండా" triggers tuition dependency concern block',
    script: 'telugu',
    message: 'నా పిల్లాడు ట్యూషన్ లేకుండా చదవడు',
    expectInResponse: 'Coaching Dependency',
    concern: 'tuition',
  },
  {
    name: 'Hindi "कौन सी स्ट्रीम" triggers stream selection concern block',
    script: 'hindi',
    message: 'दसवीं के बाद कौन सी स्ट्रीम लेनी चाहिए',
    expectInResponse: 'Stream',
    concern: 'stream',
  },
  {
    name: 'Telugu "స్ట్రీమ్ ఎంపిక" triggers stream selection concern block',
    script: 'telugu',
    message: '10వ తర్వాత స్ట్రీమ్ ఎంపిక ఎలా చేయాలి',
    expectInResponse: 'Stream',
    concern: 'stream',
  },
  {
    name: 'Hindi "फोन की लत" triggers phone addiction concern block',
    script: 'hindi',
    message: 'मेरे बच्चे को फोन की लत लग गई है पढ़ाई नहीं कर रहा',
    expectInResponse: 'Digital Distraction',
    concern: 'phone',
  },
  {
    name: 'Tamil "போன் படிப்பு" triggers phone addiction concern block',
    script: 'tamil',
    message: 'என் மகன் போன் பார்த்துக்கொண்டே படிப்பு தவிர்க்கிறான்',
    expectInResponse: 'Digital Distraction',
    concern: 'phone',
  },
  {
    name: 'Telugu "ఫోన్ చదువు" triggers phone addiction concern block',
    script: 'telugu',
    message: 'నా పిల్లాడు ఫోన్ వల్ల చదువు మానేశాడు',
    expectInResponse: 'Digital Distraction',
    concern: 'phone',
  },
  {
    name: 'Hindi "टॉपर" triggers topper pressure concern block',
    script: 'hindi',
    message: 'हम हमेशा टॉपर से तुलना करते हैं पड़ोसी का बच्चा बहुत अच्छा पढ़ता है',
    expectInResponse: 'Topper Pressure',
    concern: 'topper',
  },
  {
    name: 'Tamil "டாப்பர்" triggers topper pressure concern block',
    script: 'tamil',
    message: 'டாப்பர் மாதிரி படிக்க ஏன் முடியவில்லை என்று கேட்கிறோம்',
    expectInResponse: 'Topper Pressure',
    concern: 'topper',
  },
  {
    name: 'Telugu "టాపర్" triggers topper pressure concern block',
    script: 'telugu',
    message: 'మా పిల్లాడిని టాపర్ తో పోల్చడం వల్ల stress పెరుగుతోంది',
    expectInResponse: 'Topper Pressure',
    concern: 'topper',
  },
  {
    name: 'Marathi "टॉपर सारखा" triggers topper pressure concern block',
    script: 'marathi',
    message: 'शेजारचा मुलगा टॉपर सारखा का नाही असे विचारतो',
    expectInResponse: 'Topper Pressure',
    concern: 'topper',
  },
  {
    name: 'Hindi "बहुत दबाव" triggers burnout concern block',
    script: 'hindi',
    message: 'पढ़ाई का बहुत दबाव है बच्चे को स्कूल नहीं जाना',
    expectInResponse: 'Academic Burnout',
    concern: 'burnout',
  },
  {
    name: 'Tamil "படிக்க வேண்டாம்" triggers burnout concern block',
    script: 'tamil',
    message: 'என் மகன் படிக்க வேண்டாம் என்று சொல்கிறான் stress அதிகமா ஆகிவிட்டது',
    expectInResponse: 'Academic Burnout',
    concern: 'burnout',
  },
  {
    name: 'Telugu "చాలా ఒత్తిడి" triggers burnout concern block',
    script: 'telugu',
    message: 'నా పిల్లాడికి చాలా ఒత్తిడి వస్తోంది చదువు వద్దు అంటున్నాడు',
    expectInResponse: 'Academic Burnout',
    concern: 'burnout',
  },
  {
    name: 'Marathi "खूप थकवा" triggers burnout concern block',
    script: 'marathi',
    message: 'मुलाला खूप थकवा आहे अभ्यास नको म्हणतो',
    expectInResponse: 'Academic Burnout',
    concern: 'burnout',
  },
];

for (const c of CASES) {
  test(c.name, async () => {
    const data = await postChat(c.message, uniqSession(`native_${c.concern}_${c.script}`));

    assert.equal(
      data.sensitive,
      true,
      `[${c.script}/${c.concern}] expected sensitive=true; got ${data.sensitive}. response="${data.response?.slice(0, 200)}"`,
    );

    assert.ok(
      typeof data.response === 'string' && data.response.includes(c.expectInResponse),
      `[${c.script}/${c.concern}] expected response to contain "${c.expectInResponse}" confirming the correct concern block fired; got: ${data.response?.slice(0, 300)}`,
    );
  });
}

// ─── Translated response tests ────────────────────────────────────────────────
// Each case sends the same native-script message but with preferredLanguage set
// to match the script. The response must be translated: non-ASCII present,
// correct translated fragment present, English fragment absent.

const TRANSLATED_FRAGMENTS = {
  betterment: {
    english_fragment: 'Betterment or Compartment exam is not a dead end',
    hindi:   'बेटरमेंट या कम्पार्टमेंट परीक्षा',
    tamil:   'Betterment அல்லது Compartment தேர்வு',
    telugu:  'బెటర్‌మెంట్ లేదా కంపార్ట్‌మెంట్ పరీక్ష',
    marathi: 'बेटरमेंट किंवा कंपार्टमेंट परीक्षा',
  },
  tuition: {
    english_fragment: 'Coaching Dependency',
    hindi:   'कोचिंग पर निर्भरता',
    tamil:   'கோச்சிங் சார்பு',
    telugu:  'కోచింగ్ ఆధారపడటం',
    marathi: 'कोचिंगवर अवलंबित्व',
  },
  stream: {
    english_fragment: 'Stream selection after Class 10',
    hindi:   'कक्षा 10 के बाद स्ट्रीम',
    tamil:   'வகுப்பு 10க்கு பிறகு Stream',
    telugu:  'తరగతి 10 తర్వాత స్ట్రీమ్',
    marathi: 'इयत्ता 10 नंतर Stream',
  },
  phone: {
    english_fragment: 'Digital Distraction',
    hindi:   'डिजिटल विकर्षण',
    tamil:   'டிஜிட்டல் திசைதிருப்பல்',
    telugu:  'డిజిటల్ దారిమళ్ళింపు',
    marathi: 'डिजिटल विचलन',
  },
  topper: {
    english_fragment: 'Topper Pressure',
    hindi:   'टॉपर का दबाव',
    tamil:   'Topper அழுத்தம்',
    telugu:  'టాపర్ ఒత్తిడి',
    marathi: 'Topper दबाव',
  },
  burnout: {
    english_fragment: 'Academic Burnout',
    hindi:   'शैक्षणिक बर्नआउट',
    tamil:   'கல்வி burnout',
    telugu:  'విద్యా burnout',
    marathi: 'शैक्षणिक burnout',
  },
};

/**
 * Each case sends the native-script phrase WITH the matching preferredLanguage.
 * The response must be translated — not the English fallback.
 */
const TRANSLATED_CASES = [
  {
    name: 'Hindi "नापास" + preferredLanguage=hindi returns Hindi betterment response',
    script: 'hindi',
    concern: 'betterment',
    message: 'मेरे बच्चे के साथ नापास हो गया और अब क्या करें',
  },
  {
    name: 'Marathi "नापास झालो" + preferredLanguage=marathi returns Marathi betterment response',
    script: 'marathi',
    concern: 'betterment',
    message: 'माझा मुलगा बोर्ड मध्ये नापास झालो आहे',
  },
  {
    name: 'Tamil "தோல்வி" + preferredLanguage=tamil returns Tamil betterment response',
    script: 'tamil',
    concern: 'betterment',
    message: 'என் பிள்ளை board exam-ல் தோல்வி அடைந்தார்',
  },
  {
    name: 'Telugu "ఫెయిల్" + preferredLanguage=telugu returns Telugu betterment response',
    script: 'telugu',
    concern: 'betterment',
    message: 'నా పిల్లాడు 10th board లో ఫెయిల్ అయ్యాడు',
  },
  {
    name: 'Tamil "ட்யூஷன் இல்லாம" + preferredLanguage=tamil returns Tamil tuition response',
    script: 'tamil',
    concern: 'tuition',
    message: 'என் மகன் ட்யூஷன் இல்லாம படிக்க மாட்டான்',
  },
  {
    name: 'Hindi "ट्यूशन निर्भर" + preferredLanguage=hindi returns Hindi tuition response',
    script: 'hindi',
    concern: 'tuition',
    message: 'मेरा बच्चा कोचिंग निर्भर हो गया है बिना ट्यूशन के नहीं पढ़ता',
  },
  {
    name: 'Telugu "ట్యూషన్ లేకుండా" + preferredLanguage=telugu returns Telugu tuition response',
    script: 'telugu',
    concern: 'tuition',
    message: 'నా పిల్లాడు ట్యూషన్ లేకుండా చదవడు',
  },
  {
    name: 'Hindi "कौन सी स्ट्रीम" + preferredLanguage=hindi returns Hindi stream response',
    script: 'hindi',
    concern: 'stream',
    message: 'दसवीं के बाद कौन सी स्ट्रीम लेनी चाहिए',
  },
  {
    name: 'Telugu "స్ట్రీమ్ ఎంపిక" + preferredLanguage=telugu returns Telugu stream response',
    script: 'telugu',
    concern: 'stream',
    message: '10వ తర్వాత స్ట్రీమ్ ఎంపిక ఎలా చేయాలి',
  },
  {
    name: 'Hindi "फोन की लत" + preferredLanguage=hindi returns Hindi phone response',
    script: 'hindi',
    concern: 'phone',
    message: 'मेरे बच्चे को फोन की लत लग गई है पढ़ाई नहीं कर रहा',
  },
  {
    name: 'Tamil "போன் படிப்பு" + preferredLanguage=tamil returns Tamil phone response',
    script: 'tamil',
    concern: 'phone',
    message: 'என் மகன் போன் பார்த்துக்கொண்டே படிப்பு தவிர்க்கிறான்',
  },
  {
    name: 'Telugu "ఫోన్ చదువు" + preferredLanguage=telugu returns Telugu phone response',
    script: 'telugu',
    concern: 'phone',
    message: 'నా పిల్లాడు ఫోన్ వల్ల చదువు మానేశాడు',
  },
  {
    name: 'Hindi "टॉपर" + preferredLanguage=hindi returns Hindi topper response',
    script: 'hindi',
    concern: 'topper',
    message: 'हम हमेशा टॉपर से तुलना करते हैं पड़ोसी का बच्चा बहुत अच्छा पढ़ता है',
  },
  {
    name: 'Tamil "டாப்பர்" + preferredLanguage=tamil returns Tamil topper response',
    script: 'tamil',
    concern: 'topper',
    message: 'டாப்பர் மாதிரி படிக்க ஏன் முடியவில்லை என்று கேட்கிறோம்',
  },
  {
    name: 'Telugu "టాపర్" + preferredLanguage=telugu returns Telugu topper response',
    script: 'telugu',
    concern: 'topper',
    message: 'మా పిల్లాడిని టాపర్ తో పోల్చడం వల్ల stress పెరుగుతోంది',
  },
  {
    name: 'Marathi "टॉपर सारखा" + preferredLanguage=marathi returns Marathi topper response',
    script: 'marathi',
    concern: 'topper',
    message: 'शेजारचा मुलगा टॉपर सारखा का नाही असे विचारतो',
  },
  {
    name: 'Hindi "बहुत दबाव" + preferredLanguage=hindi returns Hindi burnout response',
    script: 'hindi',
    concern: 'burnout',
    message: 'पढ़ाई का बहुत दबाव है बच्चे को स्कूल नहीं जाना',
  },
  {
    name: 'Tamil "படிக்க வேண்டாம்" + preferredLanguage=tamil returns Tamil burnout response',
    script: 'tamil',
    concern: 'burnout',
    message: 'என் மகன் படிக்க வேண்டாம் என்று சொல்கிறான் stress அதிகமா ஆகிவிட்டது',
  },
  {
    name: 'Telugu "చాలా ఒత్తిడి" + preferredLanguage=telugu returns Telugu burnout response',
    script: 'telugu',
    concern: 'burnout',
    message: 'నా పిల్లాడికి చాలా ఒత్తిడి వస్తోంది చదువు వద్దు అంటున్నాడు',
  },
  {
    name: 'Marathi "खूप थकवा" + preferredLanguage=marathi returns Marathi burnout response',
    script: 'marathi',
    concern: 'burnout',
    message: 'मुलाला खूप थकवा आहे अभ्यास नको म्हणतो',
  },
];

for (const c of TRANSLATED_CASES) {
  test(c.name, async () => {
    const { english_fragment, [c.script]: translatedFragment } = TRANSLATED_FRAGMENTS[c.concern];
    const data = await postChat(
      c.message,
      uniqSession(`native_translated_${c.concern}_${c.script}`),
      c.script,
    );

    assert.equal(
      data.sensitive,
      true,
      `[${c.script}/${c.concern}] expected sensitive=true; got ${data.sensitive}. response="${data.response?.slice(0, 200)}"`,
    );

    assert.ok(
      typeof data.response === 'string' && data.response.length > 0,
      `[${c.script}/${c.concern}] response must be a non-empty string; got: ${JSON.stringify(data.response)}`,
    );

    assert.ok(
      !data.response.includes(english_fragment),
      `[${c.script}/${c.concern}] response must NOT contain English fragment "${english_fragment}"; got: ${data.response.slice(0, 200)}`,
    );

    assert.ok(
      hasNonAscii(data.response),
      `[${c.script}/${c.concern}] response must contain non-ASCII (script) characters; got: ${data.response.slice(0, 120)}`,
    );

    assert.ok(
      data.response.includes(translatedFragment),
      `[${c.script}/${c.concern}] response must contain translated fragment "${translatedFragment}"; got: ${data.response.slice(0, 200)}`,
    );
  });
}
