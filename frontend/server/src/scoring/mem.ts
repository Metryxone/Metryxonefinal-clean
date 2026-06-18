// ═══════════════════════════════════════════
// Memory Effectiveness (MEM) — Scoring Engine
// Subdomain: 1C (Memory Efficiency / ACE_SD04)
//
// Module A: Immediate Recall — Encoding (IRS: 0–10)
//   Free recall of 10 words after 25-second exposure
//
// Module B: Recognition with Distractors — Distortion Resistance (DRS)
//   Select original words from a mixed pool of 10 primaries + 10 distractors
//
// Diagnostic ratios identify:
//   - Encoding accuracy
//   - Retention strength
//   - Distortion resistance (interference / false memory vulnerability)
// ═══════════════════════════════════════════

// ─── Age-Band Norm Cutoffs ───
// memPercent thresholds: [lowMax, emergingMax, effectiveMax]
// Higher bands expect better distortion resistance
const AGE_BAND_CUTOFFS: Record<string, { low: number; emerging: number; effective: number }> = {
    A:  { low: 29, emerging: 49, effective: 69 },   // Class 6–7 (11–13)
    B:  { low: 34, emerging: 54, effective: 74 },   // Class 8–9 (13–15)
    C:  { low: 39, emerging: 59, effective: 79 },   // Class 10 (15–16)
    D:  { low: 44, emerging: 64, effective: 84 },   // Class 11–12 (16–18)
    E1: { low: 44, emerging: 64, effective: 84 },   // Undergraduate (18–22)
    E2: { low: 49, emerging: 69, effective: 89 },   // Early Career (23–29)
    E3: { low: 54, emerging: 74, effective: 94 },   // Adult/Lifelong (30+)
};

const DEFAULT_CUTOFFS = AGE_BAND_CUTOFFS.B;

// ─── False-Alarm Rate Thresholds (age-adjusted) ───
// Percentage of distractors incorrectly selected
const FA_RATE_THRESHOLDS: Record<string, { acceptable: number; elevated: number }> = {
    A:  { acceptable: 30, elevated: 50 },
    B:  { acceptable: 25, elevated: 45 },
    C:  { acceptable: 20, elevated: 40 },
    D:  { acceptable: 15, elevated: 35 },
    E1: { acceptable: 15, elevated: 35 },
    E2: { acceptable: 10, elevated: 30 },
    E3: { acceptable: 10, elevated: 25 },
};

const DEFAULT_FA_THRESHOLDS = FA_RATE_THRESHOLDS.B;

// ─── Types ───

export type MemoryBand = "Low" | "Emerging" | "Effective" | "High";
export type FALevel = "Low" | "Acceptable" | "Elevated" | "High";

export type DiagnosticPattern =
    | "strong_stable"           // High IRS, High DRS, Low FA
    | "poor_consolidation"      // High IRS, Low DRS, Low FA
    | "confusion_risk"          // High IRS, High FA
    | "encoding_interference"   // Low IRS, High FA
    | "guessing_impulsivity"    // Good recall, poor recognition control
    | "weak_encoding"           // Low IRS, Low DRS, Low FA
    | "general_difficulty";     // Low IRS, Low DRS, High FA

export interface RecognitionMetrics {
    hits: number;
    falseAlarms: number;
    misses: number;
    correctRejections: number;
    hitRate: number;           // hits / totalPrimary (0–1)
    falseAlarmRate: number;    // falseAlarms / totalDistractors (0–1)
    discriminability: number;  // hitRate - falseAlarmRate (d-prime approximation)
}

export interface MemoryResult {
    // Raw data
    moduleARecalled: string[];
    moduleBRecognized: string[];

    // Module A: Immediate Recall Score
    irs: number;              // 0–10 (correct recalls)
    irsPercent: number;       // (irs / totalWordsA) * 100
    totalWordsA: number;

    // Module B: Recognition metrics
    recognition: RecognitionMetrics;
    drs: number;              // Recognition accuracy (hits out of primary words)
    drsPercent: number;       // (hits / totalWordsB) * 100
    totalWordsB: number;
    totalDistractors: number;

    // Composite score
    memPercent: number;       // Weighted composite: 40% IRS + 40% DRS + 20% distortion resistance
    band: MemoryBand;
    bandLabel: string;
    ageBand: string;

    // False-alarm analysis
    falseAlarmRate: number;   // Percentage
    faLevel: FALevel;

    // Diagnostic pattern
    diagnosticPattern: DiagnosticPattern;
    diagnosticPatternLabel: string;

    // Reporting
    teacherSummary: string;
    parentSummary: string;
    diagnosticText: string;
    skillBreakdown: { code: string; skill: string; observation: string }[];
    redFlags: string[];
    alerts: { level: string; label: string; detail: string }[];
    intervention: string;
}

// ─── Input interface ───
export interface MemoryAnswerInput {
    recalled: string[];
    recognized: string[];
    moduleAScore?: number;
    moduleBScore?: number;
    moduleBFalsePositives?: number;
    totalWordsA?: number;
    totalWordsB?: number;
}

export interface MemoryQuestionData {
    wordSet: string[];
    moduleBWords: string[];
    distractorPool: string[];
}

// ═══════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════

export function scoreMemory(
    answer: MemoryAnswerInput,
    question: MemoryQuestionData,
    ageBand: string = "B"
): MemoryResult {
    const wordSet = question.wordSet || [];
    const moduleBWords = question.moduleBWords || [];
    const distractorPool = question.distractorPool || [];

    const totalWordsA = wordSet.length || 10;
    const totalWordsB = moduleBWords.length || 10;
    const totalDistractors = distractorPool.length || 10;

    // ─── Module A: Immediate Recall Score (IRS) ───
    const recalled = answer.recalled || [];
    const normalizedWordSet = wordSet.map(w => w.toLowerCase().trim());

    const correctRecalls = recalled.filter(w =>
        normalizedWordSet.includes(w.toLowerCase().trim())
    );
    const irs = correctRecalls.length;
    const irsPercent = Math.round((irs / totalWordsA) * 100);

    // ─── Module B: Recognition with Distractors ───
    const recognized = answer.recognized || [];
    const normalizedBWords = moduleBWords.map(w => w.toLowerCase().trim());
    const normalizedDistractors = distractorPool.map(w => w.toLowerCase().trim());

    const hits = recognized.filter(w =>
        normalizedBWords.includes(w.toLowerCase().trim())
    ).length;

    const falseAlarms = recognized.filter(w =>
        normalizedDistractors.includes(w.toLowerCase().trim())
    ).length;

    const misses = totalWordsB - hits;
    const correctRejections = totalDistractors - falseAlarms;

    const hitRate = totalWordsB > 0 ? hits / totalWordsB : 0;
    const falseAlarmRate = totalDistractors > 0 ? falseAlarms / totalDistractors : 0;
    const discriminability = Math.max(0, hitRate - falseAlarmRate);

    const recognition: RecognitionMetrics = {
        hits,
        falseAlarms,
        misses,
        correctRejections,
        hitRate: Number(hitRate.toFixed(2)),
        falseAlarmRate: Number(falseAlarmRate.toFixed(2)),
        discriminability: Number(discriminability.toFixed(2)),
    };

    const drs = hits;
    const drsPercent = Math.round((hits / totalWordsB) * 100);

    // ─── False-Alarm Analysis ───
    const faRatePercent = Math.round(falseAlarmRate * 100);
    const faThresholds = FA_RATE_THRESHOLDS[ageBand] || DEFAULT_FA_THRESHOLDS;

    let faLevel: FALevel;
    if (faRatePercent <= 10) faLevel = "Low";
    else if (faRatePercent <= faThresholds.acceptable) faLevel = "Acceptable";
    else if (faRatePercent <= faThresholds.elevated) faLevel = "Elevated";
    else faLevel = "High";

    // ─── Composite Memory Score ───
    // 40% encoding (IRS) + 40% recognition accuracy (DRS) + 20% distortion resistance
    const distortionResistance = Math.round((1 - falseAlarmRate) * 100);
    const memPercent = Math.round(
        (irsPercent * 0.4) + (drsPercent * 0.4) + (distortionResistance * 0.2)
    );

    // ─── Band Classification ───
    const cutoffs = AGE_BAND_CUTOFFS[ageBand] || DEFAULT_CUTOFFS;

    let band: MemoryBand;
    if (memPercent <= cutoffs.low) band = "Low";
    else if (memPercent <= cutoffs.emerging) band = "Emerging";
    else if (memPercent <= cutoffs.effective) band = "Effective";
    else band = "High";

    const bandLabels: Record<MemoryBand, string> = {
        Low: "Low Memory Effectiveness",
        Emerging: "Emerging Memory Effectiveness",
        Effective: "Effective Memory",
        High: "Strong Memory Effectiveness",
    };

    // ─── Diagnostic Pattern Detection ───
    const highIRS = irsPercent >= 60;
    const highDRS = drsPercent >= 60;
    const highFA = faLevel === "Elevated" || faLevel === "High";
    const lowFA = faLevel === "Low" || faLevel === "Acceptable";

    let diagnosticPattern: DiagnosticPattern;
    let diagnosticPatternLabel: string;

    if (highIRS && highDRS && lowFA) {
        diagnosticPattern = "strong_stable";
        diagnosticPatternLabel = "Strong, stable memory";
    } else if (highIRS && !highDRS && lowFA) {
        diagnosticPattern = "poor_consolidation";
        diagnosticPatternLabel = "Poor consolidation despite good encoding";
    } else if (highIRS && highDRS && highFA) {
        // Good recall but poor discrimination — guessing (more specific, check before confusion_risk)
        diagnosticPattern = "guessing_impulsivity";
        diagnosticPatternLabel = "Possible guessing or impulsivity";
    } else if (highIRS && highFA) {
        diagnosticPattern = "confusion_risk";
        diagnosticPatternLabel = "Confusion under similarity (exam risk)";
    } else if (!highIRS && highFA) {
        diagnosticPattern = "encoding_interference";
        diagnosticPatternLabel = "Encoding weakness with interference vulnerability";
    } else if (!highIRS && !highDRS && lowFA) {
        diagnosticPattern = "weak_encoding";
        diagnosticPatternLabel = "Weak initial encoding";
    } else {
        diagnosticPattern = "general_difficulty";
        diagnosticPatternLabel = "General memory difficulty";
    }

    // ─── Teacher Summary ───
    const teacherSummaryMap: Record<MemoryBand, string> = {
        Low: "The learner shows significant difficulty with memory encoding and retention. Both free recall and recognition performance are below age expectations, suggesting foundational memory strategies need development.",
        Emerging: "The learner demonstrates partial memory effectiveness. Encoding is inconsistent and distortion resistance is developing. Structured study strategies and spaced practice would benefit this learner.",
        Effective: "The learner displays age-appropriate memory effectiveness with reliable encoding and reasonable distortion resistance. Minor improvements in precision could further enhance exam performance.",
        High: "The learner shows strong memory effectiveness with accurate encoding, solid retention, and good resistance to interference. Memory processes are well-developed for their age.",
    };

    // ─── Parent Summary ───
    const parentSummaryMap: Record<MemoryBand, string> = {
        Low: "Your child is finding it difficult to remember and recognise information accurately. This is not about effort — they may need different study techniques to help information stick.",
        Emerging: "Your child can remember some things well but sometimes mixes up similar information. Simple techniques like reviewing in short sessions can help.",
        Effective: "Your child has good memory skills and can usually tell apart similar pieces of information. Keep up the current study habits.",
        High: "Your child remembers information accurately and resists confusion from similar-looking answers very well.",
    };

    // ─── Diagnostic Text (Pattern-based) ───
    const diagnosticTextMap: Record<DiagnosticPattern, string> = {
        strong_stable: "Memory encoding, retention, and distortion resistance are all within the strong range. The learner accurately encodes new information and can distinguish original material from similar alternatives.",
        poor_consolidation: "The learner encodes information well initially but struggles to maintain accuracy during recognition. This suggests a consolidation gap — information is learned but not stabilised for retrieval under interference.",
        confusion_risk: "The learner shows good initial recall but selects too many distractors during recognition. This indicates susceptibility to semantic interference — exam errors likely stem from confusion between similar options, not forgetting.",
        encoding_interference: "Both encoding and distortion resistance are weak. The learner has difficulty capturing information accurately and is vulnerable to interference from similar items. This combination creates high exam risk.",
        guessing_impulsivity: "Recall appears adequate, but the high false-alarm rate in recognition suggests impulsive selection or over-reliance on familiarity rather than precise memory. The learner may feel confident but lack discrimination accuracy.",
        weak_encoding: "The learner struggles to encode information in the first place. Low recall and low recognition (without excessive false alarms) indicate the primary issue is at the input stage, not interference.",
        general_difficulty: "The learner shows difficulty across encoding, recognition, and distortion resistance. A comprehensive memory support strategy is recommended.",
    };

    // ─── Skill Breakdown ───
    const skillBreakdown: { code: string; skill: string; observation: string }[] = [
        {
            code: "IRS",
            skill: "Immediate Recall (Encoding)",
            observation: irs >= 7
                ? `Strong encoding — ${irs}/${totalWordsA} words recalled correctly`
                : irs >= 4
                    ? `Partial encoding — ${irs}/${totalWordsA} words recalled`
                    : `Weak encoding — only ${irs}/${totalWordsA} words recalled`,
        },
        {
            code: "DRS",
            skill: "Recognition Accuracy",
            observation: hits >= 7
                ? `Strong recognition — ${hits}/${totalWordsB} original words correctly identified`
                : hits >= 4
                    ? `Partial recognition — ${hits}/${totalWordsB} original words identified`
                    : `Weak recognition — only ${hits}/${totalWordsB} original words identified`,
        },
        {
            code: "FA",
            skill: "Distortion Resistance",
            observation: falseAlarms === 0
                ? "Excellent — no distractors incorrectly selected"
                : falseAlarms <= 2
                    ? `Good — only ${falseAlarms} distractor(s) incorrectly selected`
                    : falseAlarms <= 4
                        ? `Moderate — ${falseAlarms} distractors incorrectly selected, some interference vulnerability`
                        : `Weak — ${falseAlarms} distractors incorrectly selected, significant interference vulnerability`,
        },
        {
            code: "DISC",
            skill: "Discriminability",
            observation: discriminability >= 0.7
                ? "Strong ability to distinguish studied items from similar alternatives"
                : discriminability >= 0.4
                    ? "Moderate ability to distinguish studied items — some confusion under similarity"
                    : "Low discriminability — difficulty separating original items from distractors",
        },
    ];

    // ─── Red Flags ───
    const redFlags: string[] = [];
    const upperBands = ["C", "D", "E1", "E2", "E3"];

    if (memPercent < 40) {
        redFlags.push("Overall memory effectiveness below functional threshold");
    }
    if (upperBands.includes(ageBand) && memPercent < 55) {
        redFlags.push("Memory effectiveness below expected level for age/stage");
    }
    if (irsPercent >= 60 && faRatePercent >= 40) {
        redFlags.push("High confusion under similarity — exam risk pattern detected");
    }
    if (irsPercent < 30) {
        redFlags.push("Severe encoding weakness — information is not being captured");
    }
    if (falseAlarms >= 5) {
        redFlags.push("Excessive false alarms — high interference vulnerability");
    }
    if (irsPercent >= 60 && drsPercent < 40) {
        redFlags.push("Consolidation gap — good encoding but poor recognition");
    }
    if (["E2", "E3"].includes(ageBand) && faRatePercent > 30) {
        redFlags.push("Adult learner showing unexpected interference susceptibility");
    }
    if (discriminability < 0.2) {
        redFlags.push("Near-chance discriminability — possible random responding");
    }

    // ─── Alerts ───
    const alerts: { level: string; label: string; detail: string }[] = [];

    if (band === "Low") {
        alerts.push({ level: "red", label: "Memory Risk", detail: "Below age-band functional threshold" });
    }
    if (diagnosticPattern === "confusion_risk") {
        alerts.push({ level: "orange", label: "Exam Confusion Risk", detail: "High false alarms despite good recall" });
    }
    if (diagnosticPattern === "encoding_interference") {
        alerts.push({ level: "red", label: "Encoding + Interference", detail: "Weak encoding combined with distortion vulnerability" });
    }
    if (diagnosticPattern === "poor_consolidation") {
        alerts.push({ level: "yellow", label: "Consolidation Gap", detail: "Good encoding but recognition falters" });
    }
    if (faLevel === "High") {
        alerts.push({ level: "orange", label: "High Distortion", detail: `False alarm rate: ${faRatePercent}%` });
    }
    if (diagnosticPattern === "guessing_impulsivity") {
        alerts.push({ level: "yellow", label: "Impulsivity Risk", detail: "Possible over-selection without discrimination" });
    }

    // ─── Intervention ───
    let intervention: string;

    switch (diagnosticPattern) {
        case "weak_encoding":
            intervention = "Focus on encoding strategies: use visual imagery, chunking, and verbal rehearsal during study. Reduce study load per session and increase repetition frequency.";
            break;
        case "poor_consolidation":
            intervention = "Introduce spaced retrieval practice — short quizzes after study sessions. Use 'write from memory' exercises to strengthen consolidation before recognition tasks.";
            break;
        case "confusion_risk":
            intervention = "Build clarity-building strategies: use comparison tables for similar concepts, highlight distinguishing features, and practice 'which one is NOT' exercises. The issue is confusion, not forgetting.";
            break;
        case "encoding_interference":
            intervention = "Address both encoding and interference: simplify initial study material, use distinct categories, and introduce one concept at a time before comparing similar items.";
            break;
        case "guessing_impulsivity":
            intervention = "Train careful selection: practice 'explain why you chose this' exercises. Encourage slowing down during recognition tasks and checking each option against memory rather than selecting on familiarity.";
            break;
        case "general_difficulty":
            intervention = "Implement a structured memory support programme: combine visual aids, spaced repetition, and active recall. Consider shorter study sessions with immediate self-testing.";
            break;
        case "strong_stable":
        default:
            intervention = "Maintain current study strategies. Consider introducing more challenging material or advanced memory techniques like elaborative encoding to extend capacity.";
            break;
    }

    return {
        moduleARecalled: recalled,
        moduleBRecognized: recognized,

        irs,
        irsPercent,
        totalWordsA,

        recognition,
        drs,
        drsPercent,
        totalWordsB,
        totalDistractors,

        memPercent,
        band,
        bandLabel: bandLabels[band],
        ageBand,

        falseAlarmRate: faRatePercent,
        faLevel,

        diagnosticPattern,
        diagnosticPatternLabel,

        teacherSummary: teacherSummaryMap[band],
        parentSummary: parentSummaryMap[band],
        diagnosticText: diagnosticTextMap[diagnosticPattern],
        skillBreakdown,
        redFlags,
        alerts,
        intervention,
    };
}
