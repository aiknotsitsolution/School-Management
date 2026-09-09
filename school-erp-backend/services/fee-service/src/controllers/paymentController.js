const { v4: uuidv4 } = require("uuid");
const FeeInvoice = require("../models/FeeInvoice");
const Payment = require("../models/Payment");
const { paginate, pageInfo } = require("../utils/pagination");

const recordPayment = async (req, res) => {
  try {
    const { invoiceId, amount, mode, transactionId } = req.body;
    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const receiptNo = `RCPT-${Date.now()}`;
    const payment = await Payment.create({
      invoiceId,
      studentId: invoice.studentId,
      amount,
      mode,
      transactionId: transactionId || uuidv4(),
      receiptNo,
      collectedBy: req.user.name,
      schoolId: req.tenantId,
    });

    invoice.paidAmount += Number(amount);
    invoice.receiptNo = receiptNo;
    invoice.status = invoice.paidAmount >= invoice.amount ? "Paid" : "Partial";
    await invoice.save();

    res.status(201).json({ success: true, data: { payment, invoice } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const { studentId } = req.query;
    const filter = { schoolId: req.tenantId };
    if (studentId) filter.studentId = studentId;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      Payment.find(filter).sort({ paidOn: -1 }).skip(skip).limit(limit),
      Payment.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { recordPayment, getPayments };
