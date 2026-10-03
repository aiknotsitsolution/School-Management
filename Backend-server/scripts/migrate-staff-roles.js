/**
 * Staff role collapse migration.
 *
 * The Teachers & Staff record used to carry three `role` values:
 * "teacher", "admin-staff" and "support". The two non-teaching values were
 * collapsed into a single "staff" role — the distinction between an accountant,
 * a librarian and a receptionist lives in `designation`, which is what the RBAC
 * layer already keys off (see shared/src/utils/permissions.js).
 *
 * This script rewrites every legacy "admin-staff" / "support" value to "staff"
 * in each service's `staffs` collection. It must run BEFORE the tightened
 * Mongoose enums are deployed, otherwise saving a not-yet-migrated document
 * fails enum validation.
 *
 * Usage:
 *   node scripts/migrate-staff-roles.js            (dry run — prints the plan)
 *   node scripts/migrate-staff-roles.js --apply    (writes the changes)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { MongoClient } = require("mongodb");
const { resolveDbUri } = require("./lib/atlasSrv");

const APPLY = process.argv.includes("--apply");

const LEGACY_ROLES = ["admin-staff", "support"];
const VALID_ROLES = ["teacher", "staff"];

const SERVICES = [
  ["AUTH_MONGODB_URI", "erp_auth"],
  ["STUDENT_MONGODB_URI", "erp_student"],
  ["STAFF_MONGODB_URI", "erp_staff"],
  ["ACADEMIC_MONGODB_URI", "erp_academic"],
  ["FEE_MONGODB_URI", "erp_fee"],
  ["COMMUNICATION_MONGODB_URI", "erp_communication"],
  ["LIBRARY_MONGODB_URI", "erp_library"],
  ["FACILITY_MONGODB_URI", "erp_facility"],
  ["ACCOUNTING_MONGODB_URI", "erp_accounting"],
];

async function migrateDatabase(name, uri) {
  if (!uri || !String(uri).trim()) {
    console.log(`[${name}] no URI configured — skipped`);
    return { migrated: 0, unknown: 0 };
  }
  const client = new MongoClient(await resolveDbUri(uri), { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const db = client.db();
    const collections = await db.listCollections({ name: "staffs" }, { nameOnly: true }).toArray();
    if (!collections.length) {
      console.log(`[${name}] no staffs collection — skipped`);
      return { migrated: 0, unknown: 0 };
    }
    const staff = db.collection("staffs");

    // Anything that is neither a valid role nor a legacy role deserves a look
    // before we quietly rewrite it.
    const unknown = await staff
      .find({ role: { $nin: [...VALID_ROLES, ...LEGACY_ROLES] } })
      .project({ _id: 1, employeeId: 1, role: 1 })
      .toArray();

    const perRole = {};
    for (const role of LEGACY_ROLES) {
      perRole[role] = await staff.countDocuments({ role });
    }

    const total = Object.values(perRole).reduce((a, b) => a + b, 0);
    if (total) {
      const breakdown = LEGACY_ROLES.map((r) => `${r}: ${perRole[r]}`).join(", ");
      console.log(`[${name}] ${total} legacy staff role(s) — ${breakdown}`);
      if (APPLY) {
        const res = await staff.updateMany(
          { role: { $in: LEGACY_ROLES } },
          { $set: { role: "staff" } },
        );
        console.log(`[${name}] updated ${res.modifiedCount} document(s)`);
      }
    } else {
      console.log(`[${name}] nothing to migrate`);
    }

    if (unknown.length) {
      console.log(`[${name}] WARNING: ${unknown.length} staff row(s) with an unrecognised role:`);
      for (const u of unknown) console.log(`    ${u.employeeId || u._id}: "${u.role}"`);
    }

    return { migrated: APPLY ? total : 0, unknown: unknown.length };
  } finally {
    await client.close();
  }
}

(async () => {
  console.log(`Staff role migration — ${APPLY ? "APPLY" : "DRY RUN"}\n`);
  let migrated = 0;
  let unknown = 0;
  for (const [envKey, label, fallbackKey] of SERVICES) {
    const uri = process.env[envKey] || (fallbackKey ? process.env[fallbackKey] : null);
    const res = await migrateDatabase(label, uri);
    migrated += res.migrated;
    unknown += res.unknown;
  }
  console.log(`\nDone. migrated=${migrated}, unknown=${unknown}`);
  if (!APPLY) console.log("Re-run with --apply to write these changes.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
