const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, default: "General" },
    pinned: { type: Boolean, default: false },
    audience: [
      {
        type: String,
        // "class_teacher" is retained only as a legacy value for documents
        // written before the role collapse; new audiences use "teacher".
        enum: ["school_admin", "class_teacher", "teacher", "staff", "student", "all"],
        default: "all",
      },
    ],
    postedBy: { type: String },
    attachments: [{ type: String }],
    expiryDate: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Notice", noticeSchema);
