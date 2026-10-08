const {
  scopeQuery,
  branchIdForWrite,
} = require("@school-erp/shared/src/middleware/branchScope");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const StudentFeePlan = require("../models/StudentFeePlan");
const FeeStructure = require("../models/FeeStructure");
const FeeInvoice = require("../models/FeeInvoice");
const Payment = require("../models/Payment");
const Concession = require("../models/Concession");

// ---------------------------------------------------------------------------
// Student fee plans (admission-time fee package) + the one-place student fee
// summary that student, parent and school views all render.
//
// Write paths use branchIdForWrite(req) exactly like concessions do, and every
// read goes through scopeQuery() so a branch admin only ever packages their own
// campus's students.
// ---------------------------------------------------------------------------

// null = staff (tenant/branch scope applies); array = the ONLY students this
// token may read (mirrors invoiceController's student/parent scoping).
const readableStudents = (req) => {
  if (req.user.role === "student") return [String(req.user.refId || "")];
  if (req.user.role === "parent") return (req.user.linkedStudentIds || []).map(String);
  return null;
};

const canReadStudent = (req, studentId) => {
  const allowed = readableStudents(req);
  return !allowed || allowed.includes(String(studentId));
};

const actor = (req) => req.user.name || req.user.email || "staff";

// Heads arrive from the office UI — normalise instead of trusting the shape.
const normalizeHeads = (heads) => {
  if (!Array.isArray(heads)) return [];
  return heads
    .map((head) => {
      const feeType = String(head && head.feeType ? head.feeType : "").trim();
      const annual = Number(head && head.annualAmount);
      if (!feeType || !Number.isFinite(annual) || annual < 0) return null;
      return {
        feeType,
        annualAmount: annual,
        frequency: String((head && head.frequency) || "Annually").trim(),
        dueDate: head && head.dueDate ? new Date(head.dueDate) : undefined,
        active: head && head.active === false ? false : true,
        note: head && head.note ? String(head.note).slice(0, 200) : undefined,
      };
    })
    .filter(Boolean);
};

const getPlans = async (req, res) => {
  try {
    const { studentId, session } = req.query;
    const filter = scopeQuery(StudentFeePlan, req, { schoolId: req.tenantId });
    const allowed = readableStudents(req);
    if (allowed) {
      if (studentId && !allowed.includes(String(studentId))) {
        return res.status(403).json({ success: false, message: "Access denied for this student" });
      }
      filter.studentId = { $in: allowed };
    } else if (studentId) {
      filter.studentId = String(studentId);
    }
    if (session) filter.session = session;

    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      StudentFeePlan.find(filter).sort({ session: -1, updatedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      StudentFeePlan.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPlan = async (req, res) => {
  try {
    const plan = await StudentFeePlan.findOne(
      scopeQuery(StudentFeePlan, req, { _id: req.params.id, schoolId: req.tenantId }),
    ).lean();
    if (!plan) return res.status(404).json({ success: false, message: "Fee plan not found" });
    if (!canReadStudent(req, plan.studentId)) {
      return res.status(403).json({ success: false, message: "Access denied for this student" });
    }
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createPlan = async (req, res) => {
  try {
    const { studentId, session } = req.body || {};
    if (!studentId || !String(studentId).trim()) {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }
    if (!session || !String(session).trim()) {
      return res.status(400).json({ success: false, message: "session is required" });
    }
    const student = String(studentId).trim();
    const clash = await StudentFeePlan.findOne(
      scopeQuery(StudentFeePlan, req, {
        schoolId: req.tenantId,
        studentId: student,
        session: String(session).trim(),
      }),
    )
      .select("_id")
      .lean();
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `A fee plan already exists for ${student} in ${session}`,
      });
    }

    const plan = await StudentFeePlan.create({
      schoolId: req.tenantId,
      branchId: branchIdForWrite(req),
      studentId: student,
      session: String(session).trim(),
      class: req.body.class ? String(req.body.class) : undefined,
      heads: normalizeHeads(req.body.heads),
      source: req.body.source === "onboarding" ? "onboarding" : "manual",
      status: req.body.status === "Draft" ? "Draft" : "Active",
      notes: req.body.notes ? String(req.body.notes).slice(0, 500) : undefined,
      createdBy: actor(req),
    });
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    const plan = await StudentFeePlan.findOne(
      scopeQuery(StudentFeePlan, req, { _id: req.params.id, schoolId: req.tenantId }),
    );
    if (!plan) return res.status(404).json({ success: false, message: "Fee plan not found" });

    const body = req.body || {};
    if (body.heads !== undefined) plan.heads = normalizeHeads(body.heads);
    if (body.class !== undefined) plan.class = body.class ? String(body.class) : undefined;
    if (body.status !== undefined && ["Draft", "Active"].includes(body.status)) plan.status = body.status;
    if (body.notes !== undefined) plan.notes = body.notes ? String(body.notes).slice(0, 500) : undefined;
    plan.updatedBy = actor(req);
    await plan.save(); // pre-validate recomputes totalAnnual
    res.json({ success: true, data: plan });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Idempotent package creation — called after onboarding and by the "auto-fill
// from class structure" button. Missing plan → build heads from the class fee
// structure; existing plan → returned untouched (office edits are sacred).
const ensurePlan = async (req, res) => {
  try {
    const body = req.body || {};
    let studentId = body.studentId ? String(body.studentId).trim() : "";
    if (!studentId) {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }

    const session = String(body.session || "").trim() ||
      `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`;

    const existing = await StudentFeePlan.findOne(
      scopeQuery(StudentFeePlan, req, { schoolId: req.tenantId, studentId, session }),
    ).lean();
    if (existing) return res.status(200).json({ success: true, created: false, data: existing });

    // Fall back to the authoritative student record for class when the caller
    // (onboarding screen) did not send it.
    let className = body.class ? String(body.class) : undefined;
    if (!className) {
      try {
        const { getStudentModel } = require("../db/studentDb");
        const Student = await getStudentModel();
        const record = await Student.findOne({ schoolId: req.tenantId, admissionNo: studentId })
          .select("class")
          .lean();
        if (record) className = record.class || undefined;
      } catch {
        // Student DB unreachable — build an empty plan the office can fill in.
      }
    }

    const structureFilter = scopeQuery(FeeStructure, req, {
      schoolId: req.tenantId,
      session,
      active: true,
      ...(className ? { class: className } : {}),
    });
    const structures = className
      ? await FeeStructure.find(structureFilter).sort({ feeType: 1 }).lean()
      : [];

    const plan = await StudentFeePlan.create({
      schoolId: req.tenantId,
      branchId: branchIdForWrite(req),
      studentId,
      session,
      class: className,
      // annualAmount is the office's year figure; the structure's amount is the
      // starting point they then edit (transport opt-out, negotiated terms…).
      heads: structures.map((s) => ({
        feeType: s.feeType,
        annualAmount: s.amount,
        frequency: s.frequency || "Annually",
        dueDate: s.dueDate || undefined,
        active: true,
      })),
      source: body.source === "manual" ? "manual" : "onboarding",
      status: "Active",
      createdBy: actor(req),
      notes: structures.length ? "Auto-created from class fee structure" : "Auto-created — no fee structure for this class yet",
    });
    res.status(201).json({ success: true, created: true, data: plan });
  } catch (err) {
    if (err && err.code === 11000) {
      // Lost a race with a parallel ensure — return the winner's plan.
      const winner = await StudentFeePlan.findOne(
        scopeQuery(StudentFeePlan, req, {
          schoolId: req.tenantId,
          studentId: String((req.body || {}).studentId || "").trim(),
          session: String((req.body || {}).session || "").trim(),
        }),
      ).lean();
      if (winner) return res.status(200).json({ success: true, created: false, data: winner });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// One place: package vs billed vs collected vs balance, head by head, plus the
// receipt trail. Student/parent tokens are locked to their own student.
const getStudentSummary = async (req, res) => {
  try {
    let studentId = String(req.params.studentId || "").trim();
    // Convenience for the self-service portals: /summary/me resolves to the
    // token's own student (student) or their only linked child (parent).
    if (studentId === "me") {
      const linked = (req.user.linkedStudentIds || []).map(String);
      if (req.user.role === "student") {
        studentId = String(req.user.refId || "");
      } else if (req.user.role === "parent" && linked.length === 1) {
        studentId = linked[0];
      } else {
        return res.status(400).json({
          success: false,
          message: "Specify which child's fee summary to load",
        });
      }
      if (!studentId) {
        return res.status(400).json({ success: false, message: "No student linked to this account" });
      }
    }
    if (!studentId) {
      return res.status(400).json({ success: false, message: "studentId is required" });
    }
    if (!canReadStudent(req, studentId)) {
      return res.status(403).json({ success: false, message: "Access denied for this student" });
    }

    const plan = await StudentFeePlan.findOne(
      scopeQuery(StudentFeePlan, req, {
        schoolId: req.tenantId,
        studentId,
        ...(req.query.session ? { session: req.query.session } : {}),
      }),
    ).sort({ session: -1 }).lean();

    const session = req.query.session || plan?.session;
    const invoices = await FeeInvoice.find(
      scopeQuery(FeeInvoice, req, {
        schoolId: req.tenantId,
        studentId,
        ...(session ? { session } : {}),
      }),
    ).sort({ dueDate: 1, _id: 1 }).lean();

    const invoiceIds = invoices.map((inv) => inv._id);
    const payments = invoiceIds.length
      ? await Payment.find(
          scopeQuery(Payment, req, {
            schoolId: req.tenantId,
            studentId,
            invoiceId: { $in: invoiceIds },
          }),
        ).sort({ paidOn: -1 }).lean()
      : [];

    // Read the grants off the invoices themselves: each invoice snapshots the
    // concession it was netted with, so this is exactly what was applied — and
    // unlike a studentId filter it also covers category-wide rules ("SC -> 5%"),
    // whose rows carry no studentId at all.
    const appliedConcessionIds = [
      ...new Set(invoices.map((inv) => inv.concessionId).filter(Boolean).map(String)),
    ];
    const concessions = appliedConcessionIds.length
      ? await Concession.find(
          scopeQuery(Concession, req, {
            schoolId: req.tenantId,
            _id: { $in: appliedConcessionIds },
          }),
        ).lean()
      : [];

    const invoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
    const collected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const concession = invoices.reduce((sum, inv) => sum + Number(inv.concessionAmount || 0), 0);

    // Union of planned heads and billed heads so nothing disappears from view.
    const headwise = [];
    const pushHead = (feeType, key, value) => {
      let row = headwise.find((h) => h.feeType === feeType);
      if (!row) {
        row = { feeType, planned: 0, invoiced: 0, paid: 0, balance: 0 };
        headwise.push(row);
      }
      row[key] += value;
    };
    (plan?.heads || [])
      .filter((h) => h.active !== false)
      .forEach((h) => pushHead(h.feeType, "planned", Number(h.annualAmount || 0)));
    invoices.forEach((inv) => {
      pushHead(inv.feeType, "invoiced", Number(inv.amount || 0));
      pushHead(inv.feeType, "paid", Number(inv.paidAmount || 0));
    });
    headwise.forEach((row) => {
      row.balance = Math.max(0, row.invoiced - row.paid);
    });

    res.json({
      success: true,
      data: {
        studentId,
        session: session || null,
        class: plan?.class || invoices[0]?.class || null,
        plan: plan
          ? {
              _id: plan._id,
              session: plan.session,
              class: plan.class,
              heads: plan.heads || [],
              totalAnnual: plan.totalAnnual,
              source: plan.source,
              status: plan.status,
              notes: plan.notes || null,
              updatedAt: plan.updatedAt,
            }
          : null,
        totals: {
          planned: plan ? plan.totalAnnual : null,
          invoiced,
          collected,
          outstanding: Math.max(0, invoiced - collected),
          concession,
        },
        headwise,
        invoices: invoices.map((inv) => ({
          _id: inv._id,
          feeType: inv.feeType,
          session: inv.session,
          amount: inv.amount,
          grossAmount: inv.grossAmount ?? inv.amount,
          concessionAmount: inv.concessionAmount || 0,
          paidAmount: inv.paidAmount || 0,
          balance: Math.max(0, Number(inv.amount || 0) - Number(inv.paidAmount || 0)),
          dueDate: inv.dueDate,
          status: inv.status,
          receiptNo: inv.receiptNo || null,
        })),
        payments: payments.map((p) => ({
          _id: p._id,
          receiptNo: p.receiptNo,
          receiptMode: p.receiptMode || "auto",
          source: p.source || "counter",
          amount: p.amount,
          mode: p.mode,
          paidOn: p.paidOn,
          collectedBy: p.collectedBy || null,
        })),
        concessions: concessions.map((c) => ({
          _id: c._id,
          kind: c.kind,
          name: c.name,
          type: c.type,
          value: c.value,
          feeType: c.feeType || null,
          appliesTo: c.appliesTo || "student",
          category: c.category || null,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  ensurePlan,
  getStudentSummary,
};
