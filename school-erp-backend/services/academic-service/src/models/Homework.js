const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    assignType: { type: String, enum: ["student", "staff"], default: "student" },
    class: { type: String },
    section: { type: String },
    subject: { type: String },
    title: { type: String, required: true },
    description: { type: String },
    assignedTo: { type: String },
    assignedToRole: { type: String },
    priority: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    assignedBy: { type: String },
    assignedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    maxMarks: { type: Number, default: 10 },
    attachments: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Homework", homeworkSchema);
