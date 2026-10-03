// Adds the `branchId` field to the models the migration already stamps but
// which could not be filtered yet. Idempotent: a model that already declares the
// field is skipped.
//
// The field is inserted immediately before the schema's first real field so it
// sits with the other identity columns, and gets a `schoolId, branchId` compound
// index unless the model already has one.
//
//   node scripts/add-branch-id-to-models.js            # dry run
//   node scripts/add-branch-id-to-models.js --apply
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

// collections the audit flagged as "stamped but not filterable", minus the ones
// deliberately kept school-wide (examtypes, gradingscales, coscholastics,
// notices, events, books are configured as one-per-school masters).
const TARGETS = [
  "student-service/src/models/StudentDocument.js",
  "student-service/src/models/TransferCertificate.js",
  "staff-service/src/models/StaffAttendance.js",
  "staff-service/src/models/Payroll.js",
  "staff-service/src/models/Leave.js",
  "academic-service/src/models/HomeworkSubmission.js",
  "academic-service/src/models/Substitution.js",
  "fee-service/src/models/FeeReminder.js",
  "library-service/src/models/IssueRecord.js",
];

const FIELD =
  "branchId: { type: mongoose.Schema.Types.ObjectId, ref: \"Branch\", default: null, index: true },";

// Anchors: the first line of the schema body that is a real field, i.e. it sits
// at the schema's own indent and starts with an identifier.
const bodyRe = /new mongoose\.Schema\(\s*\{/;

let changed = 0;
let skipped = 0;

for (const rel of TARGETS) {
  const full = path.join(ROOT, "services", rel);
  if (!fs.existsSync(full)) {
    console.log(`  MISSING  ${rel}`);
    skipped += 1;
    continue;
  }
  let src = fs.readFileSync(full, "utf8");
  if (/branchId\s*:/.test(src)) {
    console.log(`  has it   ${rel}`);
    skipped += 1;
    continue;
  }

  const schemaAt = bodyRe.exec(src);
  if (!schemaAt) {
    console.log(`  NO SCHEMA ${rel}`);
    skipped += 1;
    continue;
  }

  // Find the first field line after the schema opens.
  const lines = src.split("\n");
  let insertAt = -1;
  let indent = "";
  for (let i = (schemaAt.index ? src.slice(0, schemaAt.index).split("\n").length : 0); i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue; // leading comment block
    const m = /^(\s*)[A-Za-z_$][\w$]*\s*:/.exec(line);
    if (m) {
      indent = m[1];
      insertAt = i;
      break;
    }
  }
  if (insertAt === -1) {
    console.log(`  NO FIELD ${rel}`);
    skipped += 1;
    continue;
  }

  lines.splice(insertAt, 0, `${indent}// Campus this record belongs to. null = school-wide, or a row`);
  lines.splice(insertAt + 1, 0, `${indent}// that predates branch scoping.`);
  lines.splice(insertAt + 2, 0, `${indent}${FIELD}`);
  src = lines.join("\n");

  // Compound index next to the existing index block, if there is one.
  const idxRe = /(\n(\s*)(\w+Schema)\.index\(\{ schoolId: 1)/;
  const idx = idxRe.exec(src);
  if (idx && !new RegExp(`branchId[\\s\\S]{0,40}${idx[3]}\\.index|${idx[3]}\\.index\\([^)]*branchId`).test(src)) {
    src = src.replace(
      idxRe,
      `\n$2$3.index({ schoolId: 1, branchId: 1, createdAt: -1 });\n$2$3.index({ schoolId: 1`,
    );
  }

  if (APPLY) fs.writeFileSync(full, src, "utf8");
  changed += 1;
  console.log(`  ${APPLY ? "patched " : "would  "} ${rel}`);
}

console.log(`\n${APPLY ? "APPLIED" : "DRY RUN"}: ${changed} patched, ${skipped} skipped`);
