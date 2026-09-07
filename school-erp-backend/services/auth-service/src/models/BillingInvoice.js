const mongoose = require("mongoose");

// Platform billing invoice. invoiceNumber is globally unique (collision-safe
// random suffix + unique index). Amount mirrors the subscription price snapshot.
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, trim: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Subscription", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", uppercase: true, trim: true },
    status: { type: String, enum: ["draft", "issued", "paid", "void", "overdue"], default: "issued", index: true },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    dueDate: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ schoolId: 1, status: 1 });

module.exports = mongoose.model("BillingInvoice", invoiceSchema);