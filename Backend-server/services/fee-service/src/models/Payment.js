const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    // Campus the payment was collected at; copied from the invoice so a branch
    // admin only ever sees their own campus collections.
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    studentId: { type: String, required: true },
    amount: { type: Number, required: true },
    mode: { type: String, enum: ["Cash", "Card", "UPI", "Net Banking", "Bank Transfer", "Cheque", "Online Gateway"], required: true },
    transactionId: { type: String },
    receiptNo: { type: String, required: true },
    // "manual" = office typed their own receipt-book number at the counter;
    // "auto" = the service minted RCPT-… (all portal/gateway payments are auto).
    receiptMode: { type: String, enum: ["manual", "auto"], default: "auto" },
    // Where the money came in: "counter" (staff collection) vs "online"
    // (student/parent portal order) — lets reports split cash vs gateway.
    source: { type: String, enum: ["counter", "online"], default: "counter" },
    paidOn: { type: Date, default: Date.now },
    collectedBy: { type: String },
    // Office-verified manual payments (CLIENT-REQ-037/039): payer's reference
    // plus cheque clearance lifecycle. clearanceStatus is only set for Cheque.
    receivedRef: { type: String },
    chequeNo: { type: String },
    chequeDate: { type: Date },
    bankName: { type: String },
    clearanceStatus: { type: String, enum: ["Pending", "Cleared", "Bounced"] },
    clearedAt: { type: Date },
    clearedBy: { type: String },
    bouncedReason: { type: String },
    bouncedBy: { type: String },
    bouncedAt: { type: Date },
  },
  { timestamps: true }
);

// Receipt numbers must be unique per tenant (GET /receipt/:receiptNo would
// otherwise silently return the first of two colliding rows).
paymentSchema.index({ schoolId: 1, receiptNo: 1 }, { unique: true });
// Duplicate payment references are rejected at the database (partial index:
// legacy/optional transactionIds stay unindexed only when absent/empty).
paymentSchema.index(
  { schoolId: 1, transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: "string", $gt: "" } } }
);

module.exports = mongoose.model("Payment", paymentSchema);
