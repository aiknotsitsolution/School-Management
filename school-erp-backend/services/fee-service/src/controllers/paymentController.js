const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const FeeInvoice = require("../models/FeeInvoice");
const Payment = require("../models/Payment");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");

const recordPayment = async (req, res) => {
  try {
    const { invoiceId, amount, mode, transactionId } = req.body;
    const amt = Number(amount);
    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: req.tenantId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    if (!(amt > 0)) return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
    if (amt > invoice.amount - invoice.paidAmount)
      return res.status(400).json({ success: false, message: "Payment amount exceeds outstanding balance" });

    const receiptNo = `RCPT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payment = await Payment.create({
      invoiceId,
      studentId: invoice.studentId,
      amount: amt,
      mode,
      transactionId: transactionId || uuidv4(),
      receiptNo,
      collectedBy: req.user.name,
      schoolId: req.tenantId,
    });

    invoice.paidAmount = invoice.paidAmount + amt;
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

const getReceipt = async (req, res) => {
  try {
    const { receiptNo } = req.params;
    const payment = await Payment.findOne({ receiptNo, schoolId: req.tenantId });
    if (!payment) return res.status(404).json({ success: false, message: "Receipt not found" });
    const invoice = await FeeInvoice.findOne({ _id: payment.invoiceId });
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({
      success: true,
      data: {
        payment,
        invoice,
        receiptNo: payment.receiptNo,
        paidOn: payment.paidOn,
        mode: payment.mode,
        amount: payment.amount,
        collectedBy: payment.collectedBy,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getFeeReports = async (req, res) => {
  try {
    const { from, to, class: className, feeType, session } = req.query;
    const schoolId = new mongoose.Types.ObjectId(req.tenantId);

    const paymentMatch = { schoolId };
    if (from || to) {
      paymentMatch.paidOn = {};
      if (from) paymentMatch.paidOn.$gte = new Date(from);
      if (to) paymentMatch.paidOn.$lte = new Date(to);
    }

    const invoiceAdditional = {};
    if (className) invoiceAdditional["invoice.class"] = className;
    if (feeType) invoiceAdditional["invoice.feeType"] = feeType;
    if (session) invoiceAdditional["invoice.session"] = session;

    const [collectionByDate, outstanding, classWiseCollection, feeTypeWiseCollection] = await Promise.all([
      Payment.aggregate([
        { $match: paymentMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidOn" } },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      FeeInvoice.aggregate([
        {
          $match: {
            schoolId,
            $expr: { $lt: ["$paidAmount", "$amount"] },
            ...(className ? { class: className } : {}),
            ...(feeType ? { feeType } : {}),
            ...(session ? { session } : {}),
          },
        },
        {
          $group: {
            _id: { class: "$class", feeType: "$feeType" },
            outstanding: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: paymentMatch },
        { $lookup: { from: "feeinvoices", localField: "invoiceId", foreignField: "_id", as: "invoice" } },
        { $unwind: "$invoice" },
        { $match: invoiceAdditional },
        {
          $group: {
            _id: "$invoice.class",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: paymentMatch },
        { $lookup: { from: "feeinvoices", localField: "invoiceId", foreignField: "_id", as: "invoice" } },
        { $unwind: "$invoice" },
        { $match: invoiceAdditional },
        {
          $group: {
            _id: "$invoice.feeType",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: { collectionByDate, outstanding, classWiseCollection, feeTypeWiseCollection },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { recordPayment, getPayments, getReceipt, getFeeReports };