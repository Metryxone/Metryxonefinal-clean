// ═══════════════════════════════════════════
// Task Attention (ATT) — Scoring Engine
// Subdomain: 1D (Task Attention / ACE_SD05)
//
// Measures:
//   Sustained & selective attention during study
//   Error inhibition, fatigue resistance, focus stability
//
// Task-based scoring:
//   Attention Stability Score (ASS): 0–100
//   Computed from hits, misses, false alarms, impulsivity indicators
//
// Self-report (AT1–AT4):
//   Optional Likert items capturing subjective focus experience
//
// Final Attention Index:
//   (ASS × 0.6) + (SelfReport_Avg × 8)
//   Falls back to ASS alone if self-report unavailable
//
// Variation Levels:
//   L1: Letter-based (single_target, dual_target, ignore_distractor + letter)
//   L2: Symbol/Rule-based (symbol tasks, conditional/sequence + symbol)
//   L3: Continuous/Exam-like (vigilance, sequence/conditional + letter)
//   L4: Fatigue-sensitive (special tagged variants)
// ═══════════════════════════════════════════

// ─── Variation Level Determination ───

export type VariationLevel = 1 | 2 | 3 | 4;

export function getVariationLevel(logicType: string, stimulusType: string): VariationLevel {
    // L3: Vigilance is always continuous/exam-like
    if (logicType === "vigilance") return 3;

    // L1: Letter-based grid tasks (foundational)
    if (stimulusType === "letter" && ["single_target", "dual_target", "ignore_distractor"].includes(logicType)) {
        return 1;
    }

    // L3: Sequence/conditional with letters → contextual/exam-like
    if (stimulusType === "letter" && ["sequence", "conditional"].includes(logicType)) {
        return 3;
    }

    // L2: Symbol or digit-based tasks (neutral content / rule maintenance)
    if (stimulusType === "symbol" || stimulusType === "digit") {
        return 2;
    }

    // Fallback
    return 1;
}

// ─── Age-Band Norm Cutoffs per Variation Level ───
// { high: minimum for "High/Stable", adequate: minimum for "Adequate/Situational" }
// Below adequate = "At-Risk/Distractible"

interface LevelCutoffs {
    high: number;
    adequate: number;
}

const LEVEL_1_NORMS: Record<string, LevelCutoffs> = {
    A:  { high: 65, adequate: 45 },
    B:  { high: 70, adequate: 50 },
    C:  { high: 72, adequate: 52 },
    D:  { high: 75, adequate: 55 },
    E1: { high: 78, adequate: 58 },
    E2: { high: 80, adequate: 60 },
    E3: { high: 82, adequate: 62 },
};

const LEVEL_2_NORMS: Record<string, LevelCutoffs> = {
    A:  { high: 60, adequate: 40 },
    B:  { high: 65, adequate: 45 },
    C:  { high: 68, adequate: 48 },
    D:  { high: 72, adequate: 52 },
    E1: { high: 75, adequate: 55 },
    E2: { high: 78, adequate: 58 },
    E3: { high: 80, adequate: 60 },
};

const LEVEL_3_NORMS: Record<string, LevelCutoffs> = {
    A:  { high: 58, adequate: 38 },
    B:  { high: 62, adequate: 42 },
    C:  { high: 65, adequate: 45 },
    D:  { high: 70, adequate: 50 },
    E1: { high: 74, adequate: 54 },
    E2: { high: 78, adequate: 58 },
    E3: { high: 80, adequate: 60 },
};

const LEVEL_4_NORMS: Record<string, LevelCutoffs> = {
    // Level 4 not used for Band A (too young)
    A:  { high: 58, adequate: 38 },
    B:  { high: 60, adequate: 40 },
    C:  { high: 63, adequate: 43 },
    D:  { high: 68, adequate: 48 },
    E1: { high: 72, adequate: 52 },
    E2: { high: 75, adequate: 55 },
    E3: { high: 78, adequate: 58 },
};

const LEVEL_NORMS: Record<VariationLevel, Record<string, LevelCutoffs>> = {
    1: LEVEL_1_NORMS,
    2: LEVEL_2_NORMS,
    3: LEVEL_3_NORMS,
    4: LEVEL_4_NORMS,
};

function getNormCutoffs(level: VariationLevel, ageBand: string): LevelCutoffs {
    return LEVEL_NORMS[level]?.[ageBand] || LEVEL_NORMS[level]?.["B"] || { high: 70, adequate: 50 };
}

// ─── Types ───

export type AttentionBand = "High" | "Adequate" | "At-Risk";

export type DiagnosticPattern =
    | "stable_focus"
    | "fatigue_sensitivity"
    | "impulsivity"
    | "sustained_drop"
    | "underconfidence"
    | "awareness_control_gap"
    | "general_difficulty";

export interface AttentionTaskMetrics {
    mode: "grid" | "stream";
    logicType: string;
    stimulusType: string;
    hits: number;
    misses: number;
    falseAlarms: number;
    totalTargets: number;
    totalItems: number;
    avgReactionTimeMs: number;
    correct: boolean;
}

export interface AttentionResult {
    // Task metrics
    taskMetrics: AttentionTaskMetrics;

    // Variation info
    variationLevel: VariationLevel;
    variationLevelLabel: string;

    // Attention Stability Score (from task performance)
    ass: number;               // 0–100
    hitRate: number;           // 0–1
    falseAlarmRate: number;    // 0–1
    missRate: number;          // 0–1
    discriminability: number;  // hitRate - falseAlarmRate

    // Self-report (optional)
    selfReport: {
        items: Record<string, number>;
        average: number;       // 1–5 scale average
        available: boolean;
    };

    // Final Attention Index
    attentionIndex: number;    // 0–100

    // Band classification (norm-referenced)
    band: AttentionBand;
    bandLabel: string;
    ageBand: string;

    // Diagnostic pattern
    diagnosticPattern: DiagnosticPattern;
    diagnosticPatternLabel: string;

    // Fatigue analysis (stream mode only)
    fatigueAnalysis: {
        available: boolean;
        firstHalfAccuracy: number;
        secondHalfAccuracy: number;
        declineDetected: boolean;
        declinePercent: number;
    };

    // Reporting
    teacherSummary: string;
    parentSummary: string;
    diagnosticText: string;
    skillBreakdown: { code: string; skill: string; observation: string }[];
    redFlags: string[];
    alerts: { level: string; label: string; detail: string }[];
    intervention: string;
}

// ─── Input interfaces ───

export interface AttentionAnswerInput {
    mode: "grid" | "stream";
    logicType: string;
    stimulusType: string;
    selected?: string[];
    targets?: string[];
    hits: number;
    misses: number;
    falseAlarms: number;
    avgReactionTimeMs?: number;
    totalTargets?: number;
    totalItems?: number;
    correct?: boolean;
    predecessor?: string;
    // Stream-specific: per-item tap data (if available)
    itemTaps?: { index: number; reactionTimeMs: number }[];
}

export interface AttentionSelfReportInput {
    AT1?: number;  // "I can focus for 25–30 minutes" (1–5)
    AT2?: number;  // "Hard work breaks my focus" (R) (1–5)
    AT3?: number;  // "Noise / phone distracts me" (R) (1–5)
    AT4?: number;  // "Planning improves my focus" (1–5)
}

// ═══════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════

export function scoreAttention(
    answer: AttentionAnswerInput,
    ageBand: string = "B",
    selfReport?: AttentionSelfReportInput,
): AttentionResult {
    const mode = answer.mode || "grid";
    const logicType = answer.logicType || "single_target";
    const stimulusType = answer.stimulusType || "letter";

    const hits = answer.hits || 0;
    const misses = answer.misses || 0;
    const falseAlarms = answer.falseAlarms || 0;
    const totalTargets = answer.totalTargets || (hits + misses) || 1;
    const totalItems = answer.totalItems || 20;
    const totalNonTargets = totalItems - totalTargets;
    const avgReactionTimeMs = answer.avgReactionTimeMs || 0;

    // ─── Variation Level ───
    const variationLevel = getVariationLevel(logicType, stimulusType);
    const variationLevelLabels: Record<VariationLevel, string> = {
        1: "Level 1 — Letter-Based (Foundational)",
        2: "Level 2 — Symbol/Rule-Based (Neutral Content)",
        3: "Level 3 — Continuous/Exam-Like",
        4: "Level 4 — Advanced/Fatigue-Sensitive",
    };

    // ─── Core Metrics ───
    const hitRate = totalTargets > 0 ? hits / totalTargets : 0;
    const falseAlarmRate = totalNonTargets > 0 ? falseAlarms / totalNonTargets : 0;
    const missRate = totalTargets > 0 ? misses / totalTargets : 0;
    const discriminability = Math.max(0, hitRate - falseAlarmRate);

    // ─── Attention Stability Score (ASS): 0–100 ───
    // Hit component (60%): how many targets were caught
    // Precision component (30%): how well non-targets were avoided
    // Reaction-time bonus (10%): fast + accurate responding
    const hitComponent = hitRate * 60;
    const precisionComponent = (totalNonTargets > 0
        ? (totalNonTargets - falseAlarms) / totalNonTargets
        : 1) * 30;

    // RT bonus: 0–10 points. Fast responses (< 600ms average) get full bonus.
    // No reaction time data (grid mode) → give neutral 5 points
    let rtBonus = 5;
    if (mode === "stream" && avgReactionTimeMs > 0 && hits > 0) {
        if (avgReactionTimeMs < 400) rtBonus = 10;
        else if (avgReactionTimeMs < 600) rtBonus = 8;
        else if (avgReactionTimeMs < 800) rtBonus = 6;
        else if (avgReactionTimeMs < 1000) rtBonus = 4;
        else rtBonus = 2;
    }

    // Impulsivity penalty: excessive false alarms relative to total responses
    const totalResponses = hits + falseAlarms;
    const impulsivityPenalty = totalResponses > 0 && falseAlarms > 2
        ? Math.min(15, (falseAlarms / totalResponses) * 30)
        : 0;

    const ass = Math.max(0, Math.min(100, Math.round(
        hitComponent + precisionComponent + rtBonus - impulsivityPenalty
    )));

    // ─── Fatigue Analysis (stream mode) ───
    const fatigueAnalysis = analyzeFatigue(answer, totalTargets, totalItems);

    // ─── Self-Report Processing ───
    const srResult = processSelfReport(selfReport);

    // ─── Final Attention Index ───
    // Formula: (ASS × 0.6) + (SelfReport_Avg × 8)
    // If no self-report: use ASS directly (scaled so ASS maps to full range)
    let attentionIndex: number;
    if (srResult.available) {
        attentionIndex = Math.round((ass * 0.6) + (srResult.average * 8));
    } else {
        // Without self-report, ASS alone represents the index
        attentionIndex = ass;
    }
    attentionIndex = Math.max(0, Math.min(100, attentionIndex));

    // ─── Band Classification ───
    const cutoffs = getNormCutoffs(variationLevel, ageBand);
    let band: AttentionBand;
    if (attentionIndex >= cutoffs.high) band = "High";
    else if (attentionIndex >= cutoffs.adequate) band = "Adequate";
    else band = "At-Risk";

    const bandLabels: Record<AttentionBand, string> = {
        "High": "Stable Focus",
        "Adequate": "Situational Focus",
        "At-Risk": "High Distractibility",
    };

    // ─── Task Metrics (for result) ───
    const taskMetrics: AttentionTaskMetrics = {
        mode,
        logicType,
        stimulusType,
        hits,
        misses,
        falseAlarms,
        totalTargets,
        totalItems,
        avgReactionTimeMs,
        correct: answer.correct ?? (hits === totalTargets && falseAlarms === 0),
    };

    // ─── Diagnostic Pattern Detection ───
    const { diagnosticPattern, diagnosticPatternLabel } = detectDiagnosticPattern(
        ass, hitRate, falseAlarmRate, missRate, fatigueAnalysis, srResult
    );

    // ─── Teacher Summary ───
    const teacherSummaryMap: Record<AttentionBand, string> = {
        "High": "The learner demonstrates stable, age-appropriate attention control. They accurately identify targets, resist distractors, and maintain focus throughout the task.",
        "Adequate": "The learner shows situational attention — focus is present but inconsistent. Errors may increase under rule complexity or over time. Study environment and task structure matter for this learner.",
        "At-Risk": "The learner shows significant attention instability for their age. Frequent misses or false alarms suggest difficulty sustaining focus and inhibiting incorrect responses. Structured attention support is recommended.",
    };

    // ─── Parent Summary ───
    const parentSummaryMap: Record<AttentionBand, string> = {
        "High": "Your child can stay focused and avoid distractions well. Their attention skills are strong for their age.",
        "Adequate": "Your child can focus, but their attention sometimes wavers, especially when tasks get harder or longer. Short study sessions with breaks may help.",
        "At-Risk": "Your child finds it hard to stay focused and often gets distracted. This is not about effort — they may need simpler, shorter tasks with clear structure to build focus gradually.",
    };

    // ─── Diagnostic Text ───
    const diagnosticTextMap: Record<DiagnosticPattern, string> = {
        stable_focus: "Attention is stable and well-controlled across the task. The learner accurately identifies targets, avoids distractors, and maintains consistent performance.",
        fatigue_sensitivity: "Accuracy declined noticeably in the second half of the task, suggesting fatigue sensitivity. The learner starts well but cannot sustain focus over the full duration. Shorter study blocks with breaks are recommended.",
        impulsivity: "The learner shows a high rate of false alarms — responding to non-target items. This suggests impulsive responding or weak inhibition control rather than inattention. 'Think before you click' strategies may help.",
        sustained_drop: "The learner increasingly missed targets as the task progressed. This pattern indicates a sustained attention deficit — focus degrades over time even when initial engagement is adequate.",
        underconfidence: "Task performance is strong, but self-reported focus is low. The learner may underestimate their own attention abilities. Positive reinforcement and awareness of their actual performance could help build confidence.",
        awareness_control_gap: "Self-reported focus is high, but task performance is low. The learner believes they are focused but actual accuracy suggests otherwise. This gap between awareness and control needs targeted intervention.",
        general_difficulty: "The learner shows difficulty across multiple attention dimensions — accuracy, inhibition, and sustained focus are all below age expectations. A structured attention-building programme is recommended.",
    };

    // ─── Skill Breakdown ───
    const skillBreakdown: { code: string; skill: string; observation: string }[] = [
        {
            code: "HIT",
            skill: "Target Detection",
            observation: hitRate >= 0.85
                ? `Strong — ${hits}/${totalTargets} targets detected (${Math.round(hitRate * 100)}%)`
                : hitRate >= 0.60
                    ? `Moderate — ${hits}/${totalTargets} targets detected (${Math.round(hitRate * 100)}%)`
                    : `Weak — only ${hits}/${totalTargets} targets detected (${Math.round(hitRate * 100)}%)`,
        },
        {
            code: "INH",
            skill: "Error Inhibition",
            observation: falseAlarms === 0
                ? "Excellent — no false alarms"
                : falseAlarms <= 1
                    ? `Good — ${falseAlarms} false alarm`
                    : falseAlarms <= 3
                        ? `Moderate — ${falseAlarms} false alarms, some impulsivity`
                        : `Weak — ${falseAlarms} false alarms, significant impulsivity`,
        },
        {
            code: "DISC",
            skill: "Discriminability",
            observation: discriminability >= 0.7
                ? "Strong separation between targets and distractors"
                : discriminability >= 0.4
                    ? "Moderate — some confusion between targets and non-targets"
                    : "Low — difficulty distinguishing targets from distractors",
        },
    ];

    // Add fatigue skill only for stream mode
    if (mode === "stream" && fatigueAnalysis.available) {
        skillBreakdown.push({
            code: "FAT",
            skill: "Fatigue Resistance",
            observation: !fatigueAnalysis.declineDetected
                ? "Good — maintained accuracy throughout the task"
                : fatigueAnalysis.declinePercent <= 20
                    ? `Mild decline — ${fatigueAnalysis.declinePercent}% accuracy drop in second half`
                    : `Significant decline — ${fatigueAnalysis.declinePercent}% accuracy drop in second half`,
        });
    }

    // Add RT skill for stream mode
    if (mode === "stream" && avgReactionTimeMs > 0) {
        skillBreakdown.push({
            code: "RT",
            skill: "Response Speed",
            observation: avgReactionTimeMs < 500
                ? `Fast — ${avgReactionTimeMs}ms average reaction time`
                : avgReactionTimeMs < 800
                    ? `Adequate — ${avgReactionTimeMs}ms average reaction time`
                    : `Slow — ${avgReactionTimeMs}ms average reaction time`,
        });
    }

    // ─── Red Flags ───
    const redFlags: string[] = [];
    const upperBands = ["C", "D", "E1", "E2", "E3"];

    if (attentionIndex < 40) {
        redFlags.push("Attention index below functional threshold");
    }
    if (upperBands.includes(ageBand) && band === "At-Risk") {
        redFlags.push("Attention below expected level for age/stage");
    }
    if (falseAlarms >= 4) {
        redFlags.push("High false alarms — impulsivity or weak inhibition");
    }
    if (hitRate < 0.4) {
        redFlags.push("Severe target detection weakness — possible sustained attention deficit");
    }
    if (fatigueAnalysis.available && fatigueAnalysis.declinePercent > 30) {
        redFlags.push("Sharp performance decline in second half — fatigue sensitivity");
    }
    if (discriminability < 0.2) {
        redFlags.push("Near-chance discriminability — possible random responding");
    }
    if (diagnosticPattern === "awareness_control_gap") {
        redFlags.push("Self-perception does not match actual attention performance");
    }
    if (["E2", "E3"].includes(ageBand) && falseAlarms >= 3) {
        redFlags.push("Adult learner showing unexpected impulsivity");
    }

    // ─── Alerts ───
    const alerts: { level: string; label: string; detail: string }[] = [];

    if (band === "At-Risk") {
        alerts.push({ level: "red", label: "Attention Risk", detail: "Below age-band adequate threshold" });
    }
    if (diagnosticPattern === "impulsivity") {
        alerts.push({ level: "orange", label: "Impulsivity", detail: `${falseAlarms} false alarms detected` });
    }
    if (diagnosticPattern === "fatigue_sensitivity") {
        alerts.push({ level: "yellow", label: "Fatigue Sensitivity", detail: "Accuracy declined in second half" });
    }
    if (diagnosticPattern === "sustained_drop") {
        alerts.push({ level: "orange", label: "Sustained Attention Drop", detail: "Increasing misses over time" });
    }
    if (diagnosticPattern === "awareness_control_gap") {
        alerts.push({ level: "yellow", label: "Awareness–Control Gap", detail: "High self-report but low task performance" });
    }

    // ─── Intervention ───
    let intervention: string;

    switch (diagnosticPattern) {
        case "impulsivity":
            intervention = "Train response inhibition: practice 'wait-then-respond' exercises. Use visual checklists before answering. Encourage the learner to pause and verify before clicking or writing answers.";
            break;
        case "fatigue_sensitivity":
            intervention = "Implement shorter study blocks (15–20 minutes) with structured breaks. Use the Pomodoro technique. Place important or difficult material at the beginning of study sessions.";
            break;
        case "sustained_drop":
            intervention = "Build sustained attention gradually: start with 10-minute focus blocks and increase by 5 minutes weekly. Use interest-based tasks to maintain engagement. Alternate between reading and active recall.";
            break;
        case "underconfidence":
            intervention = "Provide explicit feedback showing actual performance data. Help the learner recognise their own attention strengths. Use positive reinforcement when focus is maintained.";
            break;
        case "awareness_control_gap":
            intervention = "Use external focus cues: timers, task checklists, and self-monitoring sheets. Teach the learner to check their own accuracy during study. Pair perceived focus with actual output (e.g., 'How many points did I actually cover?').";
            break;
        case "general_difficulty":
            intervention = "Implement a structured attention-building programme: reduce environmental distractions, use visual schedules, break tasks into micro-steps, and practice brief attention exercises daily. Consider classroom seating adjustments.";
            break;
        case "stable_focus":
        default:
            intervention = "Maintain current study environment and strategies. Consider introducing more challenging tasks or longer focus periods to further develop attention capacity.";
            break;
    }

    return {
        taskMetrics,
        variationLevel,
        variationLevelLabel: variationLevelLabels[variationLevel],
        ass,
        hitRate: Number(hitRate.toFixed(2)),
        falseAlarmRate: Number(falseAlarmRate.toFixed(2)),
        missRate: Number(missRate.toFixed(2)),
        discriminability: Number(discriminability.toFixed(2)),
        selfReport: srResult,
        attentionIndex,
        band,
        bandLabel: bandLabels[band],
        ageBand,
        diagnosticPattern,
        diagnosticPatternLabel,
        fatigueAnalysis,
        teacherSummary: teacherSummaryMap[band],
        parentSummary: parentSummaryMap[band],
        diagnosticText: diagnosticTextMap[diagnosticPattern],
        skillBreakdown,
        redFlags,
        alerts,
        intervention,
    };
}

// ═══════════════════════════════════════════
// HELPER: Fatigue Analysis
// ═══════════════════════════════════════════

function analyzeFatigue(
    answer: AttentionAnswerInput,
    totalTargets: number,
    totalItems: number,
): AttentionResult["fatigueAnalysis"] {
    // Fatigue analysis only meaningful for stream mode
    if (answer.mode !== "stream" || totalItems < 10) {
        return { available: false, firstHalfAccuracy: 0, secondHalfAccuracy: 0, declineDetected: false, declinePercent: 0 };
    }

    // Without per-item data, estimate from overall metrics
    // If we had per-item taps, we could split into first/second half
    // For now, use a heuristic based on overall performance:
    // High hits + high misses + high FA → likely fatigue-related degradation
    const hits = answer.hits || 0;
    const misses = answer.misses || 0;
    const falseAlarms = answer.falseAlarms || 0;

    // Approximate: if misses > 30% of targets and hits are moderate → fatigue likely
    const hitRate = totalTargets > 0 ? hits / totalTargets : 0;
    const missRate = totalTargets > 0 ? misses / totalTargets : 0;

    // Without item-level temporal data, we use a conservative estimate
    // Assume first half is ~20% better than overall if there are misses
    const estimatedFirstHalf = Math.min(100, Math.round((hitRate + missRate * 0.3) * 100));
    const estimatedSecondHalf = Math.max(0, Math.round((hitRate - missRate * 0.3) * 100));

    const decline = estimatedFirstHalf - estimatedSecondHalf;
    const declineDetected = decline > 15 && misses >= 2;

    return {
        available: true,
        firstHalfAccuracy: estimatedFirstHalf,
        secondHalfAccuracy: estimatedSecondHalf,
        declineDetected,
        declinePercent: Math.max(0, decline),
    };
}

// ═══════════════════════════════════════════
// HELPER: Self-Report Processing
// ═══════════════════════════════════════════

function processSelfReport(
    selfReport?: AttentionSelfReportInput,
): AttentionResult["selfReport"] {
    if (!selfReport) {
        return { items: {}, average: 0, available: false };
    }

    const at1 = selfReport.AT1 ?? 0;
    const at2 = selfReport.AT2 ?? 0;
    const at3 = selfReport.AT3 ?? 0;
    const at4 = selfReport.AT4 ?? 0;

    // Check if any items were actually answered
    const answered = [at1, at2, at3, at4].filter(v => v > 0);
    if (answered.length === 0) {
        return { items: {}, average: 0, available: false };
    }

    // Reverse-score AT2 and AT3 (higher = less distracted = better)
    const at2r = at2 > 0 ? 6 - at2 : 0;
    const at3r = at3 > 0 ? 6 - at3 : 0;

    const items: Record<string, number> = {
        AT1: at1,
        AT2: at2,
        AT2R: at2r,
        AT3: at3,
        AT3R: at3r,
        AT4: at4,
    };

    // Average of scored items (using reverse-scored versions)
    const scoredValues = [at1, at2r, at3r, at4].filter(v => v > 0);
    const average = scoredValues.length > 0
        ? Number((scoredValues.reduce((a, b) => a + b, 0) / scoredValues.length).toFixed(2))
        : 0;

    return { items, average, available: scoredValues.length > 0 };
}

// ═══════════════════════════════════════════
// HELPER: Diagnostic Pattern Detection
// ═══════════════════════════════════════════

function detectDiagnosticPattern(
    ass: number,
    hitRate: number,
    falseAlarmRate: number,
    missRate: number,
    fatigueAnalysis: AttentionResult["fatigueAnalysis"],
    selfReport: AttentionResult["selfReport"],
): { diagnosticPattern: DiagnosticPattern; diagnosticPatternLabel: string } {
    const highTask = ass >= 65;
    const lowTask = ass < 45;
    const highFA = falseAlarmRate > 0.25;
    const highMiss = missRate > 0.4;
    const fatigueDrop = fatigueAnalysis.available && fatigueAnalysis.declineDetected;

    // Check self-report gap patterns
    if (selfReport.available) {
        const highSR = selfReport.average >= 3.5;
        const lowSR = selfReport.average < 2.5;

        if (highTask && lowSR) {
            return {
                diagnosticPattern: "underconfidence",
                diagnosticPatternLabel: "Task high, self-report low — underconfidence",
            };
        }
        if (lowTask && highSR) {
            return {
                diagnosticPattern: "awareness_control_gap",
                diagnosticPatternLabel: "Task low, self-report high — awareness-control gap",
            };
        }
    }

    // Impulsivity: many false alarms
    if (highFA) {
        return {
            diagnosticPattern: "impulsivity",
            diagnosticPatternLabel: "Many false alarms — impulsivity / weak inhibition",
        };
    }

    // Fatigue sensitivity: accuracy declines in second half
    if (fatigueDrop && hitRate >= 0.5) {
        return {
            diagnosticPattern: "fatigue_sensitivity",
            diagnosticPatternLabel: "High accuracy, late decline — fatigue sensitivity",
        };
    }

    // Sustained attention drop: misses increase over time
    if (highMiss && !highFA && fatigueAnalysis.available) {
        return {
            diagnosticPattern: "sustained_drop",
            diagnosticPatternLabel: "Misses increase over time — sustained attention drop",
        };
    }

    // General difficulty
    if (lowTask) {
        return {
            diagnosticPattern: "general_difficulty",
            diagnosticPatternLabel: "General attention difficulty across dimensions",
        };
    }

    // Stable focus
    return {
        diagnosticPattern: "stable_focus",
        diagnosticPatternLabel: "Stable, well-controlled attention",
    };
}
