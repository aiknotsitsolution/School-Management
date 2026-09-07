const mongoose = require("mongoose");

const STAFF_DESIGNATIONS = [
  "admission_counsellor",
  "accountant",
  "librarian",
  "receptionist",
  "transport",
];

const userSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["super_admin", "school_admin", "class_teacher", "staff", "student"],
      required: true,
    },
    designation: {
      type: String,
      enum: STAFF_DESIGNATIONS,
      default: null,
    },
    class: { type: String, default: null },
    section: { type: String, default: null },
    phone: { type: String },
    refId: { type: String, default: null },
    linkedStudentIds: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ schoolId: 1, role: 1 });

module.exports = mongoose.model("User", userSchema);
module.exports.STAFF_DESIGNATIONS = STAFF_DESIGNATIONS;