/**
 * Branch backfill + index migration.
 *
 * Branches are the one piece of the multi-branch rollout that cannot be done
 * lazily inside a request, because it touches every service's database and the
 * unique indexes that today assume a school has exactly one academic structure.
 *
 * What it does, in order:
 *   1. For every school in erp_auth, ensure a Branch exists. The first one is
 *      named after the school and flagged as its head office, so the backfill
 *      target below always exists.
 *   2. In every service database, stamp `branchId` on the rows that predate
 *      branch scoping (branchId: null) with that school's head-office branch.
 *      Rows already carrying a branch are left alone, so re-running is safe.
 *   3. Drop the old school-wide unique indexes and build their branch-aware
 *      replacements. This MUST happen after step 2: the new indexes treat a
 *      null branchId as its own value, so backfilling first is what stops two
 *      backfilled rows from colliding.
 *
 * Usage:
 *   node scripts/backfill-branches.js              (dry run â€” prints the plan)
 *   node scripts/backfill-branches.js --apply      (writes + swaps indexes)
 *   node scripts/backfill-branches.js --apply --only=erp_academic
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "0.0.0.0"]);
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY_DB = onlyArg ? onlyArg.split("=")[1].trim() : null;

// Collections that gain a `branchId`, per service database.
const { BRANCH_SCOPED_COLLECTIONS: BRANCH_SCOPED } = require("../shared/src/branchScopedCollections");
// Old (school-wide) unique index -> new (branch-aware) index, per collection.
// Only indexes that assume "one academic structure per school" are listed: the
// per-student ones (attendance, marks, fee invoices) stay as they are, because
// a student belongs to exactly one branch already.
const INDEX_MIGRATIONS = {
  schoolclasses: [
    { from: { schoolId: 1, key: 1 }, to: { schoolId: 1, branchId: 1, key: 1 }, unique: true },
  ],
  schoolsections: [
    { from: { schoolId: 1, className: 1, key: 1 }, to: { schoolId: 1, branchId: 1, className: 1, key: 1 }, unique: true },
  ],
  schoolsubjects: [
    {
      from: { scope: 1, schoolId: 1, className: 1, normalizedName: 1 },
      to: { scope: 1, schoolId: 1, branchId: 1, className: 1, normalizedName: 1 },
      unique: true,
      partialFilterExpression: { scope: "tenant" },
    },
  ],
  timetables: [
    { from: { schoolId: 1, class: 1, section: 1, day: 1 }, to: { schoolId: 1, branchId: 1, class: 1, section: 1, day: 1 }, unique: true },
  ],
  rooms: [
    { from: { schoolId: 1, key: 1 }, to: { schoolId: 1, branchId: 1, key: 1 }, unique: true },
  ],
  feestructures: [
    { from: { schoolId: 1, session: 1, class: 1, feeType: 1 }, to: { schoolId: 1, branchId: 1, session: 1, class: 1, feeType: 1 }, unique: true },
  ],
  busroutes: [
    { from: { schoolId: 1, routeNo: 1 }, to: { schoolId: 1, branchId: 1, routeNo: 1 }, unique: true },
  ],
  teacherassignments: [
    {
      from: { schoolId: 1, session: 1, class: 1, section: 1, type: 1 },
      to: { schoolId: 1, branchId: 1, session: 1, class: 1, section: 1, type: 1 },
      unique: true,
      partialFilterExpression: { status: "active", type: "class_teacher" },
      name: "uniq_active_class_teacher",
    },
    {
      from: { schoolId: 1, staffId: 1, session: 1, subject: 1, class: 1, section: 1 },
      to: { schoolId: 1, branchId: 1, staffId: 1, session: 1, subject: 1, class: 1, section: 1 },
      unique: true,
      partialFilterExpression: { status: "active", type: "teaching" },
      name: "uniq_active_teaching",
    },
  ],
  marks: [
    { from: { schoolId: 1, studentId: 1, examId: 1, subject: 1 }, to: { schoolId: 1, branchId: 1, studentId: 1, examId: 1, subject: 1 }, unique: true },
  ],
};

const log = (...args) => console.log(...args);

/**
 * Collections whose legacy rows belong to a campus that can be READ OFF A
 * RELATION, so stamping them with the school's head office would file real
 * records under the wrong campus. Fee money follows the invoice it settles, and
 * per-student records follow the student they describe.
 *
 * `lookup` picks the resolver; see loadBranchLookup. Anything not listed here
 * (admissionenquiries, for instance - an enquiry has no student yet, so there is
 * nothing to derive from) deliberately takes the head-office default.
 */
const DERIVED_BRANCH = {
  payments: { lookup: "feeInvoice" },
  // A payment order with no invoice is a school-level subscription upgrade, not
  // a fee collection: those stay null on purpose, exactly as the service writes
  // them, so `allowNullBranch` keeps the backfill from misfiling them.
  paymentorders: { lookup: "feeInvoice", allowNullBranch: true },
  studentacademicrecords: { lookup: "student" },
  achievements: { lookup: "student" },
  behaviorrecords: { lookup: "student" },
};

/**
 * Build a lookup from the owning row to its campus.
 * Missing key -> undefined (no such parent row); a parent whose branchId is null
 * maps to null (parent exists but is itself unstamped), which the caller reports
 * separately from a missing parent.
 */
async function loadBranchLookup(kind) {
  if (kind === "feeInvoice") {
    const conn = await connect("erp_fee");
    try {
      const rows = await conn.db
        .collection("feeinvoices")
        .find({}, { projection: { branchId: 1 } })
        .toArray();
      return new Map(rows.map((r) => [String(r._id), r.branchId || null]));
    } finally {
      await conn.close();
    }
  }
  if (kind === "student") {
    // Cross-database: the academic collections live in erp_academic while the
    // students they describe live in erp_student, so the campus has to be read
    // out of the other connection and keyed by school + admissionNo.
    const conn = await connect("erp_student");
    try {
      const rows = await conn.db
        .collection("students")
        .find({}, { projection: { schoolId: 1, admissionNo: 1, branchId: 1 } })
        .toArray();
      return new Map(rows.map((s) => [`${s.schoolId}|${s.admissionNo}`, s.branchId || null]));
    } finally {
      await conn.close();
    }
  }
  throw new Error(`unknown derived-branch lookup: ${kind}`);
}

function uriFor(dbName) {
  const map = {
    erp_auth: process.env.AUTH_MONGODB_URI,
    erp_student: process.env.STUDENT_MONGODB_URI,
    erp_staff: process.env.STAFF_MONGODB_URI,
    erp_academic: process.env.ACADEMIC_MONGODB_URI,
    erp_fee: process.env.FEE_MONGODB_URI,
    erp_communication: process.env.COMMUNICATION_MONGODB_URI,
    erp_library: process.env.LIBRARY_MONGODB_URI,
    erp_facility: process.env.FACILITY_MONGODB_URI,
  };
  return map[dbName];
}

const keyOf = (spec) => Object.entries(spec).map(([k, v]) => `${k}_${v}`).join("_");

// `collection.indexExists()` was removed in driver 6, so index presence is read
// off listIndexes() instead.
async function indexNames(coll) {
  try {
    return new Set((await coll.indexes()).map((i) => i.name));
  } catch {
    return new Set();
  }
}

async function connect(dbName) {
  const uri = uriFor(dbName);
  if (!uri) throw new Error(`No Mongo URI configured for ${dbName}`);
  return mongoose.createConnection(uri, { maxPoolSize: 2 }).asPromise();
}

// â”€â”€ Step 1: one head-office branch per school â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function ensureBranches() {
  const conn = await connect("erp_auth");
  const db = conn.db;
  const schools = await db.collection("schools").find({}).project({ name: 1, code: 1, city: 1, state: 1, address: 1 }).toArray();
  log(`\n[1] schools found: ${schools.length}`);

  const branchBySchool = new Map();

  for (const school of schools) {
    const existing = await db
      .collection("branches")
      .findOne({ schoolId: school._id, isDeleted: false }, { sort: { createdAt: 1 } });
    if (existing) {
      branchBySchool.set(String(school._id), existing._id);
      continue;
    }

    // First branch mirrors the school itself â€” the campus the school was
    // registered at, so admins see familiar details instead of a blank form.
    const code = String(school.code || school.name || "main")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "main";
    // A dry run still mints the id so step 2 can report real row counts against
    // the branch the apply run would create.
    const doc = {
      _id: new mongoose.Types.ObjectId(),
      schoolId: school._id,
      name: school.name || "Main Campus",
      code,
      city: school.city || null,
      state: school.state || null,
      address: school.address || null,
      country: "India",
      isHeadOffice: true,
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (APPLY) {
      const res = await db.collection("branches").insertOne(doc);
      doc._id = res.insertedId;
    }
    branchBySchool.set(String(school._id), doc._id);
    log(`    ${APPLY ? "created" : "would create"} branch "${doc.name}" (${code}) for school ${school.name}`);
  }

  // Users keep a null branchId (school-wide) unless assigned later; the head
  // office is only the backfill target, not an implicit assignment.
  await conn.close();
  return branchBySchool;
}

// â”€â”€ Step 2: stamp branchId on pre-scoping rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/**
 * Stamp one derived collection, grouping rows by target branch so each branch
 * costs a single updateMany instead of one write per document.
 */
async function backfillDerived(coll, collName, spec, branchBySchool) {
  const lookup = await loadBranchLookup(spec.lookup);
  const docs = await coll
    .find({ branchId: null })
    .project({ schoolId: 1, invoiceId: 1, studentId: 1 })
    .toArray();

  const byBranch = new Map();
  let keptNull = 0;
  let parentUnstamped = 0;
  let missingParent = 0;
  let noHeadOffice = 0;

  for (const d of docs) {
    // A fee order with no invoice is a school-level subscription upgrade rather
    // than a fee collection, so it stays null exactly as the service writes it.
    if (spec.lookup === "feeInvoice" && !d.invoiceId) {
      if (spec.allowNullBranch) {
        keptNull += 1;
        continue;
      }
    }
    const key =
      spec.lookup === "feeInvoice"
        ? d.invoiceId && String(d.invoiceId)
        : `${d.schoolId}|${d.studentId}`;
    const parentBranch = key ? lookup.get(key) : undefined;
    if (parentBranch) {
      const list = byBranch.get(parentBranch) || [];
      list.push(d._id);
      byBranch.set(parentBranch, list);
      continue;
    }
    // No usable branch on the owning record: fall back to the head office, but
    // tell the operator which of the two ways that happened.
    if (lookup.has(key)) parentUnstamped += 1;
    else missingParent += 1;
    const headOffice = branchBySchool.get(String(d.schoolId));
    if (!headOffice) {
      noHeadOffice += 1;
      continue;
    }
    const list = byBranch.get(headOffice) || [];
    list.push(d._id);
    byBranch.set(headOffice, list);
  }

  let written = 0;
  for (const [branchId, ids] of byBranch) {
    if (APPLY) {
      const res = await coll.updateMany(
        { _id: { $in: ids }, branchId: null },
        { $set: { branchId, updatedAt: new Date() } },
      );
      written += res.modifiedCount;
    } else {
      written += ids.length;
    }
  }

  log(
    `    ${APPLY ? "stamped" : "would stamp"} ${collName}: ${written} row(s) from the owning record`,
  );
  if (keptNull) {
    log(`      kept ${keptNull} row(s) at branchId null (school-level, no owning record)`);
  }
  if (parentUnstamped) {
    log(`      ! ${parentUnstamped} row(s) had an owning record with no branch - used head office`);
  }
  if (missingParent) {
    log(`      ! ${missingParent} row(s) had no matching owning record - used head office`);
  }
  if (noHeadOffice) {
    log(`      ! ${noHeadOffice} row(s) left untouched (school has no head-office branch)`);
  }
}

async function backfillCollections(branchBySchool) {
  const dbs = ONLY_DB ? [ONLY_DB] : Object.keys(BRANCH_SCOPED);

  for (const dbName of dbs) {
    const collections = BRANCH_SCOPED[dbName];
    if (!collections) continue;

    const conn = await connect(dbName);
    const existing = new Set((await conn.db.listCollections().toArray()).map((c) => c.name));
    log(`\n[2] ${dbName}`);

    for (const collName of Object.keys(collections)) {
      if (!existing.has(collName)) {
        log(`    skip ${collName} (collection not present)`);
        continue;
      }
      const coll = conn.db.collection(collName);

      // Count instead of sampling one document: a collection can be partially
      // stamped, and a sample would either skip the unstamped remainder or redo
      // work that is already done.
      const pending = await coll.countDocuments({ branchId: null });
      if (!pending) {
        log(`    ${collName}: nothing to stamp`);
        continue;
      }

      const derived = DERIVED_BRANCH[collName];
      if (derived) {
        await backfillDerived(coll, collName, derived, branchBySchool);
        continue;
      }

      const schoolIds = await coll.distinct("schoolId");
      let total = 0;
      for (const schoolId of schoolIds) {
        const branchId = branchBySchool.get(String(schoolId));
        if (!branchId) {
          log(`    ! ${collName}: no head-office branch for school ${schoolId} â€” left untouched`);
          continue;
        }
        if (APPLY) {
          const res = await coll.updateMany(
            { schoolId, branchId: null },
            { $set: { branchId, updatedAt: new Date() } },
          );
          total += res.modifiedCount;
        } else {
          total += await coll.countDocuments({ schoolId, branchId: null });
        }
      }
      log(`    ${APPLY ? "stamped" : "would stamp"} ${collName}: ${total} row(s) (head office)`);
    }

    await conn.close();
  }
}

// â”€â”€ Step 3: swap the school-wide unique indexes for branch-aware ones â”€â”€â”€â”€â”€â”€â”€
async function migrateIndexes() {
  const dbs = ONLY_DB ? [ONLY_DB] : Object.keys(BRANCH_SCOPED);

  for (const dbName of dbs) {
    const collectionsForDb = Object.keys(BRANCH_SCOPED[dbName] || {});
    const targets = Object.keys(INDEX_MIGRATIONS).filter((c) => collectionsForDb.includes(c));
    if (!targets.length) continue;

    const conn = await connect(dbName);
    const existing = new Set((await conn.db.listCollections().toArray()).map((c) => c.name));
    log(`\n[3] ${dbName} indexes`);

    for (const collName of targets) {
      if (!existing.has(collName)) continue;
      const coll = conn.db.collection(collName);
      const names = await indexNames(coll);
      for (const migration of INDEX_MIGRATIONS[collName]) {
        const oldKey = keyOf(migration.from);
        const newKey = keyOf(migration.to);
        const newName = migration.name || newKey;
        const hasOld = names.has(oldKey);
        const hasNew = names.has(newName);

        if (APPLY) {
          if (hasOld) {
            await coll.dropIndex(oldKey);
            log(`    ${collName}: dropped ${oldKey}`);
          }
          if (!hasNew) {
            await coll.createIndex(migration.to, {
              unique: !!migration.unique,
              ...(migration.partialFilterExpression ? { partialFilterExpression: migration.partialFilterExpression } : {}),
              name: newName,
            });
            log(`    ${collName}: built   ${newName}`);
          }
        } else {
          log(`    ${collName}: ${hasOld ? "would drop" : "no old "} ${oldKey} -> ${hasNew ? "already built" : "would build"} ${newName}`);
        }
      }
    }

    await conn.close();
  }
}

(async () => {
  log(APPLY ? "=== APPLYING branch backfill ===" : "=== DRY RUN (pass --apply to write) ===");
  try {
    const branchBySchool = await ensureBranches();
    await backfillCollections(branchBySchool);
    await migrateIndexes();
    log(`\n${APPLY ? "Done." : "Dry run complete â€” re-run with --apply to make these changes."}`);
  } catch (err) {
    console.error("\nbackfill-branches failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
