// ─── Proxy / perspective language engine ──────────────────────────────────────
// Clarity questions are authored in self-report second person ("how confident are
// you that you can…"). In PROXY mode (a parent / teacher / counsellor / founder
// rating someone else) that reads wrong — the rater reports ON the subject, not
// about themselves. This module rewrites the question so it refers to the assessed
// person: the subject is NAMED exactly once (at the first reference), and every
// later reference degrades to gender-neutral they / their / them / themselves so we
// never repeat the noun. Question ids + options are never touched, so scoring +
// Likert routing are unaffected.
//
// Extracted from routes/capadex-concern-intelligence.ts (2026-05-31) and hardened
// to remove the runtime defects surfaced by the Phase-1 audit:
//   • "inside Abhi"          — the subject was named mid-sentence after an
//                              unrecognised preposition; the preposition set is now
//                              wide and prepositional-object "you" → "them".
//   • "your child they"      — double substitution; the subject is now anchored
//                              exactly once and duplicate pronouns are collapsed.
//   • broken subject-verb    — a named singular subject now conjugates a following
//     agreement                bare present-tense verb (you face → Abhi faces).
//   • embedded first person  — "feel I cannot focus" / "tell yourself I will start"
//                              is normalised to second person before reframing.

const AUX_THIRD_PERSON: Record<string, string> = {
  are: 'is', were: 'was', do: 'does', have: 'has',
  // modals + already-third-person auxiliaries pass through unchanged
  did: 'did', is: 'is', was: 'was', does: 'does', has: 'has',
  can: 'can', could: 'could', would: 'would', will: 'will',
  shall: 'shall', should: 'should', may: 'may', might: 'might', must: 'must',
};

const AUXES =
  'are|were|do|does|did|have|has|can|could|would|will|shall|should|may|might|must|is|was';

// Wider preposition set than the original so prepositional-object "you" is always
// caught (fixes mid-sentence subject injection like "inside Abhi").
const PREPS =
  'to|for|with|about|of|at|on|from|like|than|between|around|toward|towards|by|into|onto|' +
  'inside|within|without|behind|beyond|under|over|near|against|among|amongst|upon|off|out|' +
  'through|across|after|before|during|beside|besides|past|throughout';

// Common present-tense main verbs that appear in the curated bank. When a named
// (singular) subject is anchored at a *bare* "you" (no auxiliary carrying the
// agreement), the following base verb must take the 3rd-person -s.
const PRESENT_VERBS = new Set([
  'feel', 'think', 'face', 'want', 'need', 'try', 'find', 'get', 'deal', 'cope',
  'handle', 'compare', 'avoid', 'delay', 'struggle', 'worry', 'notice', 'believe',
  'imagine', 'picture', 'calm', 'push', 'ignore', 'isolate', 'react', 'respond',
  'stay', 'keep', 'manage', 'tend', 'start', 'study', 'prepare', 'plan', 'focus',
  'panic', 'freeze', 'procrastinate', 'overthink', 'doubt', 'fear', 'dread',
  'experience', 'expect', 'hesitate', 'blame', 'pretend', 'hide',
  'lose', 'perform', 'complete', 'recover', 'reflect', 'engage', 'behave',
  'approach', 'improve', 'learn', 'rush', 'withdraw', 'escape', 'crave',
  'resist', 'seek', 'rest', 'act', 'compare',
]);

function thirdPersonVerb(v: string): string {
  const w = v.toLowerCase();
  if (/(s|sh|ch|x|z)$/.test(w)) return w + 'es';
  if (/[^aeiou]o$/.test(w)) return w + 'es'; // go -> goes (do handled by aux)
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies'; // try -> tries
  return w + 's';
}

// Resolve the noun phrase used to refer to the assessed person in proxy mode.
// A provided name wins; otherwise we fall back to a relationship noun keyed on
// the rater's persona.
export function proxySubjectNoun(
  primaryPersona?: string | null,
  assesseeName?: string | null,
): string {
  const name = (assesseeName ?? '').trim();
  if (name) return name;
  const key = String(primaryPersona ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (key === 'parent') return 'your child';
  if (/founder|startup|venture|ceo|cofounder|co_founder/.test(key)) return 'your team member';
  if (/teacher|educator|counsellor|counselor|placement|principal|leadership|coach|mentor/.test(key)) {
    return 'your student';
  }
  return 'this person';
}

// Normalise embedded first-person fragments back to canonical self-report second
// person. The curated bank occasionally contains stems like "…feel I cannot focus"
// or "tell yourself I will start later" — an "I"/"my"/"we" with no antecedent that
// breaks BOTH the learner reading and the proxy reframe. This is whole-word and
// case-insensitive; it runs before any perspective rewrite.
export function normalizeSelfReport(text: string): string {
  if (!text) return text;
  let out = text;
  // first-person contractions first, so the bare-pronoun pass doesn't strand them
  // (e.g. "I'm" must not become "you'm").
  out = out
    .replace(/\bI'm\b/gi, "you're")
    .replace(/\bI'll\b/gi, "you'll")
    .replace(/\bI've\b/gi, "you've")
    .replace(/\bI'd\b/gi, "you'd");
  out = out
    .replace(/\bI\b/g, 'you')
    .replace(/\bmyself\b/gi, 'yourself')
    .replace(/\bourselves\b/gi, 'yourselves')
    .replace(/\bourself\b/gi, 'yourself')
    .replace(/\bmine\b/gi, 'yours')
    .replace(/\bours\b/gi, 'yours')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bour\b/gi, 'your')
    .replace(/\bme\b/gi, 'you')
    .replace(/\bus\b/gi, 'you')
    .replace(/\bwe\b/gi, 'you');
  // be-verb agreement after the converted subject: "I am" → "you am" is wrong,
  // must read "you are"; likewise "I was" → "you were".
  out = out
    .replace(/\byou am\b/gi, 'you are')
    .replace(/\byou was\b/gi, 'you were');
  // collapse the artefacts the above can produce
  out = out
    .replace(/\byou you\b/gi, 'you')
    .replace(/\byour your\b/gi, 'your');
  return out;
}

const SENTINEL = '\u0000SUBJ\u0000';

// Rewrite a self-report (2nd-person) question so it refers to `subject` in the
// third person. Pure + deterministic.
export function rephraseForProxy(text: string, subject: string): string {
  if (!text) return text;

  // 0) canonicalise embedded first person, then expand contractions so every
  //    "you're / you've / you'll / you'd" participates uniformly in anchoring.
  let out = normalizeSelfReport(text);
  out = out
    .replace(/\byou're\b/gi, 'you are')
    .replace(/\byou've\b/gi, 'you have')
    .replace(/\byou'll\b/gi, 'you will')
    .replace(/\byou'd\b/gi, 'you would');

  // 1) reflexives are never a good naming anchor → singular they reflexive.
  out = out.replace(/\byourselves\b/gi, 'themselves').replace(/\byourself\b/gi, 'themselves');

  // 2) trailing tag question (", … are you?") — keep the auxiliary, swap pronoun
  //    only, so the subject isn't wrongly injected into the tag.
  out = out.replace(
    new RegExp(`,\\s*(${AUXES})\\s+you(\\s*\\??)\\s*$`, 'i'),
    (_m, aux, tail) => `, ${aux} they${tail}`,
  );

  // 3) Anchor the subject NAME at the first *subject* reference. The grammatical
  //    form at that occurrence decides how we conjugate around it.
  const conjugate = (aux: string, capitalise: boolean) => {
    let c = AUX_THIRD_PERSON[aux.toLowerCase()] ?? aux.toLowerCase();
    if (capitalise && /^[A-Z]/.test(aux)) c = c.charAt(0).toUpperCase() + c.slice(1);
    return c;
  };

  // Classify every second-person reference by its surrounding tokens, then anchor
  // at the first one that is NOT a prepositional object. Naming a prep-object
  // ("inside you") produced the "inside Abhi" defect — those always degrade to
  // "them" (step 5). A prep-object is named only as a last resort, when the stem
  // has no subject reference at all (e.g. "what happens to you?").
  const auxList = AUXES.split('|');
  const prepSet = new Set(PREPS.split('|'));
  type Occ = {
    start: number; end: number;
    prevRaw: string; prevWord: string; prevAt: number;
    nextRaw: string; nextWord: string; nextEnd: number;
  };
  const occs: Occ[] = [];
  const occRe = /\byou\b/gi;
  for (let om: RegExpExecArray | null; (om = occRe.exec(out)); ) {
    const start = om.index;
    const end = start + om[0].length;
    const pm = out.slice(0, start).match(/(\w+)(\s+)$/);
    const nm = out.slice(end).match(/^(\s+)(\w+)/);
    occs.push({
      start, end,
      prevRaw: pm ? pm[1] : '',
      prevWord: pm ? pm[1].toLowerCase() : '',
      prevAt: pm ? start - pm[0].length : start,
      nextRaw: nm ? nm[2] : '',
      nextWord: nm ? nm[2].toLowerCase() : '',
      nextEnd: nm ? end + nm[0].length : end,
    });
  }
  const isPrep = (o: Occ) => prepSet.has(o.prevWord);
  const isInv = (o: Occ) => auxList.includes(o.prevWord); // "are you"
  const isSubjAux = (o: Occ) => auxList.includes(o.nextWord); // "you are"
  const anchor = occs.find((o) => !isPrep(o)) ?? occs[0];
  if (anchor) {
    if (isInv(anchor)) {
      // "are you" → "<is> SUBJ"
      out =
        out.slice(0, anchor.prevAt) +
        conjugate(anchor.prevRaw, true) + ' ' + SENTINEL +
        out.slice(anchor.end);
    } else if (isSubjAux(anchor)) {
      // "you are" → "SUBJ <is>"
      out =
        out.slice(0, anchor.start) +
        SENTINEL + ' ' + conjugate(anchor.nextRaw, false) +
        out.slice(anchor.nextEnd);
    } else if (isPrep(anchor)) {
      // last resort: keep the preposition, name its object.
      out = out.slice(0, anchor.start) + SENTINEL + out.slice(anchor.end);
    } else {
      // bare subject carries no auxiliary, so conjugate a following present-tense
      // base verb for the now-singular subject (you face → Abhi faces).
      out = out.slice(0, anchor.start) + SENTINEL + out.slice(anchor.end);
      out = out.replace(
        new RegExp(`${SENTINEL}\\s+([a-zA-Z]+)\\b`),
        (m, w: string) => (PRESENT_VERBS.has(w.toLowerCase()) ? `${SENTINEL} ${thirdPersonVerb(w)}` : m),
      );
    }
  }

  // 4) possessives → their / theirs
  out = out.replace(/\byours\b/gi, 'theirs').replace(/\byour\b/gi, 'their');
  // 5) any remaining prepositional-object "you" → them
  out = out.replace(new RegExp(`\\b(${PREPS})\\s+you\\b`, 'gi'), '$1 them');
  // 6) any remaining subject "you" → they
  out = out.replace(/\byou\b/gi, 'they');

  // 7) restore the real subject noun
  out = out.split(SENTINEL).join(subject);

  // 8) defensive grammar + adjacency sweeps. No-ops on well-formed output.
  out = out
    .replace(/\bis is\b/gi, 'is')
    .replace(/\bdoes feel\b/gi, 'feels')
    .replace(/\bthey is\b/gi, 'they are')
    .replace(/\bthey was\b/gi, 'they were')
    .replace(/\bthey has\b/gi, 'they have')
    .replace(/\bthey does\b/gi, 'they do')
    .replace(/\bthey they\b/gi, 'they')
    .replace(/\btheir their\b/gi, 'their')
    .replace(/\bthem them\b/gi, 'them')
    .replace(/\bthemselves themselves\b/gi, 'themselves');

  // 9) re-capitalise the opening word in case the subject / a pronoun landed first.
  return out.replace(/^(\s*)([a-z])/, (_m, ws, ch) => ws + ch.toUpperCase());
}
