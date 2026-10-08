const { scopeQuery, branchIdForWrite } = require("@school-erp/shared/src/middleware/branchScope");
const { FEE_CATEGORIES, isFeeCategory } = require("@school-erp/shared/src/constants/feeCategories");
const Concession = require("../models/Concession");
const { applyConcessionToUnpaidInvoices } = require("../utils/retroApply");

// Concession workflow (CLIENT-REQ-045/046/047): created as Requested,
// approved to Active (or rejected) by a fee-structure manager. Approving a
// row also nets the invoices that were raised before it existed (see
// utils/retroApply) so a grant is never advertised but not applied.

// SC and ST are separate grants: a quota rule has to name the community it
// applies to, and each gets its own row so the duplicate check and the
// approval history stay per-community.
const KINDS = ["Sibling", "Scholarship", "Manual", "RTE", "SC", "ST"];

const validate = (body) => {
  const { appliesTo = "student", studentId, category, kind, type, value, session } = body || {};
  if (appliesTo !== "student" && appliesTo !== "category") {
    return "appliesTo must be 'student' or 'category'";
  }
  if (appliesTo === "category") {
    if (!isFeeCategory(category)) return `category must be one of: ${FEE_CATEGORIES.join(", ")}`;
  } else if (!studentId || !String(studentId).trim()) {
    return "studentId is required";
  }
  if (!KINDS.includes(kind)) return `kind must be one of: ${KINDS.join(", ")}`;
  if (type !== "percent" && type !== "flat") return "type must be 'percent' or 'flat'";
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return "value must be a non-negative number";
  if (type === "percent" && num > 100) return "percent value cannot exceed 100";
  if (type === "flat" && num === 0) return "flat value must be greater than 0";
  if (!session || !String(session).trim()) return "session is required";
  return null;
};

const getConcessions = async (req, res) => {
  try {
    const { studentId, status, kind, session } = req.query;
    const filter = scopeQuery(Concession, req, { schoolId: req.tenantId })
    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    if (kind) filter.kind = kind;
    if (session) filter.session = session;
    const data = await Concession.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createConcession = async (req, res) => {
  try {
    const error = validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const appliesTo = (req.body.appliesTo === "category" ? "category" : "student");
    const category = appliesTo === "category" ? String(req.body.category).trim() : "";
    const studentId = appliesTo === "category" ? null : String(req.body.studentId).trim();
    const { kind, session } = req.body;
    // One live (Requested/Active) row per scope+kind+session — a Rejected row
    // must not block a fresh request, and a blanket category rule never blocks
    // an individual grant (or the other way round).
    const live = await Concession.findOne(scopeQuery(Concession, req, {
      schoolId: req.tenantId,
      appliesTo,
      ...(appliesTo === "category" ? { category } : { studentId }),
      kind,
      session: String(session).trim(),
      status: { $ne: "Rejected" },
    }))
      .select("_id")
      .lean();
    if (live) {
      return res.status(409).json({
        success: false,
        message: appliesTo === "category"
          ? `A ${kind} concession already exists for the ${category} category in ${session}`
          : `A ${kind} concession already exists for this student in ${session}`,
      });
    }

    const doc = await Concession.create({
      schoolId: req.tenantId,

      branchId: branchIdForWrite(req),
      appliesTo,
      studentId,
      category,
      kind,
      // The Kind is the name — a caller may still send one (legacy API users),
      // but it now defaults to the kind rather than being mandatory.
      name: (req.body.name && String(req.body.name).trim()) || String(kind).trim(),
      type: req.body.type,
      value: Number(req.body.value),
      session: String(session).trim(),
      feeType: (req.body.feeType && String(req.body.feeType).trim()) || "",
      siblingOf: (req.body.siblingOf && String(req.body.siblingOf).trim()) || null,
      notes: (req.body.notes && String(req.body.notes).trim()) || "",
      requestedBy: req.user.name,
      status: "Requested",
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const decideConcession = (action) => async (req, res) => {
  try {
    const doc = await Concession.findOne(scopeQuery(Concession, req, { _id: req.params.id, schoolId: req.tenantId }));
    if (!doc) return res.status(404).json({ success: false, message: "Concession not found" });
    if (doc.status !== "Requested") {
      return res.status(409).json({ success: false, message: `Concession already ${doc.status.toLowerCase()}` });
    }
    if (action === "approve") {
      doc.status = "Active";
      doc.approvedBy = req.user.name;
      doc.approvedAt = new Date();
    } else {
      doc.status = "Rejected";
      doc.rejectedBy = req.user.name;
      doc.rejectedReason = (req.body && req.body.reason && String(req.body.reason).trim()) || "";
    }
    await doc.save();

    // Approving is the moment a grant becomes real, so this is also where
    // invoices raised BEFORE it existed get netted. Reported back so the
    // caller can show how many invoices moved.
    let retroApplied = null;
    if (action === "approve") {
      retroApplied = await applyConcessionToUnpaidInvoices(req.tenantId, doc);
    }
    res.json({ success: true, data: doc, retroApplied });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Deleting a concession only affects FUTURE invoice generation — invoices
// already carry their own concession snapshot.
const removeConcession = async (req, res) => {
  try {
    const doc = await Concession.findOneAndDelete(scopeQuery(Concession, req, { _id: req.params.id, schoolId: req.tenantId }));
    if (!doc) return res.status(404).json({ success: false, message: "Concession not found" });
    res.json({ success: true, data: { deleted: 1 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getConcessions,
  createConcession,
  approveConcession: decideConcession("approve"),
  rejectConcession: decideConcession("reject"),
  removeConcession,
};
