// Assigns User.branchId from the branch already stamped on the referenced
// Staff / Student record (both were handled by backfill-branches.js).
//
// Deliberately left null (= school-wide):
//   super_admin   platform owner, not tied to one school
//   school_admin  the school's own admin console spans every campus
//   parent        a parent can have children at more than one branch, which a
//                 single branchId cannot express; they stay school-wide
//
// Idempotent: re-running only touches users that still have a null branchId.
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const { uriForDb } = require("../shared/src/branchScopedCollections");

const APPLY = process.argv.includes("--apply");
const BRANCH_ID = process.argv.find((a) => a.startsWith("--branch="))?.split("=")[1] || null;

const ASSIGNABLE_ROLES = ["teacher", "staff", "student"];
const SCHOOL_WIDE_ROLES = ["super_admin", "school_admin", "parent"];

(async () => {
  const auth = await mongoose.createConnection(uriForDb("erp_auth")).asPromise();
  const students = await mongoose.createConnection(uriForDb("erp_student")).asPromise();
  const staff = await mongoose.createConnection(uriForDb("erp_staff")).asPromise();

  const users = auth.db.collection("users");
  const pending = await users
    .find({ role: { $in: ASSIGNABLE_ROLES }, branchId: null })
    .project({ role: 1, refId: 1, schoolId: 1 })
    .toArray();

  console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${pending.length} user(s) awaiting a branch\n`);

  // Staff/teacher accounts reference the Staff record by _id, while student
  // accounts reference the Student by admissionNo (that is what User.refId
  // holds), so the two maps are keyed differently.
  const staffBranchById = new Map(
    (await staff.db.collection("staffs").find({}).project({ _id: 1, branchId: 1 }).toArray()).map((s) => [String(s._id), s.branchId]),
  );
  const studentBranchByAdmissionNo = new Map(
    (await students.db.collection("students").find({}).project({ admissionNo: 1, branchId: 1 }).toArray()).map((s) => [
      String(s.admissionNo),
      s.branchId,
    ]),
  );

  let assigned = 0;
  const skipped = { noRef: 0, noBranchOnRecord: 0, overridden: 0 };

  for (const user of pending) {
    const recordBranch =
      user.role === "student" ? studentBranchByAdmissionNo.get(String(user.refId)) : staffBranchById.get(String(user.refId));
    if (!user.refId || !recordBranch) {
      skipped.noRef += 1;
      continue;
    }
    const branchId = BRANCH_ID ? new mongoose.Types.ObjectId(BRANCH_ID) : recordBranch;
    if (BRANCH_ID) skipped.overridden += 1;
    if (APPLY) {
      await users.updateOne({ _id: user._id }, { $set: { branchId } });
    }
    assigned += 1;
  }

  console.log(`  would assign / assigned: ${assigned}`);
  console.log(`  skipped, no refId on file: ${skipped.noRef}`);
  console.log(`  skipped, record has no branch: ${skipped.noBranchOnRecord}`);
  if (skipped.overridden) console.log(`  assigned via --branch override: ${skipped.overridden}`);
  console.log(`\n  school-wide by design (untouched): ${SCHOOL_WIDE_ROLES.join(", ")}`);

  await auth.close();
  await students.close();
  await staff.close();
})().catch((err) => {
  console.error("assign-branches failed:", err.message);
  process.exit(1);
});
