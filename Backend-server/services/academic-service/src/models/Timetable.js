const mongoose = require("mongoose");

const periodSchema = new mongoose.Schema(
  {
    subject: String,
    teacherId: String,
    teacherName: String,
    roomId: { type: String, default: "" },
    roomName: { type: String, default: "" },
    startTime: String,
    endTime: String,
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus this timetable belongs to. Timetables are keyed by class/section
    // NAMES, and those names are per campus — so branchId is part of the unique
    // key below. Without it, branch B's "Grade 10 / A" would collide with
    // branch A's on the same day.
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    class: { type: String, required: true },
    section: { type: String, required: true },
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      required: true,
    },
    periods: [periodSchema],
  },
  { timestamps: true }
);

// branchId in the key so each campus keeps its own weekly grid. Requires
// dropping the old `{ schoolId, class, section, day }` index on an existing
// deployment — see scripts/backfill-branches.js.
timetableSchema.index({ schoolId: 1, branchId: 1, class: 1, section: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("Timetable", timetableSchema);
