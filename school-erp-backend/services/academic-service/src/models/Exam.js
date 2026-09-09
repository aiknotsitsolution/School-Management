const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    examName: { type: String, required: true }, // e.g. "Term 2 - Mid Term"
    class: { type: String, required: true },
    section: { type: String, default: "" },
    subject: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String },
    endTime: { type: String },
    room: { type: String },
    maxMarks: { type: Number, required: true },
    passingMarks: { type: Number, default: 33 },
    // Optional references to the master entities that produced the snapshot
    // strings above. Keeps the subject/exam-type/etc. reusable across modules.
    examTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "ExamType", default: null },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolClass", default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolSection", default: null },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "SchoolSubject", default: null },
    timeSlotId: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot", default: null },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Exam", examSchema);
