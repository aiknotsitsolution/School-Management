const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    subject: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    assignedBy: { type: String },
    assignedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    attachments: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Homework", homeworkSchema);
