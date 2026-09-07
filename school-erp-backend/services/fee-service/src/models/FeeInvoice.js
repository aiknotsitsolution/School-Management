const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    studentId: { type: String, required: true },
    class: { type: String },
    feeType: { type: String, required: true },
    session: { type: String, required: true },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["Unpaid", "Partial", "Paid", "Overdue"], default: "Unpaid" },
    receiptNo: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeeInvoice", invoiceSchema);
