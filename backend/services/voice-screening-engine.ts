/**
 * Voice Screening Engine
 * ----------------------------------------------------------------------------
 * Real, provider-backed engine for the employer AI Voice Screening feature.
 *
 *   • Speech-to-text via OpenAI Whisper (`gpt-4o-mini-transcribe`).
 *   • Rubric scoring via an OpenAI chat completion (JSON mode).
 *
 * Honesty contract (do NOT relax):
 *   • Nothing is fabricated. Transcripts come from the real STT model; scores come
 *     only from the real transcripts.
 *   • A dimension with no supporting evidence scores `null` (never a fake number).
 *   • With zero captured answers the engine ABSTAINS: overall = null, no
 *     recommendation, and `abstained = true`.
 *   • If no OpenAI key is configured the engine throws `VoiceAIUnavailable` (HTTP
 *     503) so callers surface an honest "AI not configured" error instead of
 *     inventing data.
 *
 * The five screening dimensions intentionally mirror the labels already shown in
 * the employer ScreeningTab so the report UI is unchanged.
 */
import OpenAI, { toFile } from 'openai';
import { detectAudioFormat } from '../replit_integrations/audio/client';

export const VOICE_DIMENSIONS = [
  { key: 'communication_clarity', label: 'Communication Clarity' },
  { key: 'role_knowledge',        label: 'Role Knowledge' },
  { key: 'confidence_composure',  label: 'Confidence & Composure' },
  { key: 'cultural_alignment',    label: 'Cultural Alignment' },
  { key: 'responsiveness',        label: 'Responsiveness' },
] as const;

export const AI_PROVENANCE = 'openai:gpt-4o-mini-transcribe + chat-rubric';

const STT_MODEL = 'gpt-4o-mini-transcribe';

/** HTTP-503-mapped error: AI provider is not configured / unreachable. */
export class VoiceAIUnavailable extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'VoiceAIUnavailable';
  }
}

/** True only when an OpenAI-compatible key is present (managed integration or raw key). */
export function isAIConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
}

function getClient(): { client: OpenAI; model: string } {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new VoiceAIUnavailable(
      'AI not configured — set OPENAI_API_KEY (or connect the OpenAI integration) to enable voice screening.',
    );
  }
  const baseURL =
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  const model = process.env.AI_INTEGRATIONS_OPENAI_MODEL || 'gpt-4.1-mini';
  return { client: new OpenAI({ apiKey, baseURL }), model };
}

// ── Question authoring ───────────────────────────────────────────────────────
// Authored open-ended screening prompts (legitimate content — NOT model output).
// The role string is injected so the set is tailored, but the questions are
// deterministic templates so there is nothing fabricated.

export interface ScreeningQuestion {
  id: string;
  question: string;
  category: string;
  difficulty: string;
  dimension: string;
}

export function buildQuestionSet(jobTitle?: string): ScreeningQuestion[] {
  const role = (jobTitle || '').trim() || 'this role';
  const dimLabel = (k: string) => VOICE_DIMENSIONS.find((d) => d.key === k)!.label;
  return [
    {
      id: 'vs-intro',
      dimension: 'communication_clarity',
      category: dimLabel('communication_clarity'),
      difficulty: 'Easy',
      question: `To start, tell me about yourself and the experience that makes you a strong fit for ${role}.`,
    },
    {
      id: 'vs-role-core',
      dimension: 'role_knowledge',
      category: dimLabel('role_knowledge'),
      difficulty: 'Medium',
      question: `What do you see as the core responsibilities of ${role}, and how have you handled them in your past work?`,
    },
    {
      id: 'vs-role-depth',
      dimension: 'role_knowledge',
      category: dimLabel('role_knowledge'),
      difficulty: 'Hard',
      question: `Walk me through a challenging problem in ${role} that you solved — what made it hard and what did you do?`,
    },
    {
      id: 'vs-confidence',
      dimension: 'confidence_composure',
      category: dimLabel('confidence_composure'),
      difficulty: 'Medium',
      question: `Describe a high-pressure situation at work. How did you stay composed and what was the outcome?`,
    },
    {
      id: 'vs-prioritise',
      dimension: 'responsiveness',
      category: dimLabel('responsiveness'),
      difficulty: 'Medium',
      question: `How do you prioritise competing tasks and deadlines when everything feels urgent?`,
    },
    {
      id: 'vs-conflict',
      dimension: 'cultural_alignment',
      category: dimLabel('cultural_alignment'),
      difficulty: 'Medium',
      question: `Tell me about a time you disagreed with a teammate or manager. How did you handle it?`,
    },
    {
      id: 'vs-values',
      dimension: 'cultural_alignment',
      category: dimLabel('cultural_alignment'),
      difficulty: 'Easy',
      question: `What kind of work environment helps you do your best work, and what do you value in a team?`,
    },
    {
      id: 'vs-growth',
      dimension: 'communication_clarity',
      category: dimLabel('communication_clarity'),
      difficulty: 'Easy',
      question: `Where do you want to grow in the next 2–3 years, and how does ${role} fit that path?`,
    },
  ];
}

// ── Transcription ────────────────────────────────────────────────────────────

const EXT_FOR_FORMAT: Record<string, string> = {
  wav: 'wav',
  mp3: 'mp3',
  webm: 'webm',
  mp4: 'mp4',
  ogg: 'ogg',
  unknown: 'webm', // browsers default to webm/opus; Whisper accepts it natively
};

export interface TranscriptionResult {
  transcript: string;
  format: string;
  bytes: number;
}

/** Transcribe a recorded answer. Throws VoiceAIUnavailable when AI is unconfigured. */
export async function transcribeAudio(buffer: Buffer): Promise<TranscriptionResult> {
  if (!buffer || buffer.length === 0) {
    return { transcript: '', format: 'unknown', bytes: 0 };
  }
  const detected = detectAudioFormat(buffer);
  const ext = EXT_FOR_FORMAT[detected] || 'webm';
  const { client } = getClient();
  const file = await toFile(buffer, `answer.${ext}`);
  const resp = await client.audio.transcriptions.create({ file, model: STT_MODEL });
  const transcript = ((resp as any)?.text ?? '').trim();
  return { transcript, format: detected, bytes: buffer.length };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface AnswerInput {
  question: string;
  transcript: string | null;
}

export interface DimScore {
  key: string;
  label: string;
  score: number | null;
  note: string;
}

export interface ScreeningReport {
  overallScore: number | null;
  recommendation: 'Advance' | 'Hold' | 'Reject' | null;
  summary: string;
  dimensions: DimScore[];
  answeredCount: number;
  questionCount: number;
  abstained: boolean;
  provenance: string;
}

function emptyDimensions(noteWhenEmpty: string): DimScore[] {
  return VOICE_DIMENSIONS.map((d) => ({
    key: d.key,
    label: d.label,
    score: null,
    note: noteWhenEmpty,
  }));
}

export async function scoreScreening(opts: {
  jobTitle?: string;
  answers: AnswerInput[];
}): Promise<ScreeningReport> {
  const questionCount = opts.answers.length;
  const answered = opts.answers.filter((a) => (a.transcript || '').trim().length > 0);

  // Abstain honestly — no captured speech means no signal.
  if (answered.length === 0) {
    return {
      overallScore: null,
      recommendation: null,
      summary:
        'No spoken answers were captured, so no screening signal can be produced. Re-run the screening with recorded responses.',
      dimensions: emptyDimensions('Not assessed — no spoken answer captured.'),
      answeredCount: 0,
      questionCount,
      abstained: true,
      provenance: AI_PROVENANCE,
    };
  }

  const { client, model } = getClient();
  const dimList = VOICE_DIMENSIONS.map((d) => `"${d.key}" (${d.label})`).join(', ');
  const system =
    `You are an expert hiring screener. Score a candidate's spoken interview answers across exactly these five dimensions: ${dimList}.\n` +
    `Rules:\n` +
    `- Score each dimension 0-100 using ONLY evidence found in the transcripts.\n` +
    `- If a dimension has no supporting evidence, set its score to null and explain why in the note. Never guess a number.\n` +
    `- Do NOT invent facts. Be specific and cite what the candidate actually said.\n` +
    `- These are screening signals to ASSIST a human recruiter — never a final hiring decision.\n` +
    `Return STRICT JSON only, shaped exactly as: ` +
    `{"dimensions":[{"key":"communication_clarity","score":<0-100 or null>,"note":"..."}, ... all five keys ...],` +
    `"summary":"2-3 sentence honest summary","recommendation":"Advance" | "Hold" | "Reject"}`;
  const user =
    `Role: ${opts.jobTitle || '(unspecified)'}\n\nTranscribed answers:\n` +
    answered
      .map((a, i) => `Q${i + 1}: ${a.question}\nAnswer: ${(a.transcript || '').trim()}`)
      .join('\n\n');

  let parsed: any = {};
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: 'json_object' } as any,
    });
    const text = completion.choices?.[0]?.message?.content || '{}';
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch (err: any) {
    // A provider/parse failure must NOT be silently turned into fake scores.
    if (err instanceof VoiceAIUnavailable) throw err;
    throw new VoiceAIUnavailable(
      `Voice screening scorer could not produce a result (${err?.message || 'AI error'}).`,
    );
  }

  const byKey = new Map<string, any>();
  if (Array.isArray(parsed.dimensions)) {
    for (const d of parsed.dimensions) {
      if (d && d.key) byKey.set(String(d.key), d);
    }
  }

  const dimensions: DimScore[] = VOICE_DIMENSIONS.map((d) => {
    const raw = byKey.get(d.key);
    let score: number | null = null;
    if (raw && raw.score != null && Number.isFinite(Number(raw.score))) {
      score = Math.max(0, Math.min(100, Math.round(Number(raw.score))));
    }
    const note =
      raw && typeof raw.note === 'string' && raw.note.trim()
        ? raw.note.trim()
        : score == null
          ? 'Not assessed — insufficient evidence in the responses.'
          : '';
    return { key: d.key, label: d.label, score, note };
  });

  const scored = dimensions.filter((d) => d.score != null).map((d) => d.score as number);
  const overallScore = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;

  let recommendation: ScreeningReport['recommendation'] = null;
  if (['Advance', 'Hold', 'Reject'].includes(parsed.recommendation)) {
    recommendation = parsed.recommendation;
  } else if (overallScore != null) {
    recommendation = overallScore >= 72 ? 'Advance' : overallScore >= 55 ? 'Hold' : 'Reject';
  }

  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'Screening completed. Review the per-dimension notes for detail.';

  return {
    overallScore,
    recommendation,
    summary,
    dimensions,
    answeredCount: answered.length,
    questionCount,
    abstained: false,
    provenance: AI_PROVENANCE,
  };
}
