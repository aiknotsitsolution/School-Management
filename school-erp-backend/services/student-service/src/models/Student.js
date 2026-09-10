const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    admissionNo: { type: String, required: true },
    userId: { type: String, default: null }, // link to auth-service User._id
    name: { type: String, required: true },
    dob: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    // Required for a full profile but left optional so a platform-created
    // shell/draft (see auth-service student linking) can exist until an
    // Admission Counsellor completes it.
    class: { type: String },
    section: { type: String },
    rollNo: { type: String },
    bloodGroup: { type: String },
    address: { type: String },
    photoUrl: { type: String },
    parentName: { type: String },
    parentContact: { type: String },
    parentEmail: { type: String },
    motherName: { type: String },
    house: { type: String },
    admissionDate: { type: Date, default: Date.now },
    feeCategory: { type: String, default: "Regular" },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Alumni", "Transferred"],
      default: "Active",
    },
    // Profile-completion lifecycle, kept separate from lifecycle `status`.
    profileStatus: {
      type: String,
      enum: ["incomplete", "complete"],
      default: "incomplete",
    },
    profileCompletedAt: { type: Date, default: null },
    // School-issued student ID card lifecycle (issued by school admin after
    // the student has been onboarded - profileStatus complete).
    idCardNumber: { type: String, default: "" },
    idCardIssuedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

studentSchema.index({ schoolId: 1, admissionNo: 1 }, { unique: true });
studentSchema.index({ schoolId: 1, profileStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Student", studentSchema);
