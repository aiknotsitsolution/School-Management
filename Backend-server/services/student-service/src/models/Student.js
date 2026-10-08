const mongoose = require("mongoose");
const {
  FEE_CATEGORIES,
  DEFAULT_FEE_CATEGORY,
} = require("@school-erp/shared/src/constants/feeCategories");

const studentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus the student is enrolled at. This is the anchor for everything else:
    // their attendance, fees, report cards and bus route all resolve through
    // the student, so a branch roster is just a filter on this field. null =
    // school-wide (single-campus default, and rows predating branch scoping).
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
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
    medium: { type: String, enum: ["English", "Hindi"], default: "English" },
    admissionDate: { type: Date, default: Date.now },
    // Social category of the student, captured on the admission enquiry and
    // carried through onboarding. Category-wide fee concession rules are
    // expressed against these values.
    feeCategory: { type: String, enum: FEE_CATEGORIES, default: DEFAULT_FEE_CATEGORY },
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
    // Soft-delete marker (Phase 2). Deleting a student never hard-removes the
    // row immediately: lists/stats exclude it, and a purge job hard-deletes it
    // (plus owned health/document data) after the retention window. A null
    // deletedAt also keeps the admissionNo unique-slot free for reuse only
    // while the record exists — see the partial index below.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One active student per Admission ID per school. The index is PARTIAL over
// non-deleted rows only, so a soft-deleted student's admissionNo can be
// re-issued to a new admission without a manual cleanup.
studentSchema.index(
  { schoolId: 1, admissionNo: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $exists: false } } },
);
studentSchema.index({ schoolId: 1, profileStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Student", studentSchema);
