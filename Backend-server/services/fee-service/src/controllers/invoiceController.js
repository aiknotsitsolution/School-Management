const FeeInvoice = require("../models/FeeInvoice");
const FeeStructure = require("../models/FeeStructure");
const { getStudentModel } = require("../db/studentDb");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const { assertAcademicRefs } = require("@school-erp/shared/src/master-data");

// Mass-assignment guard: only these fields may be set from the request body.
// status / paidAmount / receiptNo are exclusively derived by the payments
// pipeline and must never be client-supplied.
const INVOICE_FIELDS = ["studentId", "class", "feeType", "session", "amount", "dueDate"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const dupKey = (inv) => `${inv.feeType}||${inv.session}||${String(inv.studentId)}`;

const createInvoice = async (req, res) => {
  try {
    if (req.body.session !== undefined && String(req.body.session).trim() === "") {
      return res.status(400).json({ success: false, message: "session is required" });
    }
    if (req.body.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "amount must be a positive number" });
      }
    }
    await assertAcademicRefs({ req, values: { class: req.body.class } });
    const invoice = await FeeInvoice.create({ ...pick(req.body, INVOICE_FIELDS), schoolId: req.tenantId });
    res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A record with these details already exists" });
    }
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
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

// Dry-run bulk generation: match an active FeeStructure, resolve eligible
// students from the student mirror and flag any who already have an invoice for
// this feeType+session. No database writes.
const generatePreview = async (req, res) => {
  try {
    const { class: className, section, feeType, session, dueDate } = req.body || {};
    if (!className || !feeType || !session) {
      return res.status(400).json({ success: false, message: "class, feeType and session are required" });
    }
    await assertAcademicRefs({ req, values: { class: className, feeType } });

    const structure = await FeeStructure.findOne({
      schoolId: req.tenantId,
      class: className,
      feeType,
      session,
      active: true,
    });
    if (!structure) {
      return res.status(404).json({
        success: false,
        message: "No active fee structure found for the given class, feeType and session",
      });
    }

    // Preview amount comes from the active FeeStructure unless the request
    // explicitly overrides it.
    const amount = req.body.amount != null ? Number(req.body.amount) : Number(structure.amount);

    let Student;
    try {
      Student = await getStudentModel();
    } catch (err) {
      return res.status(503).json({ success: false, message: `Student enrollment lookup unavailable: ${err.message}` });
    }

    const query = { schoolId: req.tenantId, class: className, status: "Active" };
    if (section) query.section = section;

    const students = await Student.find(query).select("admissionNo name").lean();

    const admissions = students.map((s) => String(s.admissionNo));
    const existingDocs = admissions.length
      ? await FeeInvoice.find({
          schoolId: req.tenantId,
          feeType,
          session,
          studentId: { $in: admissions },
        })
          .select("studentId")
          .lean()
      : [];
    const existing = new Set(existingDocs.map((inv) => String(inv.studentId)));

    const preview = students.map((s) => ({
      studentId: String(s.admissionNo),
      studentName: s.name,
      amount,
      isDuplicate: existing.has(String(s.admissionNo)),
    }));
    const duplicates = preview.filter((p) => p.isDuplicate);

    res.json({
      success: true,
      data: {
        class: className,
        ...(section ? { section } : {}),
        feeType,
        session,
        dueDate: dueDate || structure.dueDate || null,
        amount,
        totals: {
          count: preview.length,
          duplicates: duplicates.length,
          totalAmount: preview.reduce((sum, p) => (p.isDuplicate ? sum : sum + p.amount), 0),
        },
        preview,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    res.status(400).json({ success: false, message: err.message });
  }
};

// Confirm bulk generation: create one FeeInvoice per preview row, skipping rows
// that already have an invoice for the same student+feeType+session within this
// tenant. schoolId is always forced from the tenant to preserve isolation.
const confirmGenerate = async (req, res) => {
  try {
    const { invoices } = req.body || {};
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ success: false, message: "invoices array is required" });
    }

    const REQUIRED = ["studentId", "feeType", "session", "amount", "dueDate"];
    const parsed = [];
    for (const inv of invoices) {
      for (const key of REQUIRED) {
        if (inv[key] == null || String(inv[key]).trim() === "") {
          return res.status(400).json({ success: false, message: `invoice is missing required field: ${key}` });
        }
      }
      const amount = Number(inv.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: "invoice amount must be a positive number" });
      }
      parsed.push({ ...pick(inv, INVOICE_FIELDS), amount });
    }

    // Group by feeType+session so duplicate detection stays within the tenant
    // and is a single $in query per combination.
    const byGroup = new Map();
    for (const inv of parsed) {
      const group = `${inv.feeType}||${inv.session}`;
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group).push(inv);
    }

    const existing = new Set();
    await Promise.all(
      [...byGroup.entries()].map(async ([group, groupInvoices]) => {
        const [feeType, session] = group.split("||");
        const ids = [...new Set(groupInvoices.map((inv) => String(inv.studentId)))];
        const docs = await FeeInvoice.find({
          schoolId: req.tenantId,
          feeType,
          session,
          studentId: { $in: ids },
        })
          .select("studentId")
          .lean();
        for (const doc of docs) existing.add(`${feeType}||${session}||${String(doc.studentId)}`);
      }),
    );

    const seen = new Set();
    const toCreate = [];
    const skipped = [];
    for (const inv of parsed) {
      const key = dupKey(inv);
      if (existing.has(key) || seen.has(key)) {
        skipped.push({ studentId: inv.studentId, feeType: inv.feeType, session: inv.session, reason: "duplicate" });
        continue;
      }
      seen.add(key);
      toCreate.push({ ...inv, schoolId: req.tenantId });
    }

    const created = toCreate.length ? await FeeInvoice.insertMany(toCreate) : [];

    // Idempotent confirm: if every requested invoice already existed, nothing
    // new was created, so respond 200 rather than 201.
    res.status(created.length ? 201 : 200).json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      data: created,
      skippedItems: skipped,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A record with these details already exists" });
    }
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createInvoice, getInvoices, generatePreview, confirmGenerate };