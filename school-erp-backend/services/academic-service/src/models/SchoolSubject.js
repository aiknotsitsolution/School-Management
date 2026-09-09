const mongoose = require("mongoose");
const { mkKey } = require("../utils/normalize");

// Dual-scope subject master.
//
//   scope = "global"        -> platform-level reusable subject (schoolId/tenantId null)
//   scope = "tenant"        -> a school/tenant-specific subject (schoolId set)
//
// The Exam schedule flow surfaces BOTH global + tenant subjects in one dropdown,
// but tenant isolation is enforced by the controller (never exposes another
// school's tenant-scoped subjects).
const schoolSubjectSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ["global", "tenant"], required: true, index: true },
    // Tenant-scoped subjects set schoolId; global subjects leave it null.
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null, index: true },
    // "" = school-wide subject; otherwise the class code (e.g. "11-Sci") the
    // subject is scoped to. Preserves class-subject relationships where used.
    className: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    // normalizedName = lowercase(trim(collapseWhitespace(name))) — the logical
    // uniqueness key within its scope.
    normalizedName: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    description: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

schoolSubjectSchema.pre("validate", function (next) {
  if (this.name) {
    this.normalizedName = String(this.name)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }
  if (this.scope === "global") {
    this.schoolId = null;
    this.tenantId = null;
  }
  next();
});

// Unique tenant-scoped name (schoolId + className + normalizedName).
schoolSubjectSchema.index(
  { scope: 1, schoolId: 1, className: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { scope: "tenant" } }
);
// Unique global name (case-insensitive).
schoolSubjectSchema.index(
  { scope: 1, normalizedName: 1 },
  { unique: true, partialFilterExpression: { scope: "global" } }
);

module.exports = mongoose.model("SchoolSubject", schoolSubjectSchema);