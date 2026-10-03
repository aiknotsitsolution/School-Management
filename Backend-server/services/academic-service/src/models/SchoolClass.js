const mongoose = require("mongoose");
const { mkKey } = require("../utils/normalize");

const schoolClassSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus this class runs at. Two branches may each run their own "Grade 10",
    // so the uniqueness key includes the branch. null = school-wide (the
    // single-campus default, and every row created before branch scoping).
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

schoolClassSchema.pre("validate", function (next) {
  this.key = mkKey(this.name);
  next();
});

// branchId is part of the key so each campus can define its own Grade 10.
// Migrating an existing deployment: drop the old `{ schoolId, key }` index
// first (see scripts/backfill-branches.js) or the school-wide index keeps
// rejecting a second branch's classes.
schoolClassSchema.index({ schoolId: 1, branchId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("SchoolClass", schoolClassSchema);