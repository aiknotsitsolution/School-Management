const FeeInvoice = require("../models/FeeInvoice");
const { paginate, pageInfo } = require("../utils/pagination");

// Mass-assignment guard: only these fields may be set from the request body.
// status / paidAmount / receiptNo are exclusively derived by the payments
// pipeline and must never be client-supplied.
const INVOICE_FIELDS = ["studentId", "class", "feeType", "session", "amount", "dueDate"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createInvoice = async (req, res) => {
  try {
    const invoice = await FeeInvoice.create({ ...pick(req.body, INVOICE_FIELDS), schoolId: req.tenantId });
    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const { studentId, status, session } = req.query;
    const filter = { schoolId: req.tenantId };
    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    if (session) filter.session = session;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      FeeInvoice.find(filter).sort({ dueDate: 1 }).skip(skip).limit(limit),
      FeeInvoice.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createInvoice, getInvoices };
