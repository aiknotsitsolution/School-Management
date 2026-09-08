const mongoose = require("mongoose");

const paymentOrderSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    studentId: { type: String, required: true, index: true },
    admissionNo: { type: String, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    provider: { type: String, default: "unconfigured" },
    providerOrderId: { type: String },
    externalRef: { type: String },
    status: {
      type: String,
      enum: ["pending", "awaiting_confirmation", "completed", "failed", "cancelled"],
      default: "pending",
    },
    // This is intentionally only settable by the authenticated provider-confirm
    // path (webhook). There is no client-accessible route that flips this.
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentOrderSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("PaymentOrder", paymentOrderSchema);