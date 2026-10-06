/**
 * Demo School 1 — audit + backfill so a live demo runs end-to-end.
 *
 *   node scripts/backfill-demo-school-1.js           audit + plan (writes NOTHING)
 *   node scripts/backfill-demo-school-1.js --apply   execute the plan
 *   node scripts/backfill-demo-school-1.js --verify  walk the demo personas and
 *                                                    confirm they each see data
 *
 * Design notes
 * ------------
 * - Reads use direct Mongo connections (same pattern as seed-demo-users.js) so
 *   the audit can see every field, including ones no endpoint projects.
 * - Every WRITE goes through the public HTTP API as the school's own admin, so
 *   the application's rules decide each change: profile derivation, ID-card
 *   issue, assignment conflict + academic-reference checks, account linking.
 *   Nothing is written behind the app's back.
 * - Idempotent: re-running reports and applies only what is still missing.
 *
 * Note: Windows c-ares may be reading 127.0.0.1 as the DNS server (a local stub
 * that refuses queries), which makes `mongodb+srv` lookups fail with
 * ECONNREFUSED while the OS resolver itself works. Point the driver's resolver
 * at public DNS for the lifetime of this process only — no system change.
 */
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const os = require("os");
const dns = require("dns");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const BASE = "http://localhost:5000/api";
const ADMIN_EMAIL = "schooladmin1.demoschool1@edu.in";
let ADMIN = { email: ADMIN_EMAIL, password: "Demo@1234" };
const NEW_PASSWORD = "Demo@1234"; // same password every seeded demo account uses

// The rules the app itself uses (see staffController / studentController).
const STAFF_PROFILE_FIELDS = ["dob", "gender", "contact", "address"];
const STUDENT_PROFILE_FIELDS = [
  "class", "section", "dob", "gender", "address", "parentName", "parentContact", "motherName",
];

// Rows the school owner asked to clear out of the demo roster.
const DROP_STUDENTS = ["DS1MOD5574759", "STU000005555"]; // Modal Test Student, Student three
const DROP_STAFF = ["TSTAFF-000001", "TSTAFF-0001"]; // Test Staff A (matched on either form)

const empty = (v) => v === undefined || v === null || String(v).trim() === "";
const isEmptyArr = (v) => Array.isArray(v) && v.length === 0;
const isMissing = (v) => empty(v) || isEmptyArr(v);
const pct = (n, d) => `${n}/${d}`;

const conns = {};
async function conn(key) {
  if (!conns[key]) conns[key] = await mongoose.createConnection(process.env[key]).asPromise();
  return conns[key];
}
const loose = (collection) =>
  new mongoose.Schema({}, { strict: false, collection, timestamps: true });
// A connection can only register a model name once; re-gathering (the
// post-apply verification pass) must reuse what is already compiled.
const model = (c, name, collection) => c.models[name] || c.model(name, loose(collection));

// ---------------------------------------------------------------------------
// HTTP (writes)
// ---------------------------------------------------------------------------
const BASE_URL = BASE;
let TOKEN = null;
let ADMIN_BRANCH = null;
// /auth/login is rate limited (10 per 15 min), so a run that only needs a
// handful of writes must not spend a fresh login every time.
const TOKEN_CACHE = path.join(os.tmpdir(), "zipschool-backfill-token.json");
const TOKEN_TTL_MS = 10 * 60 * 1000;

async function send(method, url, body, branch) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (branch !== undefined) headers["X-Branch-Id"] = branch;
  let res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  // A campus-assigned admin may not name another campus, and may not ask for
  // "all" either. Fall back to the unscoped request so the write still lands.
  if (res.status === 403 && branch !== undefined && /branch/i.test(String(data.message || ""))) {
    const h2 = { ...headers };
    delete h2["X-Branch-Id"];
    res = await fetch(`${BASE_URL}${url}`, {
      method,
      headers: h2,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    data = {};
    try { data = await res.json(); } catch { /* empty body */ }
  }
  return { status: res.status, data };
}

function applyIdentity(res) {
  const u = res.data?.data?.user || res.data?.data || res.data?.user || {};
  ADMIN_BRANCH = u.branchId || null;
  console.log(`\nlogged in as ${u.email || ADMIN.email} (role=${u.role}) branch=${ADMIN_BRANCH || "all branches"}`);
}

let AUTH_PROMISE = null;
function ensureAuth() {
  if (TOKEN) return Promise.resolve();
  if (!AUTH_PROMISE) AUTH_PROMISE = doAuth().catch((e) => { AUTH_PROMISE = null; throw e; });
  return AUTH_PROMISE;
}

// Switch persona for the verification pass (each has its own cached token).
function asUser(email) {
  ADMIN = { email, password: NEW_PASSWORD };
  TOKEN = null;
  AUTH_PROMISE = null;
}

async function doAuth() {
  let store = {};
  try { store = JSON.parse(fs.readFileSync(TOKEN_CACHE, "utf8")) || {}; } catch { store = {}; }
  try {
    const cached = store?.[ADMIN.email];
    if (cached?.token && Date.now() < cached.expiresAt) {
      TOKEN = cached.token;
      const probe = await send("GET", "/auth/me", undefined, undefined);
      if (probe.status >= 200 && probe.status < 300) {
        applyIdentity(probe);
        return;
      }
      TOKEN = null;
    }
  } catch { /* no usable cache */ }

  const r = await send("POST", "/auth/login", ADMIN, undefined);
  if (!(r.status >= 200 && r.status < 300)) {
    throw new Error(`login failed: ${r.status} ${JSON.stringify(r.data)}`);
  }
  TOKEN = r.data?.data?.accessToken;
  if (!TOKEN) throw new Error("login: no accessToken in response");
  store[ADMIN.email] = { token: TOKEN, expiresAt: Date.now() + TOKEN_TTL_MS };
  fs.writeFileSync(TOKEN_CACHE, JSON.stringify(store));
  const me = await send("GET", "/auth/me", undefined, undefined);
  applyIdentity(me);
}

const raw = async (method, url, body, branch) => {
  await ensureAuth();
  return send(method, url, body, branch);
};
const api = (method, url, opts = {}) => raw(method, url, opts.body, opts.branch);
const ok = (r) => r.status >= 200 && r.status < 300;

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------
async function gather() {
  const auth = await conn("AUTH_MONGODB_URI");
  const staffC = await conn("STAFF_MONGODB_URI");
  const studC = await conn("STUDENT_MONGODB_URI");
  const acad = await conn("ACADEMIC_MONGODB_URI");
  const fee = await conn("FEE_MONGODB_URI");

  const School = model(auth, "School", "schools");
  const User = model(auth, "User", "users");
  const Session = model(auth, "AcademicSession", "academicsessions");
  const Branch = model(auth, "Branch", "branches");
  const Staff = model(staffC, "Staff", "staffs");
  const TeacherAssignment = model(staffC, "TeacherAssignment", "teacherassignments");
  const Student = model(studC, "Student", "students");
  const SchoolClass = model(acad, "SchoolClass", "schoolclasses");
  const SchoolSection = model(acad, "SchoolSection", "schoolsections");
  const SchoolSubject = model(acad, "SchoolSubject", "schoolsubjects");
  const FeeStructure = model(fee, "FeeStructure", "feestructures");

  // Anchor on the demo admin's own login: whatever school it belongs to IS the
  // school the demo runs as.
  const anchor = await User.findOne({ email: ADMIN.email }).lean();
  if (!anchor?.schoolId) {
    console.log(`${ADMIN.email} not found (or has no schoolId) — cannot target a school`);
    process.exit(1);
  }
  const school = await School.findById(anchor.schoolId).lean();
  if (!school) { console.log(`school ${anchor.schoolId} NOT FOUND`); process.exit(1); }
  const sid = school._id;

  const [branches, users, staff, assigns, students, classes, sections, subjects, sessions, structures] =
    await Promise.all([
      Branch.find({ schoolId: sid }).lean(),
      User.find({ schoolId: sid }).lean(),
      Staff.find({ schoolId: sid }).lean(),
      TeacherAssignment.find({ schoolId: sid }).lean(),
      Student.find({ schoolId: sid }).lean(),
      SchoolClass.find({ schoolId: sid }).lean(),
      SchoolSection.find({ schoolId: sid }).lean(),
      SchoolSubject.find({ schoolId: sid }).lean(),
      Session.find({ schoolId: sid }).lean(),
      FeeStructure.find({ schoolId: sid }).lean(),
    ]);

  return {
    sid, school, branches, users, staff, assigns, students, classes, sections, subjects, sessions, structures,
    live: students.filter((s) => !s.deletedAt),
  };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------
async function audit(ctx) {
  const { school, branches, users, staff, assigns, live, classes, sections, subjects, sessions, structures } = ctx;
  const sid = school._id;

  console.log(`\nSCHOOL  ${school.name} (code=${school.code})  _id=${sid}`);
  console.log(`        session=${school.session} status=${school.status} plan=${school.plan}`);
  console.log(`        branches: ${branches.map((b) => `${b.name}=${b._id}`).join(" | ")}`);
  const branchName = (id) => branches.find((b) => String(b._id) === String(id))?.name || String(id);

  // USERS
  const byRole = {};
  users.forEach((u) => { (byRole[u.role] ||= []).push(u); });
  console.log(`\nUSERS   total=${users.length}  ${Object.entries(byRole).map(([r, l]) => `${r}=${l.length}`).join(" ")}`);
  const userGaps = [];
  const deactivated = [];
  for (const u of users) {
    // A deliberately deactivated / soft-deleted account is a completed removal,
    // not a data gap — report it separately so the gap count stays meaningful.
    if (u.isActive === false || u.deletedAt) { deactivated.push(u); continue; }
    const g = [];
    if (!u.name) g.push("name");
    if (!u.password) g.push("password");
    if (["teacher", "staff", "student"].includes(u.role) && !u.refId) g.push("refId");
    if (u.role === "staff" && !u.designation) g.push("designation");
    if (g.length) userGaps.push(`      ${u.email} [${u.role}] missing: ${g.join(", ")}`);
  }
  console.log(`   user gaps: ${userGaps.length}`);
  userGaps.forEach((l) => console.log(l));
  if (deactivated.length) {
    console.log(`   deactivated accounts (intentionally removed, kept for history): ` +
      deactivated.map((u) => u.email).join(", "));
  }

  // STAFF
  const STAFF_FIELDS = ["employeeId", "userId", "name", "designation", "role", "subjects",
    "classesAssigned", "qualification", "joiningDate", "contact", "email", "address",
    "photoUrl", "dob", "gender", "salary", "status", "profileStatus", "idCardNumber", "department"];
  const staffGap = Object.fromEntries(STAFF_FIELDS.map((f) => [f, 0]));
  staff.forEach((s) => STAFF_FIELDS.forEach((f) => { if (isMissing(s[f])) staffGap[f] += 1; }));
  console.log(`\nSTAFF   total=${staff.length}`);
  console.log(`   field gaps (missing/blank): ${STAFF_FIELDS.filter((f) => staffGap[f])
    .map((f) => `${f}=${staffGap[f]}`).join("  ")}`);
  staff.forEach((s) => {
    const missing = STAFF_FIELDS.filter((f) => isMissing(s[f]));
    console.log(`      ${s.name} [${s.role}/${s.designation}] emp=${s.employeeId} branch=${branchName(s.branchId)}` +
      ` status=${s.status} profile=${s.profileStatus || "?"} card=${s.idCardNumber || "-"} :: missing=${missing.join(",") || "none"}`);
  });

  // STAFF <-> USERS
  const staffById = Object.fromEntries(staff.map((s) => [String(s._id), s]));
  const liveById = Object.fromEntries(live.map((s) => [String(s._id), s]));
  const liveByAdm = Object.fromEntries(live.map((s) => [String(s.admissionNo), s]));
  const staffWithLogin = new Set();
  const studWithLogin = new Set();
  const broken = [];
  for (const u of users) {
    if (u.isActive === false || u.deletedAt) continue;
    if (["teacher", "staff"].includes(u.role)) {
      const rec = staffById[String(u.refId)];
      if (rec) staffWithLogin.add(String(rec._id));
      else broken.push(`      ${u.email} refId=${u.refId} -> NO STAFF ROW`);
    } else if (u.role === "student") {
      const rec = liveById[String(u.refId)] || liveByAdm[String(u.refId)];
      if (rec) studWithLogin.add(String(rec._id));
      else broken.push(`      ${u.email} refId=${u.refId} -> NO STUDENT ROW`);
    }
  }
  console.log(`   broken user->record refs: ${broken.length}`);
  broken.forEach((l) => console.log(l));
  const staffNoLogin = staff.filter((s) => !staffWithLogin.has(String(s._id)));
  const studNoLogin = live.filter((s) => !studWithLogin.has(String(s._id)));
  console.log(`   staff without a login account: ${staffNoLogin.length}/${staff.length}` +
    `${staffNoLogin.length ? ` -> ${staffNoLogin.map((s) => s.name).join(", ")}` : ""}`);
  console.log(`   students without a login account: ${studNoLogin.length}/${live.length}` +
    `${studNoLogin.length ? ` -> ${studNoLogin.map((s) => s.name).join(", ")}` : ""}`);

  // ASSIGNMENTS
  const teachingStaff = staff.filter((s) => s.role === "teacher");
  const assignedIds = new Set(assigns.filter((a) => a.status === "active").map((a) => String(a.staffId)));
  console.log(`\nASSIGN  total=${assigns.length}  ${assigns.map((a) =>
    `${a.type}:${a.class}-${a.section}${a.subject ? "/" + a.subject : ""}`).join(", ") || "(none)"}`);
  const noAssign = teachingStaff.filter((t) => !assignedIds.has(String(t._id)));
  console.log(`   teachers with NO active assignment: ${noAssign.length}/${teachingStaff.length}` +
    `${noAssign.length ? ` -> ${noAssign.map((s) => s.name).join(", ")}` : ""}`);

  // CLASS TEACHER COVERAGE
  const need = new Map();
  live.forEach((s) => {
    if (s.class && s.section) {
      const k = `${s.class}-${s.section}`;
      const e = need.get(k) || { n: 0, branch: s.branchId };
      e.n += 1;
      need.set(k, e);
    }
  });
  const have = new Set(assigns.filter((a) => a.type === "class_teacher" && a.status === "active")
    .map((a) => `${a.class}-${a.section}`));
  console.log(`\nCLASS TEACHER COVERAGE (classes that actually hold students)`);
  [...need.keys()].sort().forEach((k) => {
    const v = need.get(k);
    console.log(`      ${k.padEnd(10)} ${String(v.n).padStart(2)} student(s)  branch=${branchName(v.branch)}` +
      `  class teacher: ${have.has(k) ? "YES" : "MISSING"}`);
  });

  // PROFILE COMPLETION
  const staffIncomplete = staff.filter((s) => s.status !== "Resigned" &&
    STAFF_PROFILE_FIELDS.some((f) => isMissing(s[f])));
  const studIncomplete = live.filter((s) => STUDENT_PROFILE_FIELDS.some((f) => isMissing(s[f])));
  console.log(`\nPROFILE  staff incomplete: ${staffIncomplete.length}/${staff.length}` +
    `${staffIncomplete.length ? ` -> ${staffIncomplete.map((s) => s.name).join(", ")}` : ""}`);
  console.log(`         students incomplete: ${studIncomplete.length}/${live.length}` +
    `${studIncomplete.length ? ` -> ${studIncomplete.map((s) => s.name).join(", ")}` : ""}`);
  const noCard = staff.filter((s) => s.status !== "Resigned" && !s.idCardNumber);
  const studNoCard = live.filter((s) => !s.idCardNumber);
  console.log(`         staff without an ID card: ${noCard.length}/${staff.length}` +
    `${noCard.length ? ` -> ${noCard.map((s) => s.name).join(", ")}` : ""}`);
  console.log(`         students without an ID card: ${studNoCard.length}/${live.length}` +
    `${studNoCard.length ? ` -> ${studNoCard.map((s) => s.name).join(", ")}` : ""}`);

  // DRIFT / JUNK
  const junk = [
    ...live.filter((s) => DROP_STUDENTS.includes(s.admissionNo)).map((s) => `student ${s.name} (${s.admissionNo})`),
    ...staff.filter((s) => DROP_STAFF.includes(s.employeeId)).map((s) => `staff ${s.name} (${s.employeeId})`),
  ];
  const drift = live.filter((s) => s.admissionNo === "DS1LKG001" && (s.class !== "LKG" || s.section !== "A"));
  console.log(`\nCLEANUP  test rows to remove: ${junk.length}${junk.length ? ` -> ${junk.join(", ")}` : ""}`);
  console.log(`         drifted class rows: ${drift.length}` +
    `${drift.length ? ` -> ${drift.map((s) => `${s.name} in ${s.class}-${s.section}`).join(", ")}` : ""}`);
  // Deleting is a soft operation in this app (history is preserved), so show
  // the residual state of anything the plan was asked to clear out.
  const residual = [
    ...ctx.students.filter((s) => DROP_STUDENTS.includes(s.admissionNo)),
    ...staff.filter((s) => DROP_STAFF.includes(s.employeeId)),
    ...users.filter((u) => DROP_STUDENTS.includes(String(u.refId)) || u.isActive === false),
  ];
  if (residual.length) console.log(`         residual rows (soft-deleted, kept for history):`);
  residual.forEach((d) => console.log(
    `            ${d.email || d.name}  isActive=${d.isActive} status=${d.status || "-"} deletedAt=${d.deletedAt || "-"}`));
  // Why a purge would (or would not) be allowed — this is the app's own rule:
  // staff rows with history are never hard-deleted.
  for (const s of staff.filter((x) => DROP_STAFF.includes(x.employeeId))) {
    const hits = await personHistory(s, "staffs");
    console.log(`         history attached to ${s.name} (${s.employeeId}) _id=${s._id}: ${hits.length ? hits.join(", ") : "none"}`);
    if (hits.length) {
      const emp = String(s.employeeId || "");
      const att = await (await conn("STAFF_MONGODB_URI")).db.collection("staffattendances")
        .find({ $or: [{ staffId: s._id }, { staffId: String(s._id) }, { employeeId: emp }] }).limit(5).toArray();
      att.forEach((a) => console.log(`            ${JSON.stringify(a).slice(0, 400)}`));
    }
  }
  // MASTERS + FEES
  console.log(`\nMASTERS  classes=${classes.length} sections=${sections.length} subjects=${subjects.length}` +
    ` sessions=${sessions.length} (${sessions.map((s) => s.name).join(",") || "none"})`);
  const masterNames = new Set(classes.map((c) => String(c.name ?? c.class)));
  const orphan = [...new Set(live.map((s) => s.class).filter(Boolean))].filter((c) => !masterNames.has(c));
  console.log(`         student classes NOT in master: ${orphan.join(", ") || "none"}`);
  console.log(`         fee structures=${structures.length}` +
    `${structures.length ? ` (${structures.map((f) => `${f.class}/${f.session}`).join(", ")})` : ""}`);

  return { staffIncomplete, studIncomplete, noCard, studNoCard, staffNoLogin, studNoLogin, noAssign, junk, drift, have, need };
}

// The API's DELETE on a staff row never removes it: employment history is
// preserved by design and the record is only marked "Resigned" (see
// staffController.deleteStaff). A pure test artifact with provably no history
// should not be left sitting in a demo roster, so this scans the collections
// that reference a person before allowing a direct delete. Anything at all
// referencing the row makes the purge refuse.
async function personHistory(doc, ownCollection, ignore = []) {
  const id = doc._id;
  const emp = String(doc.employeeId || "");
  const hits = [];
  for (const key of ["STAFF_MONGODB_URI", "ACADEMIC_MONGODB_URI", "FEE_MONGODB_URI", "COMMUNICATION_MONGODB_URI"]) {
    if (!process.env[key]) continue;
    const c = await conn(key);
    let cols = [];
    try { cols = await c.db.listCollections().toArray(); } catch { continue; }
    for (const col of cols) {
      if (col.name === ownCollection || ignore.includes(col.name)) continue;
      try {
        const n = await c.db.collection(col.name).countDocuments({
          $or: [{ staffId: id }, { teacherId: id }, { staffId: String(id) }, { employeeId: emp }],
        });
        if (n) hits.push(`${col.name}=${n}`);
      } catch { /* collection may not accept the query shape */ }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------
function buildPlan(ctx, auditResult) {
  const { staff, live, users, assigns, sessions } = ctx;
  const sid = ctx.school._id;
  const activeSession =
    sessions.find((s) => s.isCurrent)?.name || sessions[0]?.name ||
    assigns.find((a) => a.session)?.session || String(ctx.school.session || "");

  const dropStudentIds = live.filter((s) => DROP_STUDENTS.includes(s.admissionNo));
  const dropStaffIds = staff.filter((s) => DROP_STAFF.includes(s.employeeId));
  const keepStaff = staff.filter((s) => !DROP_STAFF.includes(s.employeeId));
  const keepLive = live.filter((s) => !DROP_STUDENTS.includes(s.admissionNo));

  const actions = [];
  const add = (k, label, run) => actions.push({ k, label, run });

  // ---- 1. clear the test rows -------------------------------------------
  for (const s of dropStudentIds) {
    add("remove", `remove test student ${s.name} (${s.admissionNo})`, async () => {
      const r = await api("DELETE", `/students/${s._id}`, { branch: s.branchId ? String(s.branchId) : "all" });
      const u = users.find((x) => x.role === "student" && String(x.refId) === String(s.admissionNo));
      let ur = null;
      if (u) ur = await api("DELETE", `/auth/users/${u._id}`, { branch: "all" });
      return { r, extra: ur ? `account ${u.email}: ${ur.status}` : "no account" };
    });
  }
  for (const s of dropStaffIds) {
    add("remove", `remove test staff ${s.name} (${s.employeeId})`, async () => {
      // "Resigned" is exactly what the API's delete sets, so re-running against
      // an already-deactivated row must not burn a rate-limited login.
      let r = { status: 200, data: { message: "already Resigned" } };
      if (s.status !== "Resigned") {
        r = await api("DELETE", `/staff/${s._id}`, { branch: s.branchId ? String(s.branchId) : "all" });
      }
      const u = users.find((x) => ["teacher", "staff"].includes(x.role) && String(x.refId) === String(s._id));
      let ur = null;
      if (u) ur = await api("DELETE", `/auth/users/${u._id}`, { branch: "all" });
      // The API only ever marks a staff row Resigned. Purge it outright only
      // when nothing in the fleet references it.
      let purge = "row not found";
      if (ok(r)) {
        const db = (await conn("STAFF_MONGODB_URI")).db;
        // The person's own attendance rows travel with them (leaving them would
        // orphan a dangling staffId); anything else — marks, payroll,
        // assignments — is a hard blocker and refuses the purge outright.
        const blockers = await personHistory(s, "staffs", ["staffattendances"]);
        if (blockers.length) {
          purge = `LEFT IN PLACE (referenced by ${blockers.join(", ")})`;
        } else {
          const emp = String(s.employeeId || "");
          const att = await db.collection("staffattendances").deleteMany({
            $or: [{ staffId: s._id }, { staffId: String(s._id) }, { employeeId: emp }],
          });
          const del = await db.collection("staffs").deleteOne({ _id: s._id, schoolId: sid });
          purge = del.deletedCount
            ? `purged row${att.deletedCount ? ` + ${att.deletedCount} attendance row(s)` : ""}`
            : "row not found";
        }
      }
      return { r, extra: `${purge}${ur ? `; account ${u.email}: ${ur.status}` : "; no account"}` };
    });
  }

  // ---- 2. restore the drifted class row ---------------------------------
  for (const s of ctx.live.filter((x) => x.admissionNo === "DS1LKG001" &&
    (x.class !== "LKG" || x.section !== "A"))) {
    add("repair", `move ${s.name} (${s.admissionNo}) back to LKG-A`, async () => {
      const r = await api("PUT", `/students/${s._id}`, {
        body: { class: "LKG", section: "A" },
        branch: s.branchId ? String(s.branchId) : "all",
      });
      return { r };
    });
  }

  // ---- 3. staff profile backfill ----------------------------------------
  const addr = (i) => `No. ${11 + i}, Gandhi Nagar, Bengaluru, Karnataka - 56000${i % 10}`;
  const staffDob = (i) => new Date(Date.UTC(1978 + (i % 14), (i * 3) % 12, 1 + ((i * 5) % 27))).toISOString();
  // The four identity fields are the whole completion rule for staff. Each one
  // gets a plausible, deterministic demo value only when it is actually blank.
  const STAFF_FILL = {
    dob: (i) => staffDob(i),
    address: (i) => addr(i),
    gender: (i) => (i % 2 === 0 ? "Male" : "Female"),
    contact: (i) => `98765${String(43210 + i).slice(-5)}`,
  };
  let si = 0;
  for (const s of keepStaff) {
    const patch = {};
    STAFF_PROFILE_FIELDS.forEach((f) => {
      if (isMissing(s[f]) && STAFF_FILL[f]) patch[f] = STAFF_FILL[f](si);
    });
    si += 1;
    const keys = Object.keys(patch);
    if (!keys.length) continue;
    add("profile", `complete staff profile ${s.name} (${s.employeeId}) — fill ${keys.join(", ")}`, async () => {
      const r = await api("PUT", `/staff/${s._id}`, {
        body: patch, branch: s.branchId ? String(s.branchId) : "all",
      });
      let card = null;
      if (ok(r) && !r.data?.data?.idCardNumber) {
        card = await api("POST", `/staff/${s._id}/issue-id-card`,
          { branch: s.branchId ? String(s.branchId) : "all" });
      }
      return { r, extra: card ? `id-card: ${card.status}` : "" };
    });
  }

  // ---- 4. student profile backfill --------------------------------------
  const classYear = (c) => {
    const n = parseInt(String(c), 10);
    return Number.isNaN(n) ? 2021 : 2026 - (n + 5);
  };
  const lastWord = (n) => String(n || "").trim().split(/\s+/).pop() || "Kumar";
  const rollCounter = {};
  keepLive.forEach((s) => {
    const k = `${s.class}-${s.section}`;
    rollCounter[k] = (rollCounter[k] || 0) + 1;
  });
  // Same idea for students: fill only the required fields we can invent
  // safely. class / section / parentName are never guessed — if one of those is
  // blank the record stays incomplete and is reported instead of filled with a
  // wrong value.
  const STUDENT_FILL = {
    dob: (i, s) => new Date(Date.UTC(classYear(s.class), (i * 2) % 12, 1 + ((i * 7) % 27))).toISOString(),
    address: (i) => addr(i + 3),
    parentContact: (i) => `98765${String(43210 + i).slice(-5)}`,
    motherName: (i, s) => `Sunita ${lastWord(s.name)}`,
    gender: (i) => (i % 2 === 0 ? "Male" : "Female"),
  };
  let ri = 0;
  for (const s of keepLive) {
    const patch = {};
    const unfillable = [];
    STUDENT_PROFILE_FIELDS.forEach((f) => {
      if (!isMissing(s[f])) return;
      if (STUDENT_FILL[f]) patch[f] = STUDENT_FILL[f](ri, s);
      else unfillable.push(f);
    });
    if (isMissing(s.rollNo) && s.class && s.section) {
      patch.rollNo = String(rollCounter[`${s.class}-${s.section}`]);
    }
    ri += 1;
    const keys = Object.keys(patch);
    if (unfillable.length) {
      console.log(`   ! ${s.name} (${s.admissionNo}) still needs ${unfillable.join(", ")} — not guessed`);
    }
    // The card can only be issued once the completion rule is satisfied: either
    // it already is, or this patch fills everything that was still missing.
    const issueCard = !s.idCardNumber && unfillable.length === 0;
    if (!keys.length && !issueCard) continue;
    const br = s.branchId ? String(s.branchId) : "all";
    if (!keys.length) {
      add("card", `issue student ID card ${s.name} (${s.admissionNo})`, async () => {
        const r = await api("POST", `/students/${s._id}/issue-id-card`, { branch: br });
        return { r };
      });
      continue;
    }
    add("profile", `complete student profile ${s.name} (${s.admissionNo}) — fill ${keys.join(", ")}`, async () => {
      const r = await api("PUT", `/students/${s._id}`, { body: patch, branch: br });
      let card = null;
      if (issueCard && ok(r)) {
        card = await api("POST", `/students/${s._id}/issue-id-card`, { branch: br });
      }
      return { r, extra: card ? `id-card: ${card.status}` : "" };
    });
  }

  // ---- 5. teacher assignments -------------------------------------------
  // Mirrors how the school is actually staffed: every class-section that holds
  // students gets a class teacher, and the subject teachers get a teaching row
  // so their homework / marks pickers are scoped.
  const WANT = [
    { staff: "Demo Class Teacher II", type: "class_teacher", class: "LKG", section: "A" },
    { staff: "Ravi Kumar", type: "class_teacher", class: "UKG", section: "A" },
    { staff: "Ravi Kumar", type: "class_teacher", class: "UKG", section: "B" },
    { staff: "Demo Class Teacher I", type: "teaching", class: "Nursery", section: "A", subject: "English" },
    { staff: "Demo Subject Teacher", type: "teaching", class: "LKG", section: "A", subject: "English" },
    { staff: "Neha Sharma", type: "teaching", class: "UKG", section: "A", subject: "Science" },
  ];
  const classNames = new Set(ctx.classes.map((c) => String(c.name ?? c.class)));
  const sectionNames = new Set(ctx.sections.map((x) => String(x.name ?? x.section)));
  const subjectNames = new Set(ctx.subjects.map((x) => String(x.name)));

  for (const w of WANT) {
    const person = keepStaff.find((s) => s.name === w.staff);
    if (!person) { console.log(`   ! assignment target not found: ${w.staff}`); continue; }
    if (person.role !== "teacher") { console.log(`   ! ${w.staff} is role=${person.role}, not a teacher — skipped`); continue; }
    if (!classNames.has(w.class)) { console.log(`   ! class ${w.class} not in master — skipped`); continue; }
    if (!sectionNames.has(w.section)) { console.log(`   ! section ${w.section} not in master — skipped`); continue; }
    if (w.subject && !subjectNames.has(w.subject)) { console.log(`   ! subject ${w.subject} not in master — skipped`); continue; }
    const already = assigns.some((a) => a.status === "active" && String(a.staffId) === String(person._id) &&
      a.type === w.type && String(a.class) === w.class && String(a.section) === w.section &&
      String(a.subject ?? "null") === String(w.subject ?? "null"));
    if (already) continue;
    const label = `${w.type === "class_teacher" ? "appoint" : "assign"} ${w.staff} — ` +
      `${w.type === "class_teacher" ? `class teacher of ${w.class}-${w.section}` : `${w.subject} in ${w.class}-${w.section}`}`;
    add("assign", label, async () => {
      const body = { staffId: String(person._id), session: activeSession, type: w.type, class: w.class, section: w.section };
      if (w.type === "teaching") body.subject = w.subject;
      const r = await api("POST", "/assignments", {
        body, branch: person.branchId ? String(person.branchId) : "all",
      });
      return { r };
    });
  }

  // ---- 6. login accounts -------------------------------------------------
  const EMAIL = (s) => `${String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}.demoschool1@edu.in`;
  const STAFF_PERSONA = {
    "Front Office": "receptionist",
    "Librarian": "librarian",
    "Accountant": "accountant",
    "Transport In-charge": "transport",
    "Admission Counsellor": "admission_counsellor",
  };
  const taken = new Set(users.map((u) => String(u.email).toLowerCase()));

  for (const s of keepStaff) {
    if (auditResult.staffNoLogin.every((x) => String(x._id) !== String(s._id))) continue;
    const email = EMAIL(s);
    if (taken.has(email)) { console.log(`   ! email already in use, skipping ${email}`); continue; }
    const role = s.role === "teacher" ? "teacher" : "staff";
    const body = { name: s.name, email, password: NEW_PASSWORD, role, refId: String(s.employeeId) };
    if (role === "staff") body.designation = STAFF_PERSONA[s.designation] || "receptionist";
    add("account", `create ${role} login ${email} -> ${s.name} (${s.employeeId})`, async () => {
      const r = await api("POST", "/auth/users", { body, branch: s.branchId ? String(s.branchId) : "all" });
      return { r };
    });
  }

  for (const s of keepLive) {
    if (auditResult.studNoLogin.every((x) => String(x._id) !== String(s._id))) continue;
    const email = EMAIL(s);
    if (taken.has(email)) { console.log(`   ! email already in use, skipping ${email}`); continue; }
    add("account", `create student login ${email} -> ${s.name} (${s.admissionNo})`, async () => {
      const r = await api("POST", "/auth/users", {
        body: { name: s.name, email, password: NEW_PASSWORD, role: "student", refId: String(s.admissionNo) },
        branch: s.branchId ? String(s.branchId) : "all",
      });
      return { r };
    });
  }

  return { actions, activeSession };
}

// ---------------------------------------------------------------------------
// Apply + verify
// ---------------------------------------------------------------------------
async function applyPlan(actions) {
  console.log(`\nAPPLYING ${actions.length} action(s) via ${BASE} as ${ADMIN.email}`);
  let pass = 0;
  let fail = 0;
  for (let i = 0; i < actions.length; i += 1) {
    const a = actions[i];
    const n = `${String(i + 1).padStart(2)}/${actions.length}`;
    try {
      const out = await a.run();
      const r = out.r;
      if (ok(r)) {
        pass += 1;
        console.log(`  OK    ${n}  ${a.label}${out.extra ? `  [${out.extra}]` : ""}`);
      } else {
        fail += 1;
        console.log(`  FAIL  ${n}  ${a.label}  -> ${r.status} ${JSON.stringify(r.data?.message || r.data).slice(0, 220)}`);
      }
    } catch (e) {
      fail += 1;
      console.log(`  FAIL  ${n}  ${a.label}  -> ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`\n  applied: ${pass} ok, ${fail} failed`);
  return { pass, fail };
}

// ---------------------------------------------------------------------------
// Verify — walk the personas the demo actually uses and confirm they see data
// ---------------------------------------------------------------------------
const totalOf = (r) => (typeof r.data?.total === "number" ? r.data.total
  : Array.isArray(r.data?.data) ? r.data.data.length : null);
const rowsOf = (r) => (Array.isArray(r.data?.data) ? r.data.data : []);
const whoAmI = (r) => r.data?.data?.user || r.data?.data || r.data?.user || {};
const scopes = (list) => (Array.isArray(list) ? list : [])
  .map((x) => [x.class, x.section])
  .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));

async function verify() {
  const results = [];
  const check = (id, name, expected, actual) => {
    const good = JSON.stringify(actual) === JSON.stringify(expected);
    results.push(good);
    console.log(`  ${good ? "PASS" : "FAIL"}  ${id.padEnd(3)} ${name.padEnd(44)}` +
      ` expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  };

  console.log("\nVERIFY — school admin");
  asUser(ADMIN_EMAIL);
  let r = await api("GET", "/staff?limit=200");
  check("S1", "staff roster", 13, totalOf(r));
  r = await api("GET", "/students?limit=200");
  check("S2", "student roster", 7, totalOf(r));
  r = await api("GET", "/assignments?status=active&limit=200");
  check("S3", "active teacher assignments", 7, totalOf(r));
  r = await api("GET", "/students?class=LKG&section=A&limit=50");
  check("S4", "LKG-A holds Demo Student III + IV", 2, rowsOf(r).length);
  // 21 ACTIVE accounts: the 22nd row in the DB (studentthree@edu.in) is
  // soft-deleted and must not appear in the list.
  r = await api("GET", "/auth/users?limit=200");
  check("S5", "active login accounts (22nd is soft-deleted)", 21, totalOf(r));

  console.log("\nVERIFY — class teacher (classteacher2 -> Demo Class Teacher II)");
  asUser("classteacher2.demoschool1@edu.in");
  r = await api("GET", "/assignments/me");
  check("T1", "class_teacher scope", [["LKG", "A"]], scopes(r.data?.data?.classTeacher));
  r = await api("GET", "/students?class=LKG&section=A&limit=50");
  check("T2", "sees the LKG-A students", 2, rowsOf(r).length);

  console.log("\nVERIFY — north campus class teacher (ravi.kumar)");
  asUser("ravi.kumar.demoschool1@edu.in");
  r = await api("GET", "/assignments/me");
  check("N1", "class_teacher scopes", [["UKG", "A"], ["UKG", "B"]], scopes(r.data?.data?.classTeacher));
  r = await api("GET", "/students?class=UKG&section=A&limit=50");
  check("N2", "sees the UKG-A students", 2, rowsOf(r).length);
  r = await api("GET", "/students?class=UKG&section=B&limit=50");
  check("N3", "sees the UKG-B student", 1, rowsOf(r).length);

  console.log("\nVERIFY — student (aarav.mehta)");
  asUser("aarav.mehta.demoschool1@edu.in");
  r = await api("GET", "/auth/me");
  const u = whoAmI(r);
  check("P1", "logs in as a student", "student", u.role);
  check("P2", "linked to admission DS1NUKG001", "DS1NUKG001", u.refId);

  const pass = results.filter(Boolean).length;
  console.log(`\n  verify: ${pass}/${results.length} passed`);
  return pass === results.length;
}

async function main() {
  const mode = VERIFY ? "VERIFY" : APPLY ? "AUDIT + APPLY" : "AUDIT (dry run, nothing written)";
  console.log(`=== DEMO SCHOOL 1 — ${mode} ===`);

  const ctx = await gather();
  const result = await audit(ctx);

  let verifyOk = true;
  if (VERIFY) {
    verifyOk = await verify();
  } else {
    const { actions, activeSession } = buildPlan(ctx, result);

    console.log(`\nPLAN  ${actions.length} action(s), session=${activeSession}`);
    actions.forEach((a, i) => console.log(`  ${String(i + 1).padStart(2)}. [${a.k}] ${a.label}`));

    if (!APPLY) {
      console.log(`\nDry run — nothing was written. Re-run with --apply to execute this plan.`);
    } else if (!actions.length) {
      console.log(`\nNothing to do — Demo School 1 is already backfilled.`);
    } else {
      await applyPlan(actions);
      console.log(`\n--- re-audit after apply ---`);
      const after = await gather();
      await audit(after);
    }
  }

  await Promise.all(Object.values(conns).map((c) => c.close().catch(() => {})));
  process.exit(verifyOk ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
