const FeeInvoice = require("../models/FeeInvoice");

const createInvoice = async (req, res) => {
  try {
    const invoice = await FeeInvoice.create({ ...req.body, schoolId: req.tenantId });
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
    const data = await FeeInvoice.find(filter).sort({ dueDate: 1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createInvoice, getInvoices };
