// ═══════════════════════════════════════════
// Learning Strategy & Processing Modality — Scoring Engine
// Subdomain: 1E (Learning Strategy / ACE_SD06)
//
// Three integrated modules from the same 5 questions:
//   Module D — Strategy Preference (Q1–Q4)
//   Module E — Consistency Index (Q1–Q5)
//   Module F — Strategy Adaptability (Q5 vs Q1–Q4 primary)
//
// Three strategies:
//   [V] Visual — learning by seeing diagrams, charts, maps
//   [R] Reading — learning by reading explanations or notes
//   [P] Practice — learning by solving, applying, doing
//
// All scores are ipsative (within-student), not normative.
// No peer comparison, ranks, or percentiles.
// ═══════════════════════════════════════════

// ─── Types ───

export type StrategyTag = "V" | "R" | "P";

export type PreferenceBand = "Absent" | "Low" | "Moderate" | "High" | "Very High";

export type PreferencePattern = "Single Dominant" | "Dual Preference" | "Mixed Preference" | "Undifferentiated";

export type ConsistencyLevel = "No Stable Strategy" | "Weak Stability" | "Emerging Stability" | "Clear Stability" | "Very Stable";

export type AdaptabilityLevel = "Same Strategy" | "Some Flexibility" | "High Adaptability";

// ─── Module D: Strategy Preference ───

export interface StrategyPreference {
    visual: number;       // 0–4
    reading: number;      // 0–4
    practice: number;     // 0–4
    visualBand: PreferenceBand;
    readingBand: PreferenceBand;
    practiceBand: PreferenceBand;
    primary: StrategyTag | "Mixed";
    secondary: StrategyTag | "None";
    pattern: PreferencePattern;
}

// ─── Module E: Consistency Index ───

export interface StrategyConsistency {
    ci: number;           // 0–5 (max count of any single strategy across Q1–Q5)
    level: ConsistencyLevel;
    dominantStrategy: StrategyTag | "None";
    totalV: number;       // 0–5
    totalR: number;       // 0–5
    totalP: number;       // 0–5
}

// ─── Module F: Adaptability ───

export interface StrategyAdaptability {
    score: number;        // 0, 1, or 2
    level: AdaptabilityLevel;
    primaryStrategy: StrategyTag | "Mixed";
    difficultyStrategy: StrategyTag;     // Q5 answer
    switched: boolean;
}

// ─── Combined Result ───

export interface LearningStrategyResult {
    // Raw data
    answers: Record<string, { tag: StrategyTag; text: string }>;

    // Module D: Strategy Preference (Q1–Q4)
    preference: StrategyPreference;

    // Module E: Consistency Index (Q1–Q5)
    consistency: StrategyConsistency;

    // Module F: Adaptability (Q5 vs primary)
    adaptability: StrategyAdaptability;

    // Age-band context
    ageBand: string;
    ageExpectations: {
        preferenceExpected: string;
        consistencyExpected: string;
        adaptabilityExpected: string;
    };

    // Combined interpretation
    combinedPattern: string;
    combinedPatternLabel: string;

    // Reporting
    studentSummary: string;
    parentSummary: string;
    teacherSummary: string;
    studyTips: string[];
    interventions: { strategy: StrategyTag | "Mixed"; actions: string[] }[];
    reminder: string;
}

// ─── Input ───

export interface LearningStrategyAnswerInput {
    // Keyed by question code: "LS_Q01" → { tag, strategy, text, optionId }
    [questionCode: string]: {
        optionId?: string;
        tag: string;
        strategy?: string;
        text?: string;
    };
}

// ─── Preference Band Mapping ───

function getPreferenceBand(score: number): PreferenceBand {
    if (score === 0) return "Absent";
    if (score === 1) return "Low";
    if (score === 2) return "Moderate";
    if (score === 3) return "High";
    return "Very High"; // 4
}

// ─── Consistency Level Mapping ───

function getConsistencyLevel(ci: number): ConsistencyLevel {
    if (ci <= 1) return "No Stable Strategy";
    if (ci === 2) return "Weak Stability";
    if (ci === 3) return "Emerging Stability";
    if (ci === 4) return "Clear Stability";
    return "Very Stable"; // 5
}

// ─── Adaptability Scoring ───

function getAdaptabilityScore(primaryTag: StrategyTag | "Mixed", q5Tag: StrategyTag): number {
    if (primaryTag === "Mixed") return 1; // Tie → max adaptability = 1
    if (primaryTag === q5Tag) return 0;   // Same strategy

    // Related strategies get 1, clearly different gets 2
    // V↔R = related (both passive intake), V↔P or R↔P = different
    const related: Record<string, string[]> = {
        V: ["R"],
        R: ["V"],
        P: [],
    };

    if (related[primaryTag]?.includes(q5Tag)) return 1;
    return 2;
}

function getAdaptabilityLevel(score: number): AdaptabilityLevel {
    if (score === 0) return "Same Strategy";
    if (score === 1) return "Some Flexibility";
    return "High Adaptability";
}

// ─── Age Expectations ───

interface AgeExpectation {
    preference: string;
    consistency: string;
    adaptability: string;
}

const AGE_EXPECTATIONS: Record<string, AgeExpectation> = {
    A:  { preference: "Random or single strategy selection",   consistency: "CI 0–1 (no stable strategy)",     adaptability: "0 (not expected)" },
    B:  { preference: "Emerging preference",                   consistency: "CI 1–2 (weak stability)",          adaptability: "0–1" },
    C:  { preference: "At least one strategy ≥ 2",             consistency: "CI 2–3 (emerging stability)",      adaptability: "1" },
    D:  { preference: "At least one strategy ≥ 3",             consistency: "CI 3–4 (clear stability)",         adaptability: "1–2" },
    E1: { preference: "Dominant + secondary strategy",         consistency: "CI 3–5 (clear to very stable)",    adaptability: "1–2" },
    E2: { preference: "Stable or conscious mix",               consistency: "CI 4–5 (clear to very stable)",    adaptability: "2" },
    E3: { preference: "Stable or conscious mix",               consistency: "CI 4–5 (clear to very stable)",    adaptability: "2" },
};

const DEFAULT_EXPECTATIONS: AgeExpectation = AGE_EXPECTATIONS.B;

// ─── Combined Pattern Detection ───

interface CombinedPattern {
    pattern: string;
    label: string;
}

function detectCombinedPattern(
    pref: StrategyPreference,
    cons: StrategyConsistency,
    adapt: StrategyAdaptability,
): CombinedPattern {
    const highPref = pref.pattern === "Single Dominant" || pref.pattern === "Dual Preference";
    const highCI = cons.ci >= 3;
    const lowCI = cons.ci <= 2;

    if (highPref && highCI && adapt.score === 0) {
        return { pattern: "effective_stable", label: "Strategy effective and consistent — reinforce" };
    }
    if (highPref && highCI && adapt.score === 2) {
        return { pattern: "strategic_learner", label: "Strategic and adaptable learner — enrich" };
    }
    if (highPref && lowCI) {
        return { pattern: "unstable", label: "Preference exists but inconsistent — scaffold" };
    }
    if (lowCI && adapt.score <= 1) {
        return { pattern: "stuck", label: "No clear strategy and limited adaptability — teach methods" };
    }
    if (pref.pattern === "Mixed Preference" && adapt.score >= 1) {
        return { pattern: "exploratory", label: "Exploratory learner — support deliberate choice" };
    }
    if (pref.pattern === "Undifferentiated") {
        return { pattern: "undifferentiated", label: "No clear preference yet — introduce and model strategies" };
    }

    return { pattern: "developing", label: "Strategy profile developing — monitor and guide" };
}

// ═══════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════

export function scoreLearningStrategy(
    answers: LearningStrategyAnswerInput,
    ageBand: string = "B",
): LearningStrategyResult {

    // ─── Extract tags per question ───
    const tags: (StrategyTag | null)[] = [];
    const answerMap: Record<string, { tag: StrategyTag; text: string }> = {};

    for (let i = 1; i <= 5; i++) {
        const key = `LS_Q${String(i).padStart(2, "0")}`;
        const alt = `LS${i}`;
        const entry = answers[key] || answers[alt] || answers[String(i)];

        if (entry && entry.tag && ["V", "R", "P"].includes(entry.tag.toUpperCase())) {
            const tag = entry.tag.toUpperCase() as StrategyTag;
            tags.push(tag);
            answerMap[key] = { tag, text: entry.text || "" };
        } else {
            tags.push(null);
            answerMap[`LS_Q${String(i).padStart(2, "0")}`] = { tag: "V" as StrategyTag, text: "(no answer)" };
        }
    }

    // ─── Count strategies ───
    // Q1–Q4 for Module D preference
    const prefTags = tags.slice(0, 4).filter(Boolean) as StrategyTag[];
    const prefV = prefTags.filter(t => t === "V").length;
    const prefR = prefTags.filter(t => t === "R").length;
    const prefP = prefTags.filter(t => t === "P").length;

    // Q1–Q5 for Module E consistency
    const allTags = tags.filter(Boolean) as StrategyTag[];
    const totalV = allTags.filter(t => t === "V").length;
    const totalR = allTags.filter(t => t === "R").length;
    const totalP = allTags.filter(t => t === "P").length;

    // ═══ MODULE D: Strategy Preference (Q1–Q4) ═══

    const visualBand = getPreferenceBand(prefV);
    const readingBand = getPreferenceBand(prefR);
    const practiceBand = getPreferenceBand(prefP);

    // Determine primary/secondary/pattern
    const scores = [
        { tag: "V" as StrategyTag, score: prefV },
        { tag: "R" as StrategyTag, score: prefR },
        { tag: "P" as StrategyTag, score: prefP },
    ].sort((a, b) => b.score - a.score);

    let primary: StrategyTag | "Mixed";
    let secondary: StrategyTag | "None";
    let pattern: PreferencePattern;

    if (scores[0].score === scores[1].score && scores[1].score === scores[2].score) {
        // Three-way tie
        primary = "Mixed";
        secondary = "None";
        pattern = scores[0].score <= 1 ? "Undifferentiated" : "Mixed Preference";
    } else if (scores[0].score === scores[1].score) {
        // Two-way tie at top
        primary = "Mixed";
        secondary = scores[2].tag;
        pattern = "Dual Preference";
    } else {
        primary = scores[0].tag;
        secondary = scores[1].score > 0 ? scores[1].tag : "None";
        pattern = "Single Dominant";
    }

    // If all preferences <= 1 → Undifferentiated
    if (prefV <= 1 && prefR <= 1 && prefP <= 1) {
        pattern = "Undifferentiated";
    }

    const preference: StrategyPreference = {
        visual: prefV,
        reading: prefR,
        practice: prefP,
        visualBand,
        readingBand,
        practiceBand,
        primary,
        secondary,
        pattern,
    };

    // ═══ MODULE E: Consistency Index (Q1–Q5) ═══

    const ci = Math.max(totalV, totalR, totalP);
    const consistencyLevel = getConsistencyLevel(ci);

    // Dominant strategy for consistency
    let dominantStrategy: StrategyTag | "None" = "None";
    if (totalV > totalR && totalV > totalP) dominantStrategy = "V";
    else if (totalR > totalV && totalR > totalP) dominantStrategy = "R";
    else if (totalP > totalV && totalP > totalR) dominantStrategy = "P";

    const consistency: StrategyConsistency = {
        ci,
        level: consistencyLevel,
        dominantStrategy,
        totalV,
        totalR,
        totalP,
    };

    // ═══ MODULE F: Adaptability (Q5 vs Q1–Q4 primary) ═══

    const q5Tag = tags[4] || "V"; // Q5 answer
    const adaptScore = getAdaptabilityScore(primary, q5Tag as StrategyTag);
    const adaptLevel = getAdaptabilityLevel(adaptScore);

    const adaptability: StrategyAdaptability = {
        score: adaptScore,
        level: adaptLevel,
        primaryStrategy: primary,
        difficultyStrategy: q5Tag as StrategyTag,
        switched: adaptScore > 0,
    };

    // ─── Age Expectations ───
    const ageExp = AGE_EXPECTATIONS[ageBand] || DEFAULT_EXPECTATIONS;

    // ─── Combined Pattern ───
    const { pattern: combinedPattern, label: combinedPatternLabel } = detectCombinedPattern(
        preference, consistency, adaptability
    );

    // ─── Strategy Labels ───
    const strategyNames: Record<string, string> = {
        V: "Visual Structuring",
        R: "Reading-Based Processing",
        P: "Practice / Application",
        Mixed: "Mixed Strategies",
    };

    const primaryName = strategyNames[primary] || "Mixed Strategies";

    // ─── Student Summary ───
    let studentSummary: string;
    if (pattern === "Single Dominant") {
        studentSummary = `You showed a stronger preference for learning through ${primaryName.toLowerCase()}. ${
            adaptability.switched
                ? "When topics get difficult, you try a different approach — that shows flexibility."
                : "You tend to use the same approach even when things get harder."
        }`;
    } else if (pattern === "Dual Preference") {
        studentSummary = "You use more than one learning strategy regularly. This means you can adapt to different types of content. Keep experimenting to find what works best for each subject.";
    } else if (pattern === "Mixed Preference") {
        studentSummary = "You don't have a single strong preference yet — you explore different ways of learning. That's okay! Try focusing on one method at a time to see what helps you understand best.";
    } else {
        studentSummary = "Your learning approach is still developing. Try different methods — diagrams, reading, and practice — to discover what helps you understand and remember best.";
    }

    // ─── Parent Summary ───
    const parentSummaryMap: Record<string, string> = {
        effective_stable: `Your child has a clear and consistent learning preference for ${primaryName.toLowerCase()}. Their study method is working well — reinforce it.`,
        strategic_learner: `Your child has a clear learning preference and also adapts when material gets harder. This is a sign of a strategic learner.`,
        unstable: `Your child shows a preference but doesn't use it consistently. Gentle encouragement to stick with their preferred method during study can help build stability.`,
        stuck: `Your child hasn't settled on a clear learning strategy yet and doesn't change approach when struggling. Teaching different study methods (visual, reading, practice) would be helpful.`,
        exploratory: `Your child tries different learning methods, which shows curiosity. Help them notice which methods work best for different subjects.`,
        undifferentiated: `Your child hasn't developed a clear learning preference yet. This is normal at their stage. Expose them to different study methods and discuss what felt helpful.`,
        developing: `Your child's learning strategy is developing. Continue to expose them to visual, reading, and hands-on approaches.`,
    };

    // ─── Teacher Summary ───
    const teacherSummaryMap: Record<string, string> = {
        effective_stable: `The learner shows a stable ${primaryName.toLowerCase()} preference with consistent application. Current instructional match is effective. Maintain and extend.`,
        strategic_learner: `The learner demonstrates both strategy stability and adaptability under difficulty. This indicates a self-regulated learner who can be given more challenging material.`,
        unstable: `The learner shows preference but lacks consistency in applying it. Scaffolding with structured study routines aligned to their preference would improve stability.`,
        stuck: `The learner has no clear strategy and limited flexibility. Explicit strategy instruction is needed — model and practise all three approaches (visual, reading, applied).`,
        exploratory: `The learner explores multiple strategies. Guide them toward reflective choice — after each study session, ask "What method did you use and did it work?"`,
        undifferentiated: `The learner shows no differentiated preference. Introduce structured exposure to each strategy type and help them identify what feels most effective.`,
        developing: `Strategy profile is developing. Monitor in follow-up assessments and provide exposure to diverse study methods.`,
    };

    // ─── Study Tips ───
    const studyTips = generateStudyTips(primary, adaptability);

    // ─── Interventions ───
    const interventions = generateInterventions(preference, consistency, adaptability);

    return {
        answers: answerMap,
        preference,
        consistency,
        adaptability,
        ageBand,
        ageExpectations: {
            preferenceExpected: ageExp.preference,
            consistencyExpected: ageExp.consistency,
            adaptabilityExpected: ageExp.adaptability,
        },
        combinedPattern,
        combinedPatternLabel,
        studentSummary,
        parentSummary: parentSummaryMap[combinedPattern] || parentSummaryMap.developing,
        teacherSummary: teacherSummaryMap[combinedPattern] || teacherSummaryMap.developing,
        studyTips,
        interventions,
        reminder: "This reflects learning preferences, not intelligence or ability.",
    };
}

// ─── Study Tips Generator ───

function generateStudyTips(primary: StrategyTag | "Mixed", adaptability: StrategyAdaptability): string[] {
    const tips: string[] = [];

    switch (primary) {
        case "V":
            tips.push("Start topics with diagrams, flowcharts, or mind maps");
            tips.push("Use colour-coded notes to organise information visually");
            tips.push("Convert text-heavy material into visual summaries");
            break;
        case "R":
            tips.push("Read clear, structured explanations before attempting problems");
            tips.push("Write short summaries in your own words after reading");
            tips.push("Use step-by-step written guides for complex topics");
            break;
        case "P":
            tips.push("Start with examples and worked problems before reading theory");
            tips.push("Apply concepts immediately after learning them");
            tips.push("Use practice questions early in each study session");
            break;
        default:
            tips.push("Try all three methods — diagrams, reading, and practice — for each topic");
            tips.push("After each study session, note which method helped most");
            tips.push("Experiment with different approaches for different subjects");
    }

    if (adaptability.score === 0) {
        tips.push("When a topic feels hard, try a different study method before giving up");
    }

    return tips;
}

// ─── Intervention Generator ───

function generateInterventions(
    pref: StrategyPreference,
    cons: StrategyConsistency,
    adapt: StrategyAdaptability,
): LearningStrategyResult["interventions"] {
    const interventions: LearningStrategyResult["interventions"] = [];

    // Strategy-specific teaching actions
    if (pref.visual >= 2 || cons.dominantStrategy === "V") {
        interventions.push({
            strategy: "V",
            actions: [
                "Use diagrams, flowcharts, and visual organisers in instruction",
                "Avoid relying only on verbal explanation",
                "Provide graphic templates for note-taking",
            ],
        });
    }

    if (pref.reading >= 2 || cons.dominantStrategy === "R") {
        interventions.push({
            strategy: "R",
            actions: [
                "Provide structured notes and reading materials",
                "Avoid skipping written steps in explanations",
                "Encourage summarisation and paraphrasing activities",
            ],
        });
    }

    if (pref.practice >= 2 || cons.dominantStrategy === "P") {
        interventions.push({
            strategy: "P",
            actions: [
                "Use examples and application tasks early in lessons",
                "Avoid long theory blocks before practice",
                "Provide worked examples followed by independent practice",
            ],
        });
    }

    // If mixed or undifferentiated
    if (pref.pattern === "Mixed Preference" || pref.pattern === "Undifferentiated" || cons.ci <= 2) {
        interventions.push({
            strategy: "Mixed",
            actions: [
                "Teach all three strategies explicitly (visual, reading, practice)",
                "Guide reflection after each study session: 'What method did I use?'",
                "Reinforce whichever method produces the best understanding",
            ],
        });
    }

    return interventions;
}
