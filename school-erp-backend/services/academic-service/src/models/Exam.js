const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examName: { type: String, required: true }, // e.g. "Term 2 - Mid Term"
    class: { type: String, required: true },
    subject: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String },
    endTime: { type: String },
    room: { type: String },
    maxMarks: { type: Number, required: true },
    passingMarks: { type: Number, default: 33 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);
