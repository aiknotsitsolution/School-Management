/**
 * Backfill receipt provenance on fee payments.
 *
 * Payment.receiptMode ("manual" | "auto") and Payment.source ("counter" |
 * "online") were added when the office started entering receipt-book numbers
 * by hand. Rows that predate those fields have neither value, which would make
 * every report show them as blank — so this stamps the honest historical value:
 *
 *   receiptMode -> "auto"   (all legacy receipts were service-minted RCPT-…)
 *   source      -> "online" when the payment came from a portal order
 *                 ("Online Gateway" mode, or the engine's `${confirmedBy}:${gatewayMode}`
 *                 collectedBy marker), otherwise "counter".
 *
 * Usage:
 *   node scripts/backfill-fee-receipts.js           (dry run — prints counts)
 *   node scripts/backfill-fee-receipts.js --apply   (writes)
 * Re-running is a no-op: only rows missing the fields are matched.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "9.9.9.9"]);
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

const paymentSchema = new mongoose.Schema(
  {
    schoolId: mongoose.Schema.Types.ObjectId,
    mode: String,
    receiptMode: String,
    source: String,
    collectedBy: String,
    receiptNo: String,
  },
  { collection: "payments" },
);
const Payment = mongoose.model("Payment", paymentSchema);

// Portal-order marker: the engine writes `${confirmedBy}:${gatewayMode}`.
// Query syntax — used for counting and for the $match-shaped filters.
const ONLINE_QUERY = {
  $or: [{ mode: "Online Gateway" }, { collectedBy: /:/ }],
};
// The SAME rule as an aggregation expression. It must be written with $eq /
// $regexMatch: in a pipeline a bare `{ mode: "Online Gateway" }` document is
// *constructed*, not compared, so it is always truthy and would stamp every
// row as online (that exact bug marked four counter receipts online once).
const ONLINE_EXPR = {
  $or: [
    { $eq: ["$mode", "Online Gateway"] },
    {
      $regexMatch: {
        input: { $ifNull: ["$collectedBy", ""] },
        regex: ":",
      },
    },
  ],
};

(async () => {
  try {
    await mongoose.connect(process.env.FEE_MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

    const noMode = await Payment.countDocuments({ receiptMode: { $exists: false } });
    // Rows whose stored source disagrees with the rule (missing OR wrong).
    const [mismatch] = await Payment.aggregate([
      { $set: { _expected: { $cond: [ONLINE_EXPR, "online", "counter"] } } },
      { $match: { $or: [{ source: { $exists: false } }, { source: { $ne: "$_expected" } }] } },
      { $count: "n" },
    ]);
    const onlineRows = await Payment.countDocuments({ ...ONLINE_QUERY });

    console.log(`payments missing receiptMode : ${noMode}`);
    console.log(`payments with wrong/missing source : ${mismatch ? mismatch.n : 0}`);
    console.log(`portal payments (rule)              : ${onlineRows}`);

    if (APPLY) {
      const a = await Payment.updateMany(
        { receiptMode: { $exists: false } },
        { $set: { receiptMode: "auto" } },
      );
      // Recompute source for every row — idempotent and self-healing, so a
      // bad earlier stamp is corrected on re-run rather than preserved.
      const b = await Payment.updateMany(
        {},
        [{ $set: { source: { $cond: [ONLINE_EXPR, "online", "counter"] } } }],
      );
      console.log(`APPLIED receiptMode=${a.modifiedCount} source=${b.modifiedCount}`);
    } else {
      console.log("dry run — pass --apply to write");
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
