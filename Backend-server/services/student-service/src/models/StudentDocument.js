const mongoose = require("mongoose");

const studentDocumentSchema = new mongoose.Schema(
  {
    // Campus this record belongs to. null = school-wide, or a row
    // that predates branch scoping.
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: String, required: true, index: true }, // admissionNo (refId)
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      enum: ["academic", "identity", "health", "transfer", "other"],
      default: "other",
    },
    fileName: { type: String, required: true },
    mimeType: { type: String },
    fileSize: { type: Number },
    url: { type: String, required: true },
    fileId: { type: String },
    uploadedBy: { type: String },
    uploadedRole: { type: String },
  },
  { timestamps: true }
);

studentDocumentSchema.index({ schoolId: 1, branchId: 1, createdAt: -1 });

studentDocumentSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model("StudentDocument", studentDocumentSchema);