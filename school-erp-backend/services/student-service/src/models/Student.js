const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    admissionNo: { type: String, required: true, unique: true },
    userId: { type: String, default: null }, // link to auth-service User._id
    name: { type: String, required: true },
    dob: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    class: { type: String, required: true },
    section: { type: String, required: true },
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
  },
  { timestamps: true },
);

module.exports = mongoose.model("Student", studentSchema);
