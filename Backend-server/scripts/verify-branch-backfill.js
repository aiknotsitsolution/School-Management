// Post-migration verification: every branch-scoped row must point at a branch
// that actually exists in erp_auth, and no row may be left unstamped - unless it
// is one of the documented school-level rows below, which have no campus to
// belong to and are written with a null branchId by the services themselves.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const { BRANCH_SCOPED_COLLECTIONS, uriForDb } = require("../shared/src/branchScopedCollections");

/**
 * Rows whose null branchId is a legitimate state, not an unmigrated row.
 *
 * paymentorders: a school-level subscription upgrade has no invoice, because it
 * is not the collection of a fee at any campus - the whole school buys the plan.
 * The service leaves these null, so the backfill must too, and a branch filter
 * has to keep hiding them from branch admins. An order that DOES carry an
 * invoiceId is a real fee collection and must be stamped like any other.
 */
const EXPECTED_NULL = {
  paymentorders: { invoiceId: null },
};

(async () => {
  const auth = await mongoose.createConnection(uriForDb("erp_auth")).asPromise();
  const branches = await auth
    .db.collection("branches")
    .find({})
    .project({ name: 1, code: 1, isHeadOffice: 1, isActive: 1 })
    .toArray();
  await auth.close();

  console.log(`=== branches in erp_auth: ${branches.length} ===`);
  for (const b of branches) {
    console.log(`  ${b.name}  code=${b.code}  headOffice=${b.isHeadOffice}  active=${b.isActive}`);
  }

  const branchIds = branches.map((b) => new mongoose.Types.ObjectId(String(b._id)));
  let stamped = 0;
  let expectedNulls = 0;
  let unexpectedNulls = 0;
  let foreign = 0;
  let collections = 0;

  for (const [db, colls] of Object.entries(BRANCH_SCOPED_COLLECTIONS)) {
    const conn = await mongoose.createConnection(uriForDb(db)).asPromise();
    const existing = new Set((await conn.db.listCollections().toArray()).map((c) => c.name));
    for (const name of Object.keys(colls)) {
      if (!existing.has(name)) continue;
      collections += 1;
      const col = conn.db.collection(name);
      stamped += await col.countDocuments({ branchId: { $ne: null } });
      const nulls = await col.countDocuments({ branchId: null });
      const allowed = EXPECTED_NULL[name] || null;
      const allowedHere = allowed ? await col.countDocuments({ branchId: null, ...allowed }) : 0;
      const unexpectedHere = nulls - allowedHere;
      expectedNulls += allowedHere;
      unexpectedNulls += unexpectedHere;
      const bad = await col.countDocuments({ branchId: { $ne: null, $nin: branchIds } });
      foreign += bad;
      if (unexpectedHere) {
        console.log(`  !! ${db}.${name}: ${unexpectedHere} row(s) still unstamped`);
      }
      if (bad) console.log(`  !! ${db}.${name}: ${bad} row(s) point at an unknown branch`);
    }
    await conn.close();
  }

  console.log(`\n=== ${collections} branch-scoped collections scanned ===`);
  console.log(`  stamped:                            ${stamped}`);
  console.log(`  school-level rows (null by design):  ${expectedNulls}`);
  console.log(`  UNEXPECTED branchId: null:          ${unexpectedNulls}`);
  console.log(`  unknown branch reference:           ${foreign}`);
  const ok = unexpectedNulls === 0 && foreign === 0;
  console.log(
    `\n${ok ? "VERIFIED" : "PROBLEM"}: ${
      ok
        ? "every row is either stamped to a real branch or a documented school-level row"
        : "unstamped rows or dangling branch references remain - see the !! lines above"
    }`,
  );
  process.exitCode = ok ? 0 : 1;
})().catch((err) => {
  console.error("verify failed:", err.message);
  process.exit(1);
});
