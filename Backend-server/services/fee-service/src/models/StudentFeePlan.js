const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Student fee plan — the admission-time fee package for one student/session.
//
// This is deliberately NOT derived from invoices: invoices are what got billed
// (bulk generated, one per head per session), while the plan is what the school
// AGREED to charge the student for the year. It is created from the class fee
// structure when the student is onboarded and edited by the office afterwards
// (transport opt-in, sibling terms, one-off waivers shown as heads).
//
// annualAmount is entered directly (a year's figure, e.g. Tuition 18000);
// `frequency` is only the display label carried over from the class structure.
// ---------------------------------------------------------------------------

const feePlanHeadSchema = new mongoose.Schema(
  {
    feeType: { type: String, required: true },
    annualAmount: { type: Number, required: true, min: 0 },
    // Informational label from the class structure (Monthly/Quarterly/…).
    frequency: { type: String, default: "Annually" },
    dueDate: { type: Date },
    active: { type: Boolean, default: true },
    note: { type: String },
  },
  { _id: false },
);

const studentFeePlanSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus the student belongs to — joins the unique key so two branches may
    // package the same admission number differently (transfers/re-admissions).
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    // Students are keyed by admission number everywhere in the fee domain.
    studentId: { type: String, required: true },
    session: { type: String, required: true }, // e.g. "2026-27"
    class: { type: String },
    heads: { type: [feePlanHeadSchema], default: [] },
    // Sum of active heads — recomputed on every validate so it can never drift.
    totalAnnual: { type: Number, default: 0 },
    source: { type: String, enum: ["onboarding", "manual"], default: "manual" },
    status: { type: String, enum: ["Draft", "Active"], default: "Active" },
    notes: { type: String },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true },
);

// One package per student per session (office edits replace it in place).
studentFeePlanSchema.index(
  { schoolId: 1, studentId: 1, session: 1 },
  { unique: true },
);

studentFeePlanSchema.pre("validate", function recomputeTotal(next) {
  this.totalAnnual = (this.heads || [])
    .filter((head) => head.active !== false)
    .reduce((sum, head) => sum + Number(head.annualAmount || 0), 0);
  next();
});

module.exports = mongoose.model("StudentFeePlan", studentFeePlanSchema);
