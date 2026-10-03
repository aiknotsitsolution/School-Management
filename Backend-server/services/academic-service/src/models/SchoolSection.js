const mongoose = require("mongoose");
const { mkKey } = require("../utils/normalize");

const schoolSectionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus this section belongs to (see SchoolClass.branchId).
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    className: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

schoolSectionSchema.pre("validate", function (next) {
  this.key = mkKey(this.name);
  next();
});

// branchId in the key so "Section A" can exist once per campus. Requires
// dropping the old `{ schoolId, className, key }` index first — see
// scripts/backfill-branches.js.
schoolSectionSchema.index(
  { schoolId: 1, branchId: 1, className: 1, key: 1 },
  { unique: true }
);

module.exports = mongoose.model("SchoolSection", schoolSectionSchema);