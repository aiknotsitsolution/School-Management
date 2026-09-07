const Payroll = require("../models/Payroll");

const generatePayroll = async (req, res) => {
  try {
    const { staffId, month, year, basic, allowances = 0, deductions = 0 } = req.body;
    const netPay = Number(basic) + Number(allowances) - Number(deductions);
    const payroll = await Payroll.create({ staffId, month, year, basic, allowances, deductions, netPay, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: payroll });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getPayroll = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId };
    if (["class_teacher", "staff"].includes(req.user.role)) {
      filter.staffId = req.user.refId;
    }
    if (req.query.month) filter.month = req.query.month;
    if (req.query.year) filter.year = req.query.year;
    const records = await Payroll.find(filter).sort({ year: -1, createdAt: -1 });
    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markPaid = async (req, res) => {
  try {
    const payroll = await Payroll.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { status: "Paid", paidOn: new Date() },
      { new: true },
    );
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll record not found" });
    res.json({ success: true, data: payroll });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { generatePayroll, getPayroll, markPaid };
