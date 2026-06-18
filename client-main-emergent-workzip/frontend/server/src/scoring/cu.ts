const AGE_BAND_CUTOFFS: Record<string, { surface: number; adequate: number }> = {
    A: { surface: 39, adequate: 59 },
    B: { surface: 39, adequate: 64 },
    C: { surface: 44, adequate: 69 },
    D: { surface: 49, adequate: 74 },
    E1: { surface: 49, adequate: 79 },
    E2: { surface: 54, adequate: 84 },
    E3: { surface: 59, adequate: 89 },
};

const DEFAULT_CUTOFFS = AGE_BAND_CUTOFFS.B;

export type CUBand = "Surface" | "Adequate" | "Strong";

export interface CUResult {
    items: Record<string, number>;
    rawTotal: number;
    cuPercent: number;
    band: CUBand;
    bandLabel: string;
    ageBand: string;
    cu1Correct: boolean;
    cu2Correct: boolean;
    cu3Correct: boolean;
    teacherSummary: string;
    parentSummary: string;
    skillBreakdown: { code: string; skill: string; observation: string }[];
    redFlags: string[];
    alerts: { level: string; label: string; detail: string }[];
    intervention: string;
}

export function scoreCU(
    answers: Record<string, number>,
    ageBand: string = "B"
): CUResult {
    const cu1 = answers.CU1 ?? 0;
    const cu2 = answers.CU2 ?? 0;
    const cu3 = answers.CU3 ?? 0;

    const items: Record<string, number> = { CU1: cu1, CU2: cu2, CU3: cu3 };

    const rawTotal = cu1 + cu2 + cu3;
    const cuPercent = Math.round((rawTotal / 3) * 100);

    const cutoffs = AGE_BAND_CUTOFFS[ageBand] || DEFAULT_CUTOFFS;

    let band: CUBand;
    if (cuPercent <= cutoffs.surface) band = "Surface";
    else if (cuPercent <= cutoffs.adequate) band = "Adequate";
    else band = "Strong";

    const bandLabels: Record<CUBand, string> = {
        Surface: "Surface Understanding",
        Adequate: "Adequate Understanding",
        Strong: "Strong Conceptual Understanding",
    };

    const cu1Correct = cu1 === 1;
    const cu2Correct = cu2 === 1;
    const cu3Correct = cu3 === 1;

    const skillBreakdown: { code: string; skill: string; observation: string }[] = [
        {
            code: "CU1",
            skill: "Main Idea",
            observation: cu1Correct ? "Correct and confident" : "Missed or uncertain",
        },
        {
            code: "CU2",
            skill: "Cause–Effect",
            observation: cu2Correct ? "Correct" : "Incorrect — fragmented understanding",
        },
        {
            code: "CU3",
            skill: "Application (Near Transfer)",
            observation: cu3Correct ? "Correct" : "Incorrect — rote comprehension risk",
        },
    ];

    const teacherSummaryMap: Record<CUBand, string> = {
        Surface: "The learner shows surface-level understanding, relying on detail recognition rather than meaning extraction. Conceptual integration is limited.",
        Adequate: "The learner demonstrates basic conceptual understanding with some ability to identify relationships. Application skills are developing.",
        Strong: "The learner displays strong conceptual understanding with reliable meaning extraction, cause–effect reasoning, and application ability.",
    };

    const parentSummaryMap: Record<CUBand, string> = {
        Surface: "Your child can recognise some details but needs help connecting ideas and understanding how things work.",
        Adequate: "Your child understands main ideas but would benefit from more practice explaining and applying what they learn.",
        Strong: "Your child understands ideas well and can explain and use them in new situations.",
    };

    const redFlags: string[] = [];

    if (cuPercent < 40) {
        redFlags.push("Surface processing detected");
    }
    if (!cu3Correct) {
        redFlags.push("No transfer — application failed");
    }
    if (cu1Correct && !cu2Correct && !cu3Correct) {
        redFlags.push("Shallow gist only — CU1 correct but CU2 and CU3 failed");
    }

    const upperBands = ["C", "D", "E1", "E2", "E3"];
    if (upperBands.includes(ageBand) && cuPercent < 60) {
        redFlags.push("Below expected conceptual understanding for age/stage");
    }
    if (["D"].includes(ageBand) && !cu2Correct) {
        redFlags.push("Weak cause–effect logic for Class 11–12");
    }
    if (["E1", "E2", "E3"].includes(ageBand) && cuPercent < 70) {
        redFlags.push("Concept readiness gap for higher learning");
    }
    if (["E2", "E3"].includes(ageBand) && !cu3Correct) {
        redFlags.push("Application failure — training transfer risk");
    }

    const alerts: { level: string; label: string; detail: string }[] = [];

    if (band === "Surface") {
        alerts.push({ level: "🔴", label: "Concept Risk", detail: "Below age-band adequate" });
    }
    if (!cu3Correct) {
        alerts.push({ level: "🟠", label: "Application Gap", detail: "CU3 incorrect" });
    }
    if (cu1Correct && !cu2Correct && !cu3Correct) {
        alerts.push({ level: "🟡", label: "Surface Learning", detail: "Only main idea identified" });
    }

    let intervention: string;
    if (!cu2Correct && !cu3Correct) {
        intervention = "Replace 'define' questions with 'explain why' — model structured explanations using worked examples";
    } else if (!cu3Correct) {
        intervention = "Add 1–2 application questions per test — encourage written explanations, not bullet-point recall";
    } else if (!cu2Correct) {
        intervention = "Use simple cause–effect charts — ask 'Why do you think this happens?' after reading activities";
    } else {
        intervention = "Maintain current approach — introduce higher-order tasks with scaffolding";
    }

    return {
        items,
        rawTotal,
        cuPercent,
        band,
        bandLabel: bandLabels[band],
        ageBand,
        cu1Correct,
        cu2Correct,
        cu3Correct,
        teacherSummary: teacherSummaryMap[band],
        parentSummary: parentSummaryMap[band],
        skillBreakdown,
        redFlags,
        alerts,
        intervention,
    };
}
