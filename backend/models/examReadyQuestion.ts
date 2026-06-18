import mongoose, { Schema } from "mongoose";

const OptionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    score: { type: Number, required: false }, // optional (likert / scoring)
  },
  { _id: false }
);

const ExamReadyQuestionSchema = new Schema(
  {
    product: { type: String, default: "exam_ready", index: true },

    // ✅ REQUIRED: your API filters by these in pickQuestionsStratified()
    planId: { type: String, index: true },     // "mini" | "exam-ready"
    board: { type: String, index: true },      // "CBSE"
    grade: { type: String, index: true },      // "10"

    // ✅ ADD: used for selecting questions by domain/subdomain
    module: { type: String, index: true },     // e.g. "COMPETITIVE EXAM READINESS"
    submodule: { type: String, index: true },  // e.g. "CONSISTENCY"

    // ✅ ADD: optional but server often expects it
    variant: { type: String, default: "default", index: true },

    type: { type: String, index: true },       // "mcq" | "likert"
    stem: { type: String, required: true },
    category: { type: String, index: true },

    // ✅ ADD: optional psychometric metadata (route can filter/score)
    reverseScored: { type: Boolean, default: false },
    weight: { type: Number, default: 1 },
    tags: { type: [String], default: [] },

    content: {
      options: { type: [OptionSchema], default: [] },
      correct: { type: [String], default: [] },     // optional for MCQ scoring
      explanation: { type: String, default: "" },
      scale: { type: [Number], default: [] },       // optional for likert

      // ✅ ADD: allow storing any extra metadata without schema breaking
      meta: { type: Schema.Types.Mixed, default: {} },
    },

    difficulty: { type: Number, default: 2 },
    status: { type: String, default: "active", index: true },
  },
  { timestamps: true }
);

// ✅ Better compound index for fast filtering
ExamReadyQuestionSchema.index({
  product: 1,
  planId: 1,
  board: 1,
  grade: 1,
  module: 1,
  submodule: 1,
  variant: 1,
  status: 1,
  type: 1,
});

export const ExamReadyQuestion =
  mongoose.models.ExamReadyQuestion ||
  mongoose.model("ExamReadyQuestion", ExamReadyQuestionSchema);
