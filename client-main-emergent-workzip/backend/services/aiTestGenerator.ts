import OpenAI from "openai";

// ✅ Lazy client (doesn't crash at import-time)
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  return new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
}
function safeJsonParse<T = any>(raw: string, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    const preview = raw.length > 400 ? raw.slice(0, 400) + "…" : raw;
    throw new Error(`Invalid JSON returned by AI for ${context}. Preview: ${preview}`);
  }
}

export interface LBIInsight {
  category: string;
  score: number;
  interpretation: string;
}

export interface GeneratedQuestion {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string; // "A" | "B" | "C" | "D"
  explanation: string;
  difficulty: string; // "easy" | "medium" | "hard"
  bloomsLevel: string;
  topic: string;
}

export interface AITestGenerationParams {
  childName: string;
  childAge: number;
  childGrade: string;
  subject: string;
  chapter?: string;
  topic?: string;
  questionCount: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  bloomsLevel?: "remember" | "understand" | "apply" | "analyze" | "mixed";
  includeExplanations?: boolean;
  focusOnWeakAreas?: boolean;
  timeLimit?: number;
  lbiInsights?: LBIInsight[];
  weakAreas?: string[];
  focusAreas?: string[];
}

export interface AITestResult {
  title: string;
  subject: string;
  description: string;
  questions: GeneratedQuestion[];
  estimatedDuration: number;
  totalMarks: number;
  passingMarks: number;
  generatedAt: string;
  personalizationNotes: string;
}

type AITestAIResponse = {
  title?: string;
  description?: string;
  personalizationNotes?: string;
  questions?: GeneratedQuestion[];
};

function normalizeQuestions(qs: any, expectedCount: number): GeneratedQuestion[] {
  if (!Array.isArray(qs)) return [];

  const cleaned: GeneratedQuestion[] = qs
    .map((q) => ({
      questionText: String(q?.questionText ?? "").trim(),
      optionA: String(q?.optionA ?? "").trim(),
      optionB: String(q?.optionB ?? "").trim(),
      optionC: String(q?.optionC ?? "").trim(),
      optionD: String(q?.optionD ?? "").trim(),
      correctOption: String(q?.correctOption ?? "").trim().toUpperCase(),
      explanation: String(q?.explanation ?? "").trim(),
      difficulty: String(q?.difficulty ?? "").trim().toLowerCase(),
      bloomsLevel: String(q?.bloomsLevel ?? "").trim(),
      topic: String(q?.topic ?? "").trim() || "General",
    }))
    .filter((q) => q.questionText && ["A", "B", "C", "D"].includes(q.correctOption));

  // Don’t hard fail if count differs, but cap to requested count
  return cleaned.slice(0, expectedCount);
}

export async function generateAITest(params: AITestGenerationParams): Promise<AITestResult> {
  const {
    childName,
    childAge,
    childGrade,
    subject,
    chapter,
    topic,
    questionCount,
    difficulty,
    bloomsLevel = "mixed",
    includeExplanations = true,
    focusOnWeakAreas = true,
    timeLimit,
    lbiInsights,
    weakAreas,
    focusAreas,
  } = params;

  const lbiContext = lbiInsights?.length
    ? `
Learning Behavior Insights for this student:
${lbiInsights.map((i) => `- ${i.category}: Score ${i.score}/10 (${i.interpretation})`).join("\n")}

Based on these behavioral insights, adapt questions accordingly:
- If Focus & Attention is low, use shorter questions with clear instructions
- If Confidence is low, start with easier questions to build momentum
- If Stress is high, avoid overly complex word problems
`
    : "";

  const weakAreasContext =
    weakAreas?.length && focusOnWeakAreas
      ? `\nThe student has shown weakness in: ${weakAreas.join(
          ", "
        )}. Include more questions from these areas to help them improve.`
      : "";

  const focusAreasContext = focusAreas?.length
    ? `\nFocus on these specific areas: ${focusAreas.join(", ")}`
    : "";

  const bloomsLevelContext =
    bloomsLevel !== "mixed"
      ? `\nFocus on Bloom's Taxonomy level: ${
          bloomsLevel.charAt(0).toUpperCase() + bloomsLevel.slice(1)
        } - questions should primarily test this cognitive level.`
      : "\nInclude a mix of Bloom's Taxonomy levels (Remember, Understand, Apply, Analyze).";

  const timeLimitContext = timeLimit
    ? `\nThis test has a time limit of ${timeLimit} minutes. Ensure questions can be reasonably answered within this time.`
    : "";

  const systemPrompt = `You are an expert educational content creator specializing in ${subject} for Indian school curriculum (CBSE/ICSE/State Boards).

You create high-quality multiple-choice questions that:
1. Are age-appropriate for ${childGrade} students (age ${childAge})
2. Follow Bloom's Taxonomy for cognitive levels
3. Have clear, unambiguous language
4. Include one correct answer and three plausible distractors
${includeExplanations ? "5. Provide detailed explanations for the correct answer" : "5. Keep explanations brief (one line)"}

${lbiContext}
${weakAreasContext}
${focusAreasContext}
${bloomsLevelContext}
${timeLimitContext}
`;

  const userPrompt = `Generate ${questionCount} multiple-choice questions for a ${childGrade} student studying ${subject}${
    chapter ? ` - Chapter: ${chapter}` : ""
  }${topic ? ` - Topic: ${topic}` : ""}.

Difficulty level: ${
    difficulty === "mixed"
      ? "Mix of easy (30%), medium (50%), and hard (20%)"
      : difficulty
  }

Return a JSON object with this exact structure:
{
  "title": "Test title based on subject/chapter",
  "description": "Brief description of what this test covers",
  "personalizationNotes": "Notes on how the test was personalized based on student profile",
  "questions": [
    {
      "questionText": "The question text",
      "optionA": "First option",
      "optionB": "Second option",
      "optionC": "Third option",
      "optionD": "Fourth option",
      "correctOption": "A, B, C, or D",
      "explanation": "Why the correct answer is correct and why others are wrong",
      "difficulty": "easy/medium/hard",
      "bloomsLevel": "Remember/Understand/Apply/Analyze/Evaluate/Create",
      "topic": "Specific topic this question covers"
    }
  ]
}

Make sure:
- Questions test different aspects of the topic
- Language is clear and appropriate for the student's age
- Distractors are plausible but clearly incorrect
- Explanations help the student learn, not just know the answer`;

const openai = getOpenAIClient();
if (!openai) {
  throw new Error(
    "Chat is disabled because OPENAI_API_KEY is not set. Add it to your .env and restart the server."
  );
}

  // Use an env var so you can switch models without code changes
  const model = process.env.AI_INTEGRATIONS_OPENAI_MODEL || "gpt-4.1-mini";

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Keep json_object if your account supports it; otherwise remove
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response content from AI model");

    const parsed = safeJsonParse<AITestAIResponse>(content, "generateAITest");
    const questions = normalizeQuestions(parsed.questions, questionCount);

    const estimatedDuration = Math.ceil(questionCount * 2);
    const totalMarks = questionCount;
    const passingMarks = Math.ceil(totalMarks * 0.35);

    return {
      title: parsed.title || `${subject} Practice Test`,
      subject,
      description: parsed.description || `AI-generated practice test for ${subject}`,
      questions,
      estimatedDuration,
      totalMarks,
      passingMarks,
      generatedAt: new Date().toISOString(),
      personalizationNotes: parsed.personalizationNotes || "Standard test generation",
    };
  } catch (error) {
    console.error("AI Test Generation Error:", error);
    throw new Error(
      `Failed to generate test: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export interface ScoreTestParams {
  questions: GeneratedQuestion[];
  answers: Record<number, string>;
}

export interface ScoreResult {
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  passingPercentage: number;
  questionResults: {
    questionIndex: number;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
    topic: string;
  }[];
  weakTopics: string[];
  strongTopics: string[];
  recommendations: string[];
}

export async function scoreTest(params: ScoreTestParams): Promise<ScoreResult> {
  const { questions, answers } = params;

  const questionResults = questions.map((q, index) => {
    const userAnswer = answers[index] ?? null;
    const isCorrect = userAnswer === q.correctOption;

    return {
      questionIndex: index,
      questionText: q.questionText,
      userAnswer,
      correctAnswer: q.correctOption,
      isCorrect,
      explanation: q.explanation,
      topic: q.topic,
    };
  });

  const attempted = questionResults.filter((r) => r.userAnswer !== null).length;
  const correct = questionResults.filter((r) => r.isCorrect).length;
  const incorrect = attempted - correct;
  const unattempted = questions.length - attempted;

  const score = correct;
  const totalMarks = questions.length;
  const percentage = Math.round((score / totalMarks) * 100);
  const passingPercentage = 35;
  const passed = percentage >= passingPercentage;

  const topicScores: Record<string, { correct: number; total: number }> = {};
  questionResults.forEach((r) => {
    if (!topicScores[r.topic]) topicScores[r.topic] = { correct: 0, total: 0 };
    topicScores[r.topic].total++;
    if (r.isCorrect) topicScores[r.topic].correct++;
  });

  const weakTopics = Object.entries(topicScores)
    .filter(([_, s]) => s.total > 0 && s.correct / s.total < 0.5)
    .map(([topic]) => topic);

  const strongTopics = Object.entries(topicScores)
    .filter(([_, s]) => s.total > 0 && s.correct / s.total >= 0.8)
    .map(([topic]) => topic);

  const recommendations: string[] = [];
  if (weakTopics.length) recommendations.push(`Focus on improving: ${weakTopics.join(", ")}`);
  if (percentage < 50) recommendations.push("Review the fundamentals before attempting more practice tests");
  if (unattempted > 0) recommendations.push("Try to attempt all questions in future tests");
  if (percentage >= 80) recommendations.push("Great job! Try harder difficulty questions next time");

  return {
    totalQuestions: questions.length,
    attempted,
    correct,
    incorrect,
    unattempted,
    score,
    totalMarks,
    percentage,
    passed,
    passingPercentage,
    questionResults,
    weakTopics,
    strongTopics,
    recommendations,
  };
}

export async function generatePersonalizedRecommendations(
  childName: string,
  subject: string,
  scoreResult: ScoreResult,
  lbiInsights?: LBIInsight[]
): Promise<string[]> {
  const lbiContext = lbiInsights?.length
    ? `Learning Behavior Profile:
${lbiInsights.map((i) => `- ${i.category}: ${i.score}/10 (${i.interpretation})`).join("\n")}`
    : "";

  const prompt = `Based on the following test performance, provide 5 personalized study recommendations:

Student: ${childName}
Subject: ${subject}
Score: ${scoreResult.percentage}% (${scoreResult.correct}/${scoreResult.totalQuestions})
Weak Topics: ${scoreResult.weakTopics.join(", ") || "None identified"}
Strong Topics: ${scoreResult.strongTopics.join(", ") || "None identified"}

${lbiContext}

Return a JSON object with this structure:
{
  "recommendations": [
    "Specific, actionable recommendation 1",
    "Specific, actionable recommendation 2"
  ]
}`;

  // If OpenAI isn’t configured, gracefully fall back
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return scoreResult.recommendations;
  }

  const openai = getOpenAIClient();
  if (!openai) {
  throw new Error(
    "Chat is disabled because OPENAI_API_KEY is not set. Add it to your .env and restart the server."
  );
}
  const model = process.env.AI_INTEGRATIONS_OPENAI_MODEL || "gpt-4.1-mini";

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an educational advisor providing personalized study recommendations for Indian school students. Be specific and actionable.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return scoreResult.recommendations;

    const parsed = safeJsonParse<{ recommendations?: string[] }>(
      content,
      "generatePersonalizedRecommendations"
    );

    return parsed.recommendations?.length ? parsed.recommendations : scoreResult.recommendations;
  } catch (error) {
    console.error("Failed to generate personalized recommendations:", error);
    return scoreResult.recommendations;
  }
}
