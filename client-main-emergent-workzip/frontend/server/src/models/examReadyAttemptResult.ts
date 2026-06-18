import mongoose, { Schema } from "mongoose";

const ExamReadyAttemptResultSchema = new Schema(
  {
    // ─── Attempt identification ───
    attemptId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    childId: { type: String, index: true },
    studentName: { type: String },

    // ─── Plan & config ───
    planId: { type: String, required: true },
    patternType: { type: String, default: "lbi" },
    domainCode: { type: String },
    subdomainCode: { type: String },
    ageBand: { type: String },
    board: { type: String },
    grade: { type: String },

    // ─── Questions & answers ───
    questionIds: { type: [String], default: [] },
    answers: { type: Schema.Types.Mixed, default: {} },         // { questionId: answer }
    totalQuestions: { type: Number, default: 0 },
    answeredCount: { type: Number, default: 0 },

    // ─── Timing ───
    timePerQuestion: { type: Schema.Types.Mixed, default: {} }, // { questionId: seconds }
    totalTimeTakenSeconds: { type: Number, default: 0 },        // total exam duration in seconds
    startedAt: { type: Date },
    submittedAt: { type: Date },

    // ─── Scores ───
    subdomainScores: { type: Schema.Types.Mixed, default: {} }, // raw scoring results
    overallScore: { type: Number, default: 0 },
    readinessLevel: { type: String },                           // "High" | "Moderate" | "Needs Attention"
    moduleScores: [
      {
        module: String,   // "1A", "1B", etc.
        label: String,    // "Learning Efficiency", etc.
        percent: Number,
        band: String,
      },
    ],

    // ─── Status ───
    status: { type: String, default: "submitted", index: true },
  },
  { timestamps: true, strict: false }
);

export const ExamReadyAttemptResult =
  mongoose.models.ExamReadyAttemptResult ||
  mongoose.model("ExamReadyAttemptResult", ExamReadyAttemptResultSchema);
