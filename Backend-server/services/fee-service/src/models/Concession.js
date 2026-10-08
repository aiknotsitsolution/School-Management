const mongoose = require("mongoose");
const { FEE_CATEGORIES } = require("@school-erp/shared/src/constants/feeCategories");

// Fee concessions — sibling discounts, scholarships and manual grants
// (CLIENT-REQ-045/046/047). Lifecycle: created as "Requested", an accountant
// or school admin approves it to "Active" (or rejects it). Only Active rows
// are applied at invoice-generation time; the invoice stores the computed
// concession amount, so later edits/deletes never rewrite money already
// billed.
//
// Two grant modes:
//   student  — addressed to one admissionNo (scholarship, sibling, manual)
//   category — a rule addressed to every student whose `feeCategory` matches
//              (e.g. "SC -> 5% Tuition"), so a statutory quota does not have
//              to be granted student by student
const concessionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus the concession was granted at.
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    // Which grant mode this row is. `category` rows address a whole category
    // and therefore carry no studentId.
    appliesTo: { type: String, enum: ["student", "category"], default: "student" },
    // Student mode: the admissionNo this concession belongs to.
    studentId: { type: String, default: null },
    // Category mode: which FEE_CATEGORIES row this rule targets.
    category: { type: String, enum: ["", ...FEE_CATEGORIES], default: "" },
    kind: {
      type: String,
      // RTE and the statutory SC / ST entitlements (government-backed quotas)
      // rank above the discretionary Sibling/Scholarship/Manual grants. SC and
      // ST are listed separately so a quota rule can name the community it
      // actually applies to.
      enum: ["Sibling", "Scholarship", "Manual", "RTE", "SC", "ST"],
      required: true,
    },
    // The Kind IS the name — the form no longer collects a free-text name, and
    // createConcession defaults this to `kind` when a caller omits it.
    name: { type: String, required: true },
    type: { type: String, enum: ["percent", "flat"], required: true },
    value: { type: Number, required: true, min: 0 },
    session: { type: String, required: true },
    // Empty / absent = applies to every fee type in the session.
    feeType: { type: String, default: "" },
    status: { type: String, enum: ["Requested", "Active", "Rejected"], default: "Requested" },
    siblingOf: { type: String, default: null }, // Sibling: elder sibling admissionNo
    notes: { type: String, default: "" },
    requestedBy: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectedBy: { type: String },
    rejectedReason: { type: String },
  },
  { timestamps: true }
);

// Lookup path for the generation-time netting query (dupes are enforced in
// the controller so a Rejected row does not block a re-request).
concessionSchema.index({ schoolId: 1, branchId: 1, studentId: 1, session: 1, status: 1 });
// Category-rule lookup: resolve every Active rule for a set of categories in
// one query during generation.
concessionSchema.index({ schoolId: 1, appliesTo: 1, category: 1, session: 1, status: 1 });

module.exports = mongoose.model("Concession", concessionSchema);
