/**
 * Seed demo fee structures (and optionally invoices) through the public API.
 *
 * Run: node scripts/seed-demo-fees.js
 *
 * Design rules (Sales/Testing report E3):
 *  - Talks only to the API gateway — same path the UI uses, so permissions,
 *    tenant scoping and validation are all exercised. No direct DB writes.
 *  - The session is READ from /auth/sessions (the active one). Nothing here
 *    hardcodes "2025" (or any other year) — a stale hardcoded session is what
 *    made earlier demo data invisible.
 *  - Idempotent: existing class/session/feeType structures are skipped
 *    (the backend answers 409 on duplicates), invoices are generated with the
 *    server's own duplicate-skip preview/confirm flow.
 *
 * Env:
 *   BASE_URL          default http://localhost:5000/api
 *   SEED_EMAIL        default administrator@aiknotsit.com
 *   SEED_PASSWORD     default Administrator@321
 *   SEED_SCHOOL       optional school name or code (defaults to the first)
 *   SEED_INVOICES=1   also preview+confirm Tuition invoices for the classes
 */
const BASE = process.env.BASE_URL || "http://localhost:5000/api";

const CREDENTIALS = {
  email: process.env.SEED_EMAIL || "administrator@aiknotsit.com",
  password: process.env.SEED_PASSWORD || "Administrator@321",
};

// class -> per fee type amounts. Deliberately small demo pricing.
const PRICING = {
  Tuition: { base: 2400, step: 200 },
  Transport: { base: 900, step: 100 },
};

async function api(method, path, body, token, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

const login = async () => {
  const r = await api("POST", "/auth/login", CREDENTIALS);
  if (!r.ok) throw new Error(`Login failed: ${JSON.stringify(r.data)}`);
  return r.data.data.accessToken;
};

/** Active session label — never hardcoded. */
async function activeSession(token, schoolId) {
  const h = { "X-School-Id": schoolId };
  // /sessions/current is the server's single source of truth for the live
  // session; fall back to the list (isCurrent flag) only if it's empty.
  const current = await api("GET", "/auth/sessions/current", null, token, h);
  const cur = current.data.data;
  if (cur) return sessionLabel(cur);
  const r = await api("GET", "/auth/sessions", null, token, h);
  const sessions = r.data.data || [];
  const active = sessions.find((s) => s.isCurrent) || sessions[0];
  return active ? sessionLabel(active) : null;
}

function sessionLabel(s) {
  if (!s) return null;
  return String(s.name || s.label || s.session || s.year || "").trim();
}

/** Distinct classes with active students, so pricing covers what exists. */
async function classesWithStudents(token, schoolId) {
  const r = await api("GET", "/students?limit=1000&status=Active", null, token, {
    "X-School-Id": schoolId,
  });
  const rows = r.data.data || [];
  const set = new Set(rows.map((s) => s.class).filter(Boolean));
  // Students may be missing class values — fall back to the master class list.
  if (!set.size) {
    const m = await api("GET", "/exam-masters/classes", null, token, {
      "X-School-Id": schoolId,
    });
    (m.data.data || []).forEach((c) => {
      const name = typeof c === "string" ? c : c.name;
      if (name) set.add(name);
    });
  }
  return [...set];
}

async function main() {
  console.log(`Seeding demo fees via ${BASE}`);
  const token = await login();
  console.log("  authenticated");

  const schools = await api("GET", "/auth/schools", null, token);
  const rows = schools.data.data || [];
  const wanted = process.env.SEED_SCHOOL;
  const school = wanted
    ? rows.find((s) => s.name === wanted || s.code === wanted)
    : rows[0];
  if (!school) throw new Error("No school found — create one first.");
  const schoolId = String(school._id);
  const h = { "X-School-Id": schoolId };
  console.log(`  school: ${school.name} (${school.code})`);

  const session = await activeSession(token, schoolId);
  if (!session) {
    throw new Error(
      "No academic session exists for this school. Create one at /academic-sessions first — this script will not invent one.",
    );
  }
  console.log(`  active session: ${session}`);

  const classes = await classesWithStudents(token, schoolId);
  if (!classes.length) throw new Error("No classes found to price.");
  console.log(`  classes: ${classes.join(", ")}`);

  // ── Fee structures ────────────────────────────────────────────────────────
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);

  for (const cls of classes) {
    for (const [feeType, price] of Object.entries(PRICING)) {
      const amount = price.base + price.step * classes.indexOf(cls);
      const r = await api(
        "POST",
        "/fees/structure",
        {
          class: cls,
          session,
          feeType,
          amount,
          frequency: feeType === "Tuition" ? "Monthly" : "Quarterly",
          dueDate: dueDate.toISOString(),
        },
        token,
        h,
      );
      if (r.ok) {
        created++;
        console.log(`  structure + ${feeType} ${cls} — ₹${amount}`);
      } else if (r.status === 409) {
        skipped++;
      } else {
        failed++;
        console.error(`  structure FAILED ${feeType} ${cls}: ${r.data.message || r.status}`);
      }
    }
  }
  console.log(`structures: ${created} created, ${skipped} already present, ${failed} failed`);

  // ── Invoices (opt-in: SEED_INVOICES=1) ────────────────────────────────────
  if (process.env.SEED_INVOICES === "1") {
    let invoices = 0;
    for (const cls of classes) {
      const preview = await api(
        "POST",
        "/fees/generate/preview",
        { class: cls, feeType: "Tuition", session },
        token,
        h,
      );
      if (!preview.ok) {
        console.error(`  preview FAILED ${cls}: ${preview.data.message || preview.status}`);
        continue;
      }
      const rows = (preview.data.data?.preview || []).filter((p) => !p.isDuplicate);
      if (!rows.length) {
        console.log(`  ${cls}: no new Tuition invoices`);
        continue;
      }
      const confirm = await api(
        "POST",
        "/fees/generate/confirm",
        {
          invoices: rows.map((p) => ({
            studentId: p.studentId,
            class: cls,
            feeType: "Tuition",
            session,
            amount: p.grossAmount,
            dueDate: dueDate.toISOString(),
          })),
        },
        token,
        h,
      );
      if (confirm.ok) {
        invoices += rows.length;
        console.log(`  ${cls}: ${rows.length} Tuition invoice(s) generated`);
      } else {
        console.error(`  confirm FAILED ${cls}: ${confirm.data.message || confirm.status}`);
      }
    }
    console.log(`invoices: ${invoices} generated`);
  } else {
    console.log("invoices: skipped (set SEED_INVOICES=1 to generate)");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
