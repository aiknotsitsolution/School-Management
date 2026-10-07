/**
 * Remove "Half Day" from student attendance.
 *
 * Two things live in erp_academic and both have to go:
 *
 *   1. attendancestatuses — the Half Day entry of the Attendance Statuses
 *      master (ManageSchool, currently spelled "HD"). This is what put an HD
 *      button on the student register. Staff marking keeps offering Half Day
 *      from its own code-level list (Admin-panel src/pages/Attendance.jsx
 *      `STAFF_STATUSES`) because staff-service payroll still computes
 *      half-day penalties on it.
 *   2. attendances — student attendance rows already marked "Half Day". The
 *      Mongoose enum (models/Attendance.js) only accepts Present / Absent /
 *      Leave now, so these rows are orphans.
 *
 * Staff attendance (erp_staff) is NOT touched.
 *
 * Usage:
 *   node scripts/remove-student-half-day.js                      (dry run)
 *   node scripts/remove-student-half-day.js --apply              (writes both)
 *   node scripts/remove-student-half-day.js --apply --master-only   (master only)
 *   node scripts/remove-student-half-day.js --apply --records-only  (rows only)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { MongoClient } = require("mongodb");
const { resolveDbUri } = require("./lib/atlasSrv");

const APPLY = process.argv.includes("--apply");
const MASTER_ONLY = process.argv.includes("--master-only");
const RECORDS_ONLY = process.argv.includes("--records-only");

if (MASTER_ONLY && RECORDS_ONLY) {
  console.error("--master-only and --records-only cannot be combined");
  process.exit(1);
}

const DO_MASTER = !RECORDS_ONLY;
const DO_RECORDS = !MASTER_ONLY;

// The master has carried a few spellings of the same bucket — "Half Day",
// "HD" (what ManageSchool actually shows today) and the seeded "Late" — all of
// which the register used to render as an HD button.
const HALF_DAY_FILTER = {
  $or: [
    { key: { $regex: /^(hd|half[\s_-]?day)$/i } },
    { name: { $regex: /^\s*(hd|half[\s_-]?day)\s*$/i } },
  ],
};

const findCollection = (names, matcher) =>
  names.find((n) => matcher.test(n)) || null;

async function run() {
  const uri = process.env.ACADEMIC_MONGODB_URI;
  if (!uri || !String(uri).trim()) {
    console.log("ACADEMIC_MONGODB_URI is not configured — nothing to do");
    return;
  }
  const client = new MongoClient(await resolveDbUri(uri), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  try {
    const db = client.db();
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);

    if (DO_MASTER) {
      // mongoose model "AttendanceStatus" → "attendancestatuses"
      const masterName = findCollection(names, /^attendancestatuses?$/i);
      if (!masterName) {
        console.log("[master] no attendance status collection — skipped");
      } else {
        const master = db.collection(masterName);
        const matches = await master.find(HALF_DAY_FILTER).project({ name: 1, key: 1, schoolId: 1 }).toArray();
        if (!matches.length) {
          console.log("[master] no \"Half Day\" attendance status entries — nothing to remove");
        } else {
          console.log(`[master] ${matches.length} "Half Day" entry/entries in ${masterName}:`);
          for (const m of matches) console.log(`    ${m.schoolId} · "${m.name}" (key: ${m.key})`);
          if (APPLY) {
            const res = await master.deleteMany(HALF_DAY_FILTER);
            console.log(`[master] deleted ${res.deletedCount} document(s)`);
          }
        }
      }
    }

    if (DO_RECORDS) {
      const attName = findCollection(names, /^attendances$/i);
      if (!attName) {
        console.log("[records] no attendance collection — skipped");
      } else {
        const attendance = db.collection(attName);
        const filter = { status: { $regex: /^\s*Half\s*Day\s*$/i } };
        const total = await attendance.countDocuments(filter);
        if (!total) {
          console.log("[records] no student rows marked \"Half Day\" — nothing to remove");
        } else {
          const sample = await attendance
            .find(filter)
            .project({ studentId: 1, class: 1, section: 1, date: 1 })
            .limit(5)
            .toArray();
          console.log(`[records] ${total} student row(s) marked "Half Day" in ${attName}, e.g.:`);
          for (const r of sample) {
            console.log(`    ${r.studentId} · Class ${r.class}-${r.section} · ${new Date(r.date).toISOString().slice(0, 10)}`);
          }
          if (APPLY) {
            const res = await attendance.deleteMany(filter);
            console.log(`[records] deleted ${res.deletedCount} document(s)`);
          }
        }
      }
    }
  } finally {
    await client.close();
  }
}

(async () => {
  console.log(`Remove Half Day from student attendance — ${APPLY ? "APPLY" : "DRY RUN"}\n`);
  await run();
  if (!APPLY) console.log("\nRe-run with --apply to write these changes.");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
