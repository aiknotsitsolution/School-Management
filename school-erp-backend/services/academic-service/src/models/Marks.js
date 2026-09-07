const mongoose = require("mongoose");

const marksSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: String, required: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    examName: { type: String, required: true },
    class: { type: String, required: true },
    subject: { type: String, required: true },
    marksObtained: { type: Number, required: true },
    maxMarks: { type: Number, required: true },
    grade: { type: String },
    remarks: { type: String },
  },
  { timestamps: true }
);

marksSchema.index({ schoolId: 1, studentId: 1, examId: 1, subject: 1 }, { unique: true });

marksSchema.pre("save", function (next) {
  const pct = (this.marksObtained / this.maxMarks) * 100;
  this.grade = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : pct >= 50 ? "C" : pct >= 33 ? "D" : "F";
  next();
});

module.exports = mongoose.model("Marks", marksSchema);
