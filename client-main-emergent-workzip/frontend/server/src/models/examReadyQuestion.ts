import mongoose, { Schema } from "mongoose";

const OptionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    score: { type: Number, required: false },
    tag: { type: String },        // V, R, P for learning_strategy
    strategy: { type: String },   // "Visual Structuring", etc.
    label: { type: String },      // A, B, C
  },
  { _id: false }
);

const SourceSchema = new Schema(
  {
    file: { type: String },
    sheet: { type: String },
    row: { type: Number },
  },
  { _id: false }
);

const ExamReadyQuestionSchema = new Schema(
  {
    // ─── Identification ───
    question_id: { type: String, index: true, unique: true, sparse: true },
    product: { type: String, default: "exam_ready", index: true },

    // ─── Domain / Category hierarchy ───
    domain_code: { type: String, index: true },
    domain_name: { type: String },
    subdomain_code: { type: String, index: true },
    subdomain_name: { type: String },

    // ─── Legacy module/submodule (exam-ready v1 compatibility) ───
    module: { type: String, index: true },
    submodule: { type: String, index: true },

    // ─── Segregation filters ───
    age_band: { type: String, index: true },           // A, B, C, D, E, E1
    planId: { type: String, index: true },              // "mini" | "exam-ready"
    board: { type: String, index: true },               // "CBSE"
    grade: { type: String, index: true },               // "10"
    variant: { type: String, default: "default", index: true },

    // ─── Question content ───
    question_type: { type: String, index: true, default: "likert" }, // likert, mcq, text, scenario
    statement: { type: String },                        // Question text (new format)
    stem: { type: String },                             // Question text (legacy format)
    options: { type: [OptionSchema], default: [] },
    passage_text: { type: String },

    // ─── Legacy content block (exam-ready v1) ───
    content: {
      options: { type: [OptionSchema], default: [] },
      correct: { type: [String], default: [] },
      explanation: { type: String, default: "" },
      scale: { type: [Number], default: [] },
      meta: { type: Schema.Types.Mixed, default: {} },
    },

    // ─── Scoring metadata ───
    correct_answer: { type: String },
    reverse_scoring: { type: Boolean, default: false },
    reverseScored: { type: Boolean, default: false },   // legacy alias
    weight: { type: Number, default: 1 },
    anchor: { type: String },                           // "Yes" / "No"
    selectivity: { type: Schema.Types.Mixed },
    difficulty: { type: Schema.Types.Mixed },

    // ─── Attention Click fields ───
    primary_target: { type: String },
    distractors_description: { type: String },
    target_type: { type: String },
    logic_type: { type: String },                       // single_target, dual_target, sequence, conditional, vigilance, ignore_distractor
    stimulus_type: { type: String },                    // letter, digit, symbol
    parsed_targets: { type: [String], default: [] },    // ["A"], ["A","E"], ["★"]
    predecessor: { type: String },                      // for sequence/conditional: the item that must come before/after

    // ─── Metadata ───
    category: { type: String, index: true },
    type: { type: String, index: true },                // legacy "mcq" | "likert"
    tags: { type: [String], default: [] },
    band: { type: Schema.Types.Mixed },
    bucket: { type: Schema.Types.Mixed },
    source: { type: SourceSchema },
    task_payload_json: { type: String },

    // ─── Status ───
    status: { type: String, default: "Active", index: true },
  },
  { timestamps: true, strict: false }
);

// Compound index for dynamic config discovery
ExamReadyQuestionSchema.index({
  domain_code: 1,
  subdomain_code: 1,
  age_band: 1,
  question_type: 1,
  status: 1,
});

// Legacy compound index
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
