const Concession = require("../models/Concession");
const { getStudentModel } = require("../db/studentDb");
const { FEE_CATEGORIES } = require("@school-erp/shared/src/constants/feeCategories");

// Which concession wins when a student has several Active rows: statutory
// entitlements (RTE quota, SC, ST) beat scholarships beat sibling discounts
// beat manual grants; ties go to the larger benefit. "SC/ST" is kept only for
// rows written before the two communities were listed separately.
const KIND_PRIORITY = {
  RTE: 4,
  SC: 4,
  ST: 4,
  "SC/ST": 4,
  Scholarship: 3,
  Sibling: 2,
  Manual: 1,
};

// Apply at most one concession to a gross amount. Returns the fields stored
// on the invoice: grossAmount (pre-concession), concessionAmount (the
// discount), amount (net payable — what every downstream payment path uses).
const applyConcession = (gross, concession) => {
  const g = Number(gross) || 0;
  if (!concession || g <= 0) return { grossAmount: g, concessionAmount: 0, amount: g };
  const raw =
    concession.type === "percent"
      ? Math.round((g * Math.min(100, Number(concession.value) || 0)) / 100)
      : Number(concession.value) || 0;
  const concessionAmount = Math.max(0, Math.min(g, raw));
  return { grossAmount: g, concessionAmount, amount: Math.max(0, g - concessionAmount) };
};

// Same fee-type guard used by every lookup: an empty feeType on the concession
// means "applies to every head"; otherwise the head must match exactly.
const feeTypeFilter = (feeType) => ({
  $or: [{ feeType: "" }, { feeType: null }, { feeType: { $exists: false } }, { feeType }],
});

// Rows written before `appliesTo` existed are student-scoped by construction
// (`studentId` used to be required), so a missing field must still match.
const studentScoped = { $or: [{ appliesTo: "student" }, { appliesTo: null }, { appliesTo: { $exists: false } }] };

const isStudentSpecific = (doc) => Boolean(doc) && doc.appliesTo !== "category";

// Picks the single winning concession among several candidates for ONE
// student. Statutory beats scholarship beats sibling beats manual; ties go to
// the larger benefit; a still-standing tie goes to the student-specific row so
// an individual grant always outranks a blanket category rule.
const pickWinner = (candidates) => {
  let best = null;
  for (const doc of candidates) {
    if (!doc) continue;
    if (!best) {
      best = doc;
      continue;
    }
    const docPriority = KIND_PRIORITY[doc.kind] || 0;
    const bestPriority = KIND_PRIORITY[best.kind] || 0;
    let take = false;
    if (docPriority !== bestPriority) {
      take = docPriority > bestPriority;
    } else if (doc.type === best.type && (Number(doc.value) || 0) !== (Number(best.value) || 0)) {
      take = (Number(doc.value) || 0) > (Number(best.value) || 0);
    } else {
      take = isStudentSpecific(doc) && !isStudentSpecific(best);
    }
    if (take) best = doc;
  }
  return best;
};

// Batch-fetch the winning Active concession for each student for a given
// session + fee type. `feeType` is the HEAD BEING BILLED and must always be
// passed when one is known: passing "" means "grants that apply to every head",
// so a grant scoped to `feeType: "Tuition"` will NOT be returned. Returns a Map
// keyed by studentId. At most three queries per generation run — no N+1: one
// for student-addressed rows, one for category rules, and (only when a category
// rule actually exists) one read of the students' feeCategory.
const findApplicableConcessions = async (schoolId, studentIds, { session, feeType = "" }) => {
  const ids = [...new Set((studentIds || []).map((s) => String(s)).filter(Boolean))];
  if (!ids.length || !session) return new Map();

  const docs = await Concession.find({
    schoolId,
    ...studentScoped,
    studentId: { $in: ids },
    session,
    status: "Active",
    ...feeTypeFilter(feeType),
  }).lean();

  // Category rules are school-wide (no studentId), so they are fetched once
  // and fanned out below against the categories of the requested students.
  const rules = await Concession.find({
    schoolId,
    appliesTo: "category",
    category: { $in: FEE_CATEGORIES },
    session,
    status: "Active",
    ...feeTypeFilter(feeType),
  }).lean();

  const best = new Map();
  const consider = (id, doc) => {
    const current = best.get(id);
    best.set(id, current ? pickWinner([current, doc]) : doc);
  };
  for (const doc of docs) consider(String(doc.studentId), doc);

  if (rules.length) {
    try {
      const Student = await getStudentModel();
      const rows = await Student.find({ schoolId, admissionNo: { $in: ids } })
        .select("admissionNo feeCategory")
        .lean();
      const idsByCategory = new Map();
      for (const row of rows) {
        const category = String(row.feeCategory || "").trim();
        if (!category) continue;
        if (!idsByCategory.has(category)) idsByCategory.set(category, []);
        idsByCategory.get(category).push(String(row.admissionNo));
      }
      for (const rule of rules) {
        for (const id of idsByCategory.get(String(rule.category)) || []) consider(id, rule);
      }
    } catch (err) {
      // Fail-open: an unreachable student database must never block invoice
      // creation. Category rules skip that run; student-specific grants still
      // apply, which is exactly the behaviour before this lookup existed.
      console.warn(`[concessions] category rules skipped: ${err.message}`);
    }
  }
  return best;
};

// Admission numbers of every Active student carrying a given fee category.
// Used by the retro-apply path so a new category rule reaches the students who
// already have invoices.
const findStudentIdsByCategory = async (schoolId, category) => {
  const Student = await getStudentModel();
  const rows = await Student.find({
    schoolId,
    feeCategory: String(category || "").trim(),
    status: "Active",
    deletedAt: null,
  })
    .select("admissionNo")
    .lean();
  return rows.map((row) => String(row.admissionNo)).filter(Boolean);
};

module.exports = {
  applyConcession,
  findApplicableConcessions,
  findStudentIdsByCategory,
  pickWinner,
  isStudentSpecific,
};
