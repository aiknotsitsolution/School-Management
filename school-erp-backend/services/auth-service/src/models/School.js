const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortName: { type: String, trim: true },
    address: { type: String },
    city: { type: String },
    phone: { type: String },
    email: { type: String, lowercase: true, trim: true },
    logo: { type: String },
    session: { type: String },
    plan: {
      type: String,
      enum: ["trial", "basic", "standard", "premium"],
      default: "trial",
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    settings: {
      default: {},
      type: Object,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("School", schoolSchema);