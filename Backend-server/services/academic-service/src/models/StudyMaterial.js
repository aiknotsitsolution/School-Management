const mongoose = require("mongoose");

const studyMaterialSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus the material is published to.
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    class: { type: String, required: true, trim: true },
    section: { type: String, default: null, trim: true },
    // `ebook` marks a readable PDF/book uploaded for in-app reading (Library).
    type: { type: String, enum: ["notes", "worksheet", "video", "link", "ebook", "other"], default: "notes" },
    fileUrl: { type: String, default: null },
    linkUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    // Page count of an uploaded PDF — read client-side at upload time so the
    // reader can show "12 / 24" without fetching the whole document first.
    pageCount: { type: Number, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    uploadedByName: { type: String, default: "" },
  },
  { timestamps: true }
);

studyMaterialSchema.index({ schoolId: 1, branchId: 1, class: 1, subject: 1 });

module.exports = mongoose.model("StudyMaterial", studyMaterialSchema);
