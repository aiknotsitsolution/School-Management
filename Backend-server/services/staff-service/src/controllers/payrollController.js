const Payroll = require("../models/Payroll");
const Staff = require("../models/Staff");
const { pushNotifications } = require("../utils/notify");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");

const generatePayroll = async (req, res) => {
  try {
    const { staffId, month, year, basic, allowances = 0, deductions = 0, deductionReason = "" } = req.body;
    const netPay = Number(basic) + Number(allowances) - Number(deductions);
    const payroll = await Payroll.create({ staffId, month, year, basic, allowances, deductions, deductionReason, netPay, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: payroll });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A record with these details already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const getPayroll = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId };
    if (["teacher", "staff"].includes(req.user.role)) {
      filter.staffId = req.user.refId;
    }
    if (req.query.month) filter.month = req.query.month;
    if (req.query.year) filter.year = req.query.year;
    const { page, limit, skip } = paginate(req.query);
    const [records, total] = await Promise.all([
      Payroll.find(filter).sort({ year: -1, createdAt: -1 }).skip(skip).limit(limit),
      Payroll.countDocuments(filter),
    ]);
    res.json({ success: true, count: records.length, total, ...pageInfo(total, page, limit), data: records });
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

    const staff = await Staff.findById(payroll.staffId).select("userId employeeId name").lean();
    if (staff?.userId) {
      pushNotifications({
        token: req.token,
        schoolId: req.tenantId,
        userIds: [staff.userId],
        title: "Salary Released",
        message: `Salary for ${payroll.month} ${payroll.year} (${staff.employeeId || "—"}) has been paid.`,
        kind: "payroll",
        link: "/payroll",
      });
    }
    return res.json({ success: true, data: payroll });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

const generateAllPayroll = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "month and year are required" });
    }

    const activeStaff = await Staff.find({ schoolId: req.tenantId, status: "Active" })
      .select("employeeId name salary")
      .lean();

    if (!activeStaff.length) {
      return res.status(200).json({ success: true, data: { created: 0, skipped: 0, message: "No active staff found" } });
    }

    const existing = await Payroll.find({
      schoolId: req.tenantId,
      month,
      year: Number(year),
    })
      .select("staffId")
      .lean();

    const existingIds = new Set(existing.map((p) => String(p.staffId)));

    const toCreate = activeStaff
      .filter((s) => !existingIds.has(String(s._id)) && (s.salary || 0) > 0)
      .map((s) => ({
        schoolId: req.tenantId,
        staffId: s._id,
        month,
        year: Number(year),
        basic: s.salary || 0,
        allowances: 0,
        deductions: 0,
        deductionReason: "",
        netPay: s.salary || 0,
      }));

    let created = 0;
    if (toCreate.length) {
      const result = await Payroll.insertMany(toCreate, { ordered: false }).catch(() => ({ insertedCount: 0 }));
      created = result.insertedCount || toCreate.length;
    }

    res.status(201).json({
      success: true,
      data: { created, skipped: existingIds.size, total: activeStaff.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updatePayroll = async (req, res) => {
  try {
    const { basic, allowances = 0, deductions = 0, deductionReason = "" } = req.body;
    const netPay = Number(basic) + Number(allowances) - Number(deductions);
    const payroll = await Payroll.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId, status: "Pending" },
      { basic, allowances, deductions, deductionReason, netPay },
      { new: true },
    );
    if (!payroll) return res.status(404).json({ success: false, message: "Payroll record not found or already paid" });
    res.json({ success: true, data: payroll });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { generatePayroll, generateAllPayroll, getPayroll, updatePayroll, markPaid };
