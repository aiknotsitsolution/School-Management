const FeeInvoice = require("../models/FeeInvoice");
const {
  applyConcession,
  findApplicableConcessions,
  findStudentIdsByCategory,
} = require("./concession");

// Applies a newly-Active concession to invoices that were raised before it
// existed. Without this the grant would only ever reach the NEXT generation
// run, leaving an SC student on a full-fee invoice while the concession list
// already advertises their 5%.
//
// Only untouched invoices are rewritten: anything with a payment recorded
// against it keeps the amount it was billed at, because money already
// collected must never be silently re-priced. Invoices are re-ranked per
// student rather than having this concession forced in, so a higher-priority
// grant the student already holds (an RTE entitlement, say) keeps winning.
//
// Returns a summary so the caller can report exactly what changed.
const applyConcessionToUnpaidInvoices = async (schoolId, concession) => {
  const summary = { eligible: 0, updated: 0, unchanged: 0 };
  if (!concession || concession.status !== "Active") return summary;

  let studentIds = [];
  if (concession.appliesTo === "category") {
    if (!concession.category) return summary;
    studentIds = await findStudentIdsByCategory(schoolId, concession.category);
  } else {
    studentIds = [String(concession.studentId || "").trim()].filter(Boolean);
  }
  if (!studentIds.length) return summary;

  const invoices = await FeeInvoice.find({
    schoolId,
    studentId: { $in: studentIds },
    session: concession.session,
    // Unpaid + zero paid: a Partial invoice already has money recorded against
    // its original figure and is deliberately out of scope.
    status: "Unpaid",
    paidAmount: { $in: [0, null] },
    ...(concession.feeType ? { feeType: concession.feeType } : {}),
  }).lean();
  if (!invoices.length) return summary;
  summary.eligible = invoices.length;

  const affectedIds = [...new Set(invoices.map((inv) => String(inv.studentId)))];
  const winners = await findApplicableConcessions(schoolId, affectedIds, {
    session: concession.session,
    feeType: concession.feeType || "",
  });

  for (const inv of invoices) {
    // Legacy invoices carry only `amount`; treat it as the gross so the
    // concession is never applied on top of an already-netted figure.
    const gross = Number(inv.grossAmount) || Number(inv.amount) || 0;
    if (gross <= 0) {
      summary.unchanged += 1;
      continue;
    }
    const winner = winners.get(String(inv.studentId)) || null;
    const netted = applyConcession(gross, winner);
    const winnerId = winner ? String(winner._id) : "";
    const alreadyThere =
      Number(inv.concessionAmount || 0) === netted.concessionAmount &&
      Number(inv.amount) === netted.amount &&
      String(inv.concessionId || "") === winnerId;
    if (alreadyThere) {
      summary.unchanged += 1;
      continue;
    }
    await FeeInvoice.updateOne(
      { _id: inv._id },
      {
        $set: {
          grossAmount: gross,
          concessionAmount: netted.concessionAmount,
          amount: netted.amount,
          concessionId: winner ? winner._id : null,
        },
      },
    );
    summary.updated += 1;
  }
  return summary;
};

module.exports = { applyConcessionToUnpaidInvoices };
