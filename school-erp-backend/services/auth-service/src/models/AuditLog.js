const mongoose = require("mongoose");

// Append-oriented platform audit trail. Records sensitive platform actions:
// who did what, to which entity, when, and the outcome. Never stores passwords,
// JWTs, refresh tokens, or secret values. Ordinary controllers must not modify
// or delete these documents once written.
const AUDIT_ACTIONS = [
  "login",
  "logout",
  "user.created",
  "user.updated",
  "user.deactivated",
  "user.soft_deleted",
  "user.restored",
  "school.created",
  "school.updated",
  "school.suspended",
  "school.activated",
  "school.deactivated",
  "school.reactivated",
  "plan.created",
  "plan.updated",
  "plan.deactivated",
  "plan.archived",
  "subscription.created",
  "subscription.changed",
  "subscription.suspended",
  "subscription.reactivated",
  "subscription.cancelled",
  "invoice.generated",
  "invoice.updated",
  "report.generated",
  "settings.changed",
];

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, trim: true, default: null },
    actorRole: { type: String, default: null },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    targetType: {
      type: String,
      enum: ["school", "user", "plan", "subscription", "invoice", "report", "setting"],
      default: null,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    result: {
      type: String,
      enum: ["success", "failure"],
      default: "success",
    },
    message: { type: String, default: "" },
    reason: { type: String, default: null },
    context: {
      ip: { type: String, default: null },
      userAgent: { type: String, default: null },
      xSchoolId: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    // Existing docs are only read and appended to; disable modification paths
    // unless explicitly allowed by a privileged flow.
    strict: "throw",
  }
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;