import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import { db } from "../db/drizzle.js";
import { examReadyReports, examReadyAttempts } from "../db/schema.js";
import { eq } from "drizzle-orm";
import * as notifService from "../notifications/service.js";

// ─── Colors ───
const BLUE = "#0B3C5D";
const GREEN = "#2FA36B";
const AMBER = "#D97706";
const RED = "#DC2626";
const GRAY = "#6B7280";
const LIGHT_GRAY = "#F3F4F6";

// ─── PDF Helpers ───

function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.5);
  doc
    .fontSize(16)
    .fillColor(BLUE)
    .text(title, { underline: false });
  doc
    .moveTo(doc.x, doc.y + 2)
    .lineTo(doc.x + 500, doc.y + 2)
    .strokeColor(BLUE)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.5);
}

function subsectionHeader(doc: PDFKit.PDFDocument, title: string) {
  doc
    .fontSize(12)
    .fillColor(GREEN)
    .text(title, { underline: false });
  doc.moveDown(0.3);
}

function scoreBar(
  doc: PDFKit.PDFDocument,
  label: string,
  value: number,
  max: number
) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const barColor = pct >= 70 ? GREEN : pct >= 45 ? AMBER : RED;
  const barWidth = 300;
  const barHeight = 12;
  const x = doc.x;
  const y = doc.y;

  doc.fontSize(10).fillColor(GRAY).text(`${label}: ${value}/${max}`, x, y);
  const barY = doc.y + 2;

  // Background bar
  doc
    .rect(x, barY, barWidth, barHeight)
    .fillColor(LIGHT_GRAY)
    .fill();

  // Filled bar
  if (pct > 0) {
    doc
      .rect(x, barY, barWidth * (pct / 100), barHeight)
      .fillColor(barColor)
      .fill();
  }

  doc.y = barY + barHeight + 8;
}

function drawOverallScore(
  doc: PDFKit.PDFDocument,
  score: number,
  level: string
) {
  const levelColor =
    level === "High" ? GREEN : level === "Moderate" ? AMBER : RED;

  doc.moveDown(0.5);
  doc.fontSize(36).fillColor(BLUE).text(`${Math.round(score)}`, { align: "center" });
  doc.fontSize(14).fillColor(GRAY).text("/ 100", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(14).fillColor(levelColor).text(level, { align: "center" });
  doc.moveDown(0.5);
}

function bulletList(doc: PDFKit.PDFDocument, items: string[], color = GRAY) {
  for (const item of items) {
    doc.fontSize(10).fillColor(color).text(`  •  ${item}`, { indent: 10 });
  }
  doc.moveDown(0.3);
}

function checkPageSpace(doc: PDFKit.PDFDocument, needed: number = 120) {
  if (doc.y + needed > doc.page.height - 80) {
    doc.addPage();
  }
}

// ─── Time Helpers ───

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function renderTimeAnalysis(
  doc: PDFKit.PDFDocument,
  totalTimeSec: number,
  timePerQuestion: Record<string, number>,
  questionCount: number
) {
  sectionHeader(doc, "Time Analysis");

  // Total time
  doc.fontSize(12).fillColor(BLUE).text(`Total Time Taken: ${formatDuration(totalTimeSec)}`);
  doc.moveDown(0.3);

  const questionTimes = Object.values(timePerQuestion);
  if (questionTimes.length > 0) {
    const avgTime = Math.round(questionTimes.reduce((a, b) => a + b, 0) / questionTimes.length);
    const minTime = Math.min(...questionTimes);
    const maxTime = Math.max(...questionTimes);

    doc.fontSize(10).fillColor(GRAY).text(`Questions Answered: ${questionTimes.length} / ${questionCount}`);
    doc.fontSize(10).fillColor(GRAY).text(`Average Time per Question: ${formatDuration(avgTime)}`);
    doc.fontSize(10).fillColor(GRAY).text(`Fastest Response: ${formatDuration(minTime)}`);
    doc.fontSize(10).fillColor(GRAY).text(`Slowest Response: ${formatDuration(maxTime)}`);
    doc.moveDown(0.5);

    // Time distribution bar chart (grouped by speed)
    const fast = questionTimes.filter(t => t <= 15).length;
    const moderate = questionTimes.filter(t => t > 15 && t <= 45).length;
    const slow = questionTimes.filter(t => t > 45).length;

    subsectionHeader(doc, "Response Speed Distribution");
    const barWidth = 200;
    const barHeight = 14;
    const x = doc.x;

    // Fast
    const fastPct = fast / questionTimes.length;
    doc.fontSize(9).fillColor(GREEN).text(`Quick (≤15s): ${fast} questions (${Math.round(fastPct * 100)}%)`, x, doc.y);
    let barY = doc.y + 2;
    doc.rect(x, barY, barWidth, barHeight).fillColor(LIGHT_GRAY).fill();
    if (fastPct > 0) doc.rect(x, barY, barWidth * fastPct, barHeight).fillColor(GREEN).fill();
    doc.y = barY + barHeight + 6;

    // Moderate
    const modPct = moderate / questionTimes.length;
    doc.fontSize(9).fillColor(AMBER).text(`Moderate (15-45s): ${moderate} questions (${Math.round(modPct * 100)}%)`, x, doc.y);
    barY = doc.y + 2;
    doc.rect(x, barY, barWidth, barHeight).fillColor(LIGHT_GRAY).fill();
    if (modPct > 0) doc.rect(x, barY, barWidth * modPct, barHeight).fillColor(AMBER).fill();
    doc.y = barY + barHeight + 6;

    // Slow
    const slowPct = slow / questionTimes.length;
    doc.fontSize(9).fillColor(RED).text(`Deliberate (>45s): ${slow} questions (${Math.round(slowPct * 100)}%)`, x, doc.y);
    barY = doc.y + 2;
    doc.rect(x, barY, barWidth, barHeight).fillColor(LIGHT_GRAY).fill();
    if (slowPct > 0) doc.rect(x, barY, barWidth * slowPct, barHeight).fillColor(RED).fill();
    doc.y = barY + barHeight + 8;
  } else {
    doc.fontSize(10).fillColor(GRAY).text("Per-question timing data not available.");
  }

  doc.moveDown(0.5);
}

// ─── Module Renderers ───

function renderModule1A(doc: PDFKit.PDFDocument, data: any) {
  doc.addPage();
  sectionHeader(doc, "Module 1A: Learning Efficiency Scale (LES)");

  scoreBar(doc, "LES Score", Math.round(data.lesPercent || 0), 100);

  doc.fontSize(11).fillColor(BLUE).text(`Band: ${data.bandLabel || data.band || "N/A"}`);
  doc.moveDown(0.3);

  if (data.mmi !== undefined) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Metacognitive Monitoring Index (MMI): ${data.mmi?.toFixed(1)} — ${data.mmiLevel || ""}`);
  }
  if (data.mci !== undefined) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Metacognitive Control Index (MCI): ${data.mci?.toFixed(1)} — ${data.mciLevel || ""}`);
  }
  if (data.metacognitivePatternLabel) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Pattern: ${data.metacognitivePatternLabel}`);
  }
  doc.moveDown(0.5);

  if (data.teacherSummary) {
    subsectionHeader(doc, "Teacher Diagnostic");
    doc.fontSize(10).fillColor(GRAY).text(data.teacherSummary);
    doc.moveDown(0.3);
  }

  if (data.parentSummary) {
    subsectionHeader(doc, "Parent Guidance");
    doc.fontSize(10).fillColor(GRAY).text(data.parentSummary);
    doc.moveDown(0.3);
  }

  if (data.itemInsights?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Item Insights");
    for (const insight of data.itemInsights) {
      doc.fontSize(9).fillColor(GRAY)
        .text(`${insight.code}: ${insight.teacher}`);
    }
    doc.moveDown(0.3);
  }

  if (data.redFlags?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Red Flags");
    bulletList(doc, data.redFlags, RED);
  }

  if (data.intervention) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Recommended Intervention");
    doc.fontSize(10).fillColor(GRAY).text(data.intervention);
  }
}

function renderModule1B(doc: PDFKit.PDFDocument, data: any) {
  doc.addPage();
  sectionHeader(doc, "Module 1B: Conceptual Understanding (CU)");

  scoreBar(doc, "CU Score", Math.round(data.cuPercent || 0), 100);

  doc.fontSize(11).fillColor(BLUE).text(`Band: ${data.bandLabel || data.band || "N/A"}`);
  doc.moveDown(0.3);

  if (data.skillBreakdown?.length) {
    subsectionHeader(doc, "Skill Breakdown");
    for (const skill of data.skillBreakdown) {
      doc.fontSize(10).fillColor(GRAY)
        .text(`${skill.code} (${skill.skill}): ${skill.observation}`);
    }
    doc.moveDown(0.3);
  }

  if (data.teacherSummary) {
    subsectionHeader(doc, "Teacher Diagnostic");
    doc.fontSize(10).fillColor(GRAY).text(data.teacherSummary);
    doc.moveDown(0.3);
  }

  if (data.parentSummary) {
    subsectionHeader(doc, "Parent Guidance");
    doc.fontSize(10).fillColor(GRAY).text(data.parentSummary);
    doc.moveDown(0.3);
  }

  if (data.alerts?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Alerts");
    for (const alert of data.alerts) {
      doc.fontSize(10).fillColor(GRAY)
        .text(`${alert.level} ${alert.label}: ${alert.detail}`);
    }
    doc.moveDown(0.3);
  }

  if (data.redFlags?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Red Flags");
    bulletList(doc, data.redFlags, RED);
  }

  if (data.intervention) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Recommended Intervention");
    doc.fontSize(10).fillColor(GRAY).text(data.intervention);
  }
}

function renderModule1C(doc: PDFKit.PDFDocument, data: any) {
  doc.addPage();
  sectionHeader(doc, "Module 1C: Memory Effectiveness");

  scoreBar(doc, "Memory Score", Math.round(data.memPercent || 0), 100);

  doc.fontSize(11).fillColor(BLUE).text(`Band: ${data.bandLabel || data.band || "N/A"}`);
  doc.moveDown(0.3);

  if (data.irs !== undefined) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Immediate Recall Score (IRS): ${data.irs}/${data.totalWordsA || 10} (${Math.round(data.irsPercent || 0)}%)`);
  }
  if (data.drs !== undefined) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Recognition Score (DRS): ${data.drs} hits (${Math.round(data.drsPercent || 0)}%)`);
  }
  if (data.recognition) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Discriminability: ${data.recognition.discriminability?.toFixed(2) || "N/A"}`);
  }
  if (data.falseAlarmRate !== undefined) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`False Alarm Rate: ${Math.round(data.falseAlarmRate)}% — ${data.faLevel || ""}`);
  }
  if (data.diagnosticPatternLabel) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Diagnostic Pattern: ${data.diagnosticPatternLabel}`);
  }
  doc.moveDown(0.5);

  if (data.skillBreakdown?.length) {
    subsectionHeader(doc, "Skill Breakdown");
    for (const skill of data.skillBreakdown) {
      doc.fontSize(10).fillColor(GRAY)
        .text(`${skill.code} (${skill.skill}): ${skill.observation}`);
    }
    doc.moveDown(0.3);
  }

  if (data.teacherSummary) {
    subsectionHeader(doc, "Teacher Diagnostic");
    doc.fontSize(10).fillColor(GRAY).text(data.teacherSummary);
    doc.moveDown(0.3);
  }

  if (data.parentSummary) {
    subsectionHeader(doc, "Parent Guidance");
    doc.fontSize(10).fillColor(GRAY).text(data.parentSummary);
    doc.moveDown(0.3);
  }

  if (data.redFlags?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Red Flags");
    bulletList(doc, data.redFlags, RED);
  }

  if (data.intervention) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Recommended Intervention");
    doc.fontSize(10).fillColor(GRAY).text(data.intervention);
  }
}

function renderModule1D(doc: PDFKit.PDFDocument, data: any) {
  doc.addPage();
  sectionHeader(doc, "Module 1D: Task Attention");

  scoreBar(doc, "Attention Index", Math.round(data.attentionIndex || 0), 100);

  doc.fontSize(11).fillColor(BLUE).text(`Band: ${data.bandLabel || data.band || "N/A"}`);
  doc.moveDown(0.3);

  if (data.ass !== undefined) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Attention Stability Score (ASS): ${Math.round(data.ass)}`);
  }
  if (data.hitRate !== undefined) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Hit Rate: ${(data.hitRate * 100).toFixed(0)}% | Miss Rate: ${(data.missRate * 100).toFixed(0)}% | False Alarm Rate: ${(data.falseAlarmRate * 100).toFixed(0)}%`);
  }
  if (data.variationLevelLabel) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Variation Level: ${data.variationLevelLabel}`);
  }
  if (data.diagnosticPatternLabel) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Diagnostic Pattern: ${data.diagnosticPatternLabel}`);
  }
  doc.moveDown(0.5);

  if (data.fatigueAnalysis?.available) {
    subsectionHeader(doc, "Fatigue Analysis");
    doc.fontSize(10).fillColor(GRAY)
      .text(`First Half Accuracy: ${(data.fatigueAnalysis.firstHalfAccuracy * 100).toFixed(0)}%`);
    doc.fontSize(10).fillColor(GRAY)
      .text(`Second Half Accuracy: ${(data.fatigueAnalysis.secondHalfAccuracy * 100).toFixed(0)}%`);
    doc.fontSize(10).fillColor(data.fatigueAnalysis.declineDetected ? RED : GREEN)
      .text(data.fatigueAnalysis.declineDetected
        ? `Decline detected: ${data.fatigueAnalysis.declinePercent?.toFixed(0)}% drop`
        : "No significant fatigue decline detected");
    doc.moveDown(0.3);
  }

  if (data.skillBreakdown?.length) {
    subsectionHeader(doc, "Skill Breakdown");
    for (const skill of data.skillBreakdown) {
      doc.fontSize(10).fillColor(GRAY)
        .text(`${skill.code} (${skill.skill}): ${skill.observation}`);
    }
    doc.moveDown(0.3);
  }

  if (data.teacherSummary) {
    subsectionHeader(doc, "Teacher Diagnostic");
    doc.fontSize(10).fillColor(GRAY).text(data.teacherSummary);
    doc.moveDown(0.3);
  }

  if (data.parentSummary) {
    subsectionHeader(doc, "Parent Guidance");
    doc.fontSize(10).fillColor(GRAY).text(data.parentSummary);
    doc.moveDown(0.3);
  }

  if (data.redFlags?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Red Flags");
    bulletList(doc, data.redFlags, RED);
  }

  if (data.intervention) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Recommended Intervention");
    doc.fontSize(10).fillColor(GRAY).text(data.intervention);
  }
}

function renderModule1E(doc: PDFKit.PDFDocument, data: any) {
  doc.addPage();
  sectionHeader(doc, "Module 1E: Learning Strategy");

  const ciScore = (data.consistency?.ci || 0) * 20;
  scoreBar(doc, "Consistency Index Score", Math.round(ciScore), 100);

  if (data.preference) {
    doc.fontSize(11).fillColor(BLUE)
      .text(`Primary Strategy: ${data.preference.primary || "Mixed"}`);
    if (data.preference.secondary && data.preference.secondary !== "None") {
      doc.fontSize(10).fillColor(GRAY)
        .text(`Secondary Strategy: ${data.preference.secondary}`);
    }
    doc.fontSize(10).fillColor(GRAY)
      .text(`Pattern: ${data.preference.pattern || "N/A"}`);
    doc.fontSize(10).fillColor(GRAY)
      .text(`Visual: ${data.preference.visual}/4 | Reading: ${data.preference.reading}/4 | Practice: ${data.preference.practice}/4`);
  }
  doc.moveDown(0.3);

  if (data.consistency) {
    subsectionHeader(doc, "Consistency");
    doc.fontSize(10).fillColor(GRAY)
      .text(`Consistency Index: ${data.consistency.ci}/5 — ${data.consistency.level || ""}`);
    doc.moveDown(0.3);
  }

  if (data.adaptability) {
    subsectionHeader(doc, "Adaptability");
    doc.fontSize(10).fillColor(GRAY)
      .text(`Score: ${data.adaptability.score}/2 — ${data.adaptability.level || ""}`);
    doc.fontSize(10).fillColor(GRAY)
      .text(`Strategy switching: ${data.adaptability.switched ? "Yes" : "No"}`);
    doc.moveDown(0.3);
  }

  if (data.combinedPatternLabel) {
    doc.fontSize(10).fillColor(GRAY)
      .text(`Combined Pattern: ${data.combinedPatternLabel}`);
    doc.moveDown(0.3);
  }

  if (data.teacherSummary) {
    subsectionHeader(doc, "Teacher Diagnostic");
    doc.fontSize(10).fillColor(GRAY).text(data.teacherSummary);
    doc.moveDown(0.3);
  }

  if (data.parentSummary) {
    subsectionHeader(doc, "Parent Guidance");
    doc.fontSize(10).fillColor(GRAY).text(data.parentSummary);
    doc.moveDown(0.3);
  }

  if (data.studyTips?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Study Tips");
    bulletList(doc, data.studyTips, GREEN);
  }

  if (data.interventions?.length) {
    checkPageSpace(doc);
    subsectionHeader(doc, "Interventions");
    for (const intv of data.interventions) {
      doc.fontSize(10).fillColor(GRAY).text(`Strategy: ${intv.strategy}`);
      bulletList(doc, intv.actions || []);
    }
  }
}

// ─── Summary & Recommendations Builder ───

function buildSummaryAndRecommendations(scores: Record<string, any>): {
  summary: string;
  recommendations: string[];
} {
  const parts: string[] = [];
  const recommendations: string[] = [];

  if (scores["1A"]) {
    const d = scores["1A"];
    parts.push(
      `Learning Efficiency: ${d.bandLabel || d.band || "N/A"} (${Math.round(d.lesPercent || 0)}%). ${d.parentSummary || ""}`
    );
    if (d.intervention) recommendations.push(d.intervention);
  }

  if (scores["1B"]) {
    const d = scores["1B"];
    parts.push(
      `Conceptual Understanding: ${d.bandLabel || d.band || "N/A"} (${Math.round(d.cuPercent || 0)}%). ${d.parentSummary || ""}`
    );
    if (d.intervention) recommendations.push(d.intervention);
  }

  if (scores["1C"]) {
    const d = scores["1C"];
    parts.push(
      `Memory Effectiveness: ${d.bandLabel || d.band || "N/A"} (${Math.round(d.memPercent || 0)}%). ${d.parentSummary || ""}`
    );
    if (d.intervention) recommendations.push(d.intervention);
  }

  if (scores["1D"]) {
    const d = scores["1D"];
    parts.push(
      `Task Attention: ${d.bandLabel || d.band || "N/A"} (${Math.round(d.attentionIndex || 0)}%). ${d.parentSummary || ""}`
    );
    if (d.intervention) recommendations.push(d.intervention);
  }

  if (scores["1E"]) {
    const d = scores["1E"];
    const ciPct = Math.round((d.consistency?.ci || 0) * 20);
    parts.push(
      `Learning Strategy: ${d.combinedPatternLabel || "N/A"} (CI: ${ciPct}%). ${d.parentSummary || ""}`
    );
    if (d.studyTips?.length) {
      recommendations.push(...d.studyTips);
    }
    if (d.interventions?.length) {
      for (const intv of d.interventions) {
        if (intv.actions?.length) recommendations.push(...intv.actions);
      }
    }
  }

  const summary = parts.join("\n\n");

  return { summary, recommendations };
}

// ─── PDF Generation ───

function generatePDF(
  reportRow: any,
  scores: Record<string, any>,
  summaryText: string,
  recommendations: string[],
  outputPath: string,
  timingData?: { totalTimeSec: number; timePerQuestion: Record<string, number>; questionCount: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // ─── Cover Page ───
    doc.moveDown(6);
    doc.fontSize(28).fillColor(BLUE).text("ExamReadiness Index™", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(16).fillColor(GRAY).text("LBI Assessment Report", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12).fillColor(GRAY);
    if (reportRow.studentName) doc.text(`Student: ${reportRow.studentName}`, { align: "center" });
    if (reportRow.board) doc.text(`Board: ${reportRow.board}`, { align: "center" });
    if (reportRow.grade) doc.text(`Grade: ${reportRow.grade}`, { align: "center" });
    if (reportRow.ageBand) doc.text(`Age Band: ${reportRow.ageBand}`, { align: "center" });
    doc.moveDown(0.5);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, { align: "center" });
    if (timingData && timingData.totalTimeSec > 0) {
      doc.text(`Time Taken: ${formatDuration(timingData.totalTimeSec)}`, { align: "center" });
    }
    doc.moveDown(3);
    doc.fontSize(10).fillColor(GRAY)
      .text("Generated by Metryx One | Confidential", { align: "center" });

    // ─── Overall Score Page ───
    doc.addPage();
    sectionHeader(doc, "Overall Readiness Score");
    drawOverallScore(
      doc,
      reportRow.overallScore || 0,
      reportRow.readinessLevel || "Needs Attention"
    );

    // ─── Summary Page ───
    doc.moveDown(1);
    sectionHeader(doc, "Summary");
    doc.fontSize(10).fillColor(GRAY).text(summaryText, {
      lineGap: 4,
    });

    // ─── Time Analysis ───
    if (timingData) {
      doc.addPage();
      renderTimeAnalysis(doc, timingData.totalTimeSec, timingData.timePerQuestion, timingData.questionCount);
    }

    // ─── Module Sections ───
    if (scores["1A"]) renderModule1A(doc, scores["1A"]);
    if (scores["1B"]) renderModule1B(doc, scores["1B"]);
    if (scores["1C"]) renderModule1C(doc, scores["1C"]);
    if (scores["1D"]) renderModule1D(doc, scores["1D"]);
    if (scores["1E"]) renderModule1E(doc, scores["1E"]);

    // ─── Recommendations Page ───
    if (recommendations.length) {
      doc.addPage();
      sectionHeader(doc, "Recommendations");
      recommendations.forEach((rec, i) => {
        checkPageSpace(doc, 40);
        doc.fontSize(10).fillColor(GRAY).text(`${i + 1}. ${rec}`, { indent: 5 });
        doc.moveDown(0.3);
      });
    }

    // ─── Footer on last page ───
    doc.moveDown(2);
    doc.fontSize(8).fillColor(GRAY)
      .text(
        "CONFIDENTIALITY NOTICE: This report contains sensitive assessment data. " +
        "It is intended solely for the student, their parents/guardians, and authorized educators. " +
        "Do not share or distribute without consent.",
        { align: "center" }
      );

    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// ─── Main Export ───

export async function generateReportAsync(attemptId: string): Promise<void> {
  try {
    // 1. Read report row
    const [row] = await db
      .select()
      .from(examReadyReports)
      .where(eq(examReadyReports.attemptId, attemptId))
      .limit(1);

    if (!row) {
      console.error(`[reportGenerator] No exam_ready_reports row for attemptId=${attemptId}`);
      return;
    }

    // Update progress
    await db
      .update(examReadyReports)
      .set({ progress: 25, updatedAt: new Date() })
      .where(eq(examReadyReports.attemptId, attemptId));

    // 2. Parse score data
    let scores: Record<string, any> = {};
    try {
      scores = typeof row.scoreData === "string" ? JSON.parse(row.scoreData || "{}") : (row.scoreData || {});
    } catch {
      throw new Error("Failed to parse scoreData JSON");
    }

    // 3. Build summary and recommendations
    const { summary, recommendations } = buildSummaryAndRecommendations(scores);

    // 3b. Fetch timing data from attempts table
    let timingData: { totalTimeSec: number; timePerQuestion: Record<string, number>; questionCount: number } | undefined;
    try {
      const [attemptRow] = await db
        .select()
        .from(examReadyAttempts)
        .where(eq(examReadyAttempts.id, attemptId))
        .limit(1);

      if (attemptRow) {
        const timePerQuestion: Record<string, number> = typeof attemptRow.timePerQuestion === "string"
          ? JSON.parse(attemptRow.timePerQuestion || "{}")
          : (attemptRow.timePerQuestion || {}) as Record<string, number>;
        const totalTimeSec = Math.round(
          (new Date(String(attemptRow.updatedAt)).getTime() - new Date(String(attemptRow.createdAt)).getTime()) / 1000
        );
        const questionIds = attemptRow.questionIds || [];
        timingData = {
          totalTimeSec,
          timePerQuestion,
          questionCount: Array.isArray(questionIds) ? questionIds.length : 0,
        };
      }
    } catch (timingErr: any) {
      console.warn("[reportGenerator] Could not fetch timing data (non-fatal):", timingErr?.message);
    }

    await db
      .update(examReadyReports)
      .set({ progress: 50, updatedAt: new Date() })
      .where(eq(examReadyReports.attemptId, attemptId));

    // 4. Generate PDF
    const reportsDir = path.resolve(process.cwd(), "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const pdfFilename = `report_${attemptId}.pdf`;
    const pdfPath = path.join(reportsDir, pdfFilename);

    await generatePDF(row, scores, summary, recommendations, pdfPath, timingData);

    await db
      .update(examReadyReports)
      .set({ progress: 90, updatedAt: new Date() })
      .where(eq(examReadyReports.attemptId, attemptId));

    // 5. Update DB with results
    await db
      .update(examReadyReports)
      .set({
        status: 'ready',
        progress: 100,
        pdfPath,
        summary,
        recommendations: JSON.stringify(recommendations),
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(examReadyReports.attemptId, attemptId));

    // Fire Report Published notification (template 32) — non-blocking
    if (row.userId) {
      notifService.fire(32, { reportType: 'Exam Readiness', testName: attemptId }, { recipientId: String(row.userId) }).catch(e =>
        console.warn('[reportGenerator] Report notification failed (non-fatal):', e)
      );
    }

    console.log(`[reportGenerator] PDF ready: ${pdfPath}`);
  } catch (err: any) {
    console.error(`[reportGenerator] ERROR for attemptId=${attemptId}:`, err);

    try {
      await db
        .update(examReadyReports)
        .set({
          status: 'error',
          error: err?.message || String(err),
          updatedAt: new Date(),
        })
        .where(eq(examReadyReports.attemptId, attemptId));
    } catch {
      // Silently ignore error during error update
    }
  }
}
