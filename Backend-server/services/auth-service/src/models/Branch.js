const mongoose = require("mongoose");

// A branch is a physical campus / location of a school. One school has at
// least one branch (the head office); `Plan.limits.branches` caps how many a
// tenant may create (null = unlimited, matching the Plan convention).
//
// Branch is owned by auth-service (like School) because auth-service is the only
// service that holds the school, plan and subscription records needed to enforce
// the limit. Other services do NOT keep a Branch copy — they store the plain
// `branchId` ObjectId on their own documents and scope queries by it, so no
// cross-database replication is needed.
const branchSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    // Short machine key used by imports/exports and the switcher. Unique per
    // school (not globally) so two schools can both have a "main" campus.
    code: { type: String, required: true, lowercase: true, trim: true },
    shortName: { type: String, trim: true },
    // Contact block — a branch often has its own front office.
    contactName: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    country: { type: String, default: "India" },
    // Exactly one branch per school is the head office: it is the fallback
    // branch for records that predate branch scoping and the default landing
    // branch for a school admin with no explicit assignment.
    isHeadOffice: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    settings: { type: Object, default: {} },
  },
  { timestamps: true }
);

branchSchema.index({ schoolId: 1, code: 1 }, { unique: true });
branchSchema.index({ schoolId: 1, isDeleted: 1, isActive: 1 });
branchSchema.index({ schoolId: 1, isHeadOffice: 1 });

module.exports = mongoose.model("Branch", branchSchema);
