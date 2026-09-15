const mongoose = require("mongoose");
const { computeResult } = require("../utils/grading");

const marksSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: String, required: true }, // admissionNo (canonical student identity)
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    examName: { type: String, required: true },
    class: { type: String, required: true },
    section: { type: String, default: "" },
    session: { type: String, index: true }, // academic year label e.g. "2026-27"
    subject: { type: String, required: true },
    marksObtained: { type: Number, required: true },
    maxMarks: { type: Number, required: true },
    passingMarks: { type: Number, default: 33 },
    pct: { type: Number },
    grade: { type: String },
    passed: { type: Boolean },
    remarks: { type: String },
  },
  { timestamps: true }
);

marksSchema.index({ schoolId: 1, studentId: 1, examId: 1, subject: 1 }, { unique: true });
marksSchema.index({ schoolId: 1, examId: 1 });
marksSchema.index({ schoolId: 1, session: 1 });

// Derive grade/pct/passed from the snapshot so seeded rows, API rows and
// future re-scaled rows all stay consistent with the canonical grading util.
marksSchema.pre("save", function (next) {
  const passingMarks = this.passingMarks == null ? 33 : this.passingMarks;
  const result = computeResult(this.marksObtained, this.maxMarks, passingMarks);
  this.pct = +result.pct.toFixed(2);
  this.grade = result.grade;
  this.passed = result.passed;
  next();
});

module.exports = mongoose.model("Marks", marksSchema);