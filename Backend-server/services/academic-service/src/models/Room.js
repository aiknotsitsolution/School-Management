const mongoose = require("mongoose");
const { mkKey } = require("../utils/normalize");

const roomSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus the room is at — two branches can each have a "Lab 1".
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.pre("validate", function (next) {
  this.key = mkKey(this.name);
  next();
});

// branchId in the key: "Lab 1" is per campus. Drop the old `{ schoolId, key }`
// index first on an existing deployment — see scripts/backfill-branches.js.
roomSchema.index({ schoolId: 1, branchId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Room", roomSchema);