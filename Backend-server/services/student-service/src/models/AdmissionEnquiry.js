const mongoose = require("mongoose");
const {
  FEE_CATEGORIES,
  DEFAULT_FEE_CATEGORY,
} = require("@school-erp/shared/src/constants/feeCategories");

const enquirySchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus the enquiry was received at.
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    childName: { type: String, required: true, trim: true, minlength: 2 },
    parentName: { type: String, required: true, trim: true, minlength: 2 },
    classApplied: { type: String, required: true, trim: true },
    contact: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      match: /^[+]?[0-9\s-]{10,15}$/,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    // Admission ID assigned when the enquiry is confirmed/admitted. Links the
    // enquiry to the Platform Student User / Student Profile addressing the
    // same Admission ID (never auto-creates a duplicate student).
    admissionNo: { type: String, default: null },
    section: { type: String, default: null },
    // Social category captured at enquiry time so a category-wide fee
    // concession rule ("SC -> 5%") can find the student the moment the
    // admission is confirmed, rather than waiting for onboarding to fill it in.
    feeCategory: { type: String, enum: FEE_CATEGORIES, default: DEFAULT_FEE_CATEGORY },
    source: { type: String, enum: ["Website", "Referral", "Walk-in", "Phone", "Other"], default: "Other" },
    status: {
      type: String,
      enum: ["New", "Contacted", "Campus Visit Scheduled", "Admitted", "Rejected"],
      default: "New",
    },
    followUpDate: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdmissionEnquiry", enquirySchema);
