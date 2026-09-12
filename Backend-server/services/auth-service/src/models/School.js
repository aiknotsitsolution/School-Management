const mongoose = require("mongoose");

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortName: { type: String, trim: true },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    phone: { type: String },
    email: { type: String, lowercase: true, trim: true },
    logo: { type: String },
    website: { type: String, trim: true },
    domain: { type: String, lowercase: true, trim: true },
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
    onboarding: {
      status: {
        type: String,
        enum: ["created", "configured", "subscribed", "live"],
        default: "created",
      },
      appliedAt: { type: Date },
      completedAt: { type: Date },
      notes: { type: String },
    },
    settings: {
      default: {},
      type: Object,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("School", schoolSchema);