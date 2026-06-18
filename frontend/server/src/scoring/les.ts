// ═══════════════════════════════════════════
// Learning Efficiency Scale (LES) — Scoring Engine
// Subdomain: 1A (Learning Efficiency)
// Items: LE1–LE8 (8 Likert, 1–5 scale)
// LE2 is reverse-scored: 6 − original
// LES = LE1 + LE2R + LE3 + LE4 + LE5 + LE6 + LE7 (LE8 excluded from total)
// LES% = ((Raw − 7) / 28) × 100
// ═══════════════════════════════════════════

// ─── Age-Band Norm Cutoffs ───
// Each band: [lowMax, emergingMax, effectiveMax] — anything above effectiveMax is High/Elite
const AGE_BAND_CUTOFFS: Record<string, { low: number; emerging: number; effective: number }> = {
    A: { low: 34, emerging: 54, effective: 74 },   // Class 6–7 (11–13)
    B: { low: 39, emerging: 59, effective: 79 },   // Class 8–9 (13–15)
    C: { low: 44, emerging: 64, effective: 84 },   // Class 10 (15–16)
    D: { low: 49, emerging: 69, effective: 89 },   // Class 11–12 (16–18)
    E1: { low: 44, emerging: 64, effective: 84 },   // Undergraduate (18–22)
    E2: { low: 49, emerging: 69, effective: 89 },   // Early Career (23–29)
    E3: { low: 54, emerging: 74, effective: 94 },   // Adult/Lifelong (30+)
};

const DEFAULT_CUTOFFS = AGE_BAND_CUTOFFS.B;

export type LESBand = "Low" | "Emerging" | "Effective" | "High";
export type MMILevel = "Low" | "Medium" | "High";
export type MCILevel = "Low" | "Medium" | "High";

export interface LESResult {
    items: Record<string, number>;
    rawTotal: number;
    lesPercent: number;
    band: LESBand;
    bandLabel: string;
    ageBand: string;
    mmi: number;
    mmiLevel: MMILevel;
    mci: number;
    mciLevel: MCILevel;
    metacognitivePattern: string;
    metacognitivePatternLabel: string;
    teacherSummary: string;
    parentSummary: string;
    diagnosticText: string;
    itemInsights: { code: string; teacher: string; parent: string }[];
    redFlags: string[];
    intervention: string;
}

export function scoreLES(
    answers: Record<string, number>,
    ageBand: string = "B"
): LESResult {
    const items: Record<string, number> = {};

    const le1 = answers.LE1 ?? 3;
    const le2 = answers.LE2 ?? 3;
    const le3 = answers.LE3 ?? 3;
    const le4 = answers.LE4 ?? 3;
    const le5 = answers.LE5 ?? 3;
    const le6 = answers.LE6 ?? 3;
    const le7 = answers.LE7 ?? 3;
    const le8 = answers.LE8 ?? 3;

    const le2r = 6 - le2;

    items.LE1 = le1;
    items.LE2 = le2;
    items.LE2R = le2r;
    items.LE3 = le3;
    items.LE4 = le4;
    items.LE5 = le5;
    items.LE6 = le6;
    items.LE7 = le7;
    items.LE8 = le8;

    const rawTotal = le1 + le2r + le3 + le4 + le5 + le6 + le7;

    const lesPercent = Math.round(((rawTotal - 7) / 28) * 100);

    const cutoffs = AGE_BAND_CUTOFFS[ageBand] || DEFAULT_CUTOFFS;

    let band: LESBand;
    if (lesPercent <= cutoffs.low) band = "Low";
    else if (lesPercent <= cutoffs.emerging) band = "Emerging";
    else if (lesPercent <= cutoffs.effective) band = "Effective";
    else band = "High";

    const bandLabels: Record<LESBand, string> = {
        Low: "Low Efficiency",
        Emerging: "Emerging Efficiency",
        Effective: "Effective Efficiency",
        High: "High Efficiency",
    };

    const mmi = Number(((le1 + le2r + le3 + le5 + le7) / 5).toFixed(2));
    const mci = Number(((le4 + le6) / 2).toFixed(2));

    const mmiLevel: MMILevel = mmi < 3.0 ? "Low" : mmi < 4.0 ? "Medium" : "High";
    const mciLevel: MCILevel = mci < 3.0 ? "Low" : mci < 4.0 ? "Medium" : "High";

    let metacognitivePattern: string;
    let metacognitivePatternLabel: string;
    if (mmi < 4.0 && mci < 4.0) {
        metacognitivePattern = "low_mmi_low_mci";
        metacognitivePatternLabel = "Unaware and unregulated learner";
    } else if (mmi >= 4.0 && mci < 4.0) {
        metacognitivePattern = "high_mmi_low_mci";
        metacognitivePatternLabel = "Aware but passive";
    } else if (mmi < 4.0 && mci >= 4.0) {
        metacognitivePattern = "low_mmi_high_mci";
        metacognitivePatternLabel = "Trial-and-error learner";
    } else {
        metacognitivePattern = "high_mmi_high_mci";
        metacognitivePatternLabel = "Expert-like self-regulated learner";
    }

    const teacherSummaryMap: Record<LESBand, string> = {
        Low: "The learner shows inefficient learning patterns for their age, with difficulty converting study effort into clear understanding.",
        Emerging: "The learner demonstrates partial learning efficiency with inconsistent strategy use and developing self-awareness.",
        Effective: "The learner displays age-appropriate learning efficiency with reliable understanding and adaptive study strategies.",
        High: "The learner shows strong self-regulated learning skills and highly efficient study habits for their age.",
    };

    const parentSummaryMap: Record<LESBand, string> = {
        Low: "Your child is working hard but needs better study methods to understand lessons more clearly.",
        Emerging: "Your child is learning, but their study habits are still developing.",
        Effective: "Your child is using good study methods and understands lessons well.",
        High: "Your child is learning very effectively for their age.",
    };

    const diagnosticTextMap: Record<string, string> = {
        low_mmi_low_mci: "The learner is not yet aware of learning gaps and does not adjust study strategies.",
        high_mmi_low_mci: "The learner recognises difficulties but does not consistently change study strategies.",
        low_mmi_high_mci: "The learner experiments with methods but lacks clear awareness of what works.",
        high_mmi_high_mci: "The learner shows strong awareness and control over their learning process.",
    };

    const itemInsights: { code: string; teacher: string; parent: string }[] = [];

    if (le2r <= 2) {
        itemInsights.push({
            code: "LE2R",
            teacher: "High study effort with low clarity detected.",
            parent: "Studying for long hours may not be helping understanding.",
        });
    }
    if (le3 <= 2) {
        itemInsights.push({
            code: "LE3",
            teacher: "Learner struggles to identify what they do not understand.",
            parent: "Your child may not always realise when they are confused.",
        });
    }
    if (le4 <= 2) {
        itemInsights.push({
            code: "LE4",
            teacher: "Limited strategy adjustment when learning is ineffective.",
            parent: "Your child may benefit from learning different ways to study.",
        });
    }
    if (le6 <= 2) {
        itemInsights.push({
            code: "LE6",
            teacher: "Overreliance on rereading instead of active recall.",
            parent: "Encourage your child to explain answers without looking at notes.",
        });
    }

    const redFlags: string[] = [];
    const upperBands = ["C", "D", "E1", "E2", "E3"];

    if (upperBands.includes(ageBand) && lesPercent < 60) {
        redFlags.push("Learning efficiency below expected level for age");
    }
    if (le3 <= 2 && le4 <= 2) {
        redFlags.push("Poor awareness and poor control detected");
    }
    if (["E2", "E3"].includes(ageBand) && le6 <= 2) {
        redFlags.push("Adult learner inefficiency risk");
    }

    let intervention: string;
    if (le6 <= 2) {
        intervention = "Introduce weekly recall practice";
    } else if (le4 <= 2) {
        intervention = "Teach strategy-switching techniques";
    } else if (le3 <= 2) {
        intervention = "Use self-check questions after study";
    } else {
        intervention = "Maintain current learning strategies";
    }

    return {
        items,
        rawTotal,
        lesPercent,
        band,
        bandLabel: bandLabels[band],
        ageBand,
        mmi,
        mmiLevel,
        mci,
        mciLevel,
        metacognitivePattern,
        metacognitivePatternLabel,
        teacherSummary: teacherSummaryMap[band],
        parentSummary: parentSummaryMap[band],
        diagnosticText: diagnosticTextMap[metacognitivePattern],
        itemInsights,
        redFlags,
        intervention,
    };
}
