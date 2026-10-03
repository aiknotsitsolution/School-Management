// Codemod: wrap controller query filters in scopeQuery(Model, req, {...}) so
// branch-scoped collections get filtered by the active campus.
//
// It only touches the `const filter = { ... }` / `let filter = { ... }` shape
// that already keys on `schoolId: req.tenantId`, and only when it can prove
// which model the filter is used with by looking ahead for
// `Model.find(filter)` / `.countDocuments(filter)` / `.updateMany(filter)` /
// etc. Anything it cannot resolve is reported and left alone, because
// scopeQuery() is a no-op for school-wide models but a wrong model name would
// silently filter the wrong collection.
//
//   node scripts/codemod-branch-scope.js            # dry run, prints a report
//   node scripts/codemod-branch-scope.js --apply    # rewrite files
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

const SERVICES = [
  "student-service",
  "staff-service",
  "academic-service",
  "fee-service",
  "facility-service",
  "library-service",
  "communication-service",
  "accounting-service",
];

const USES = [
  "find",
  "findOne",
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "updateMany",
  "updateOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "aggregate",
  "distinct",
];

/**
 * Pass 3: stamp the write side. A create payload that sets schoolId but never
 * branchId produces a row that no branch filter can ever match, so every
 * branch-scoped model has to be stamped at insert time too.
 *
 * Only models whose schema actually has a branchId path are touched; adding it
 * to a school-wide model (Notice, GradingScale, TimeSlot, ...) would be noise.
 */
function branchScopedModels(service) {
  const dir = path.join(ROOT, "services", service, "src", "models");
  const names = new Set();
  if (!fs.existsSync(dir)) return names;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    let mod;
    try {
      mod = require(path.join(dir, f));
    } catch {
      continue;
    }
    for (const cand of [mod, ...Object.values(mod || {})]) {
      if (!cand?.schema?.paths) continue;
      let has = false;
      try {
        has = Boolean(cand.schema.path("branchId"));
      } catch {
        has = false;
      }
      if (has) names.add(cand.modelName);
    }
  }
  return names;
}

function findCreateSites(src, scoped) {
  const out = [];
  const re = /\b([A-Z][A-Za-z0-9_]*)\s*\.\s*create\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const model = m[1];
    if (!scoped.has(model)) continue;
    const open = src.indexOf("{", m.index);
    const close = matchBrace(src, open);
    if (close === -1) continue;
    const body = src.slice(open, close + 1);
    if (!/schoolId\s*:\s*req\.tenantId/.test(body)) continue;
    if (/\bbranchId\s*:/.test(body)) continue; // already stamped
    const anchor = /schoolId\s*:\s*req\.tenantId\s*,/.exec(body);
    if (!anchor) continue;
    out.push({
      insertAt: open + 1 + anchor.index + anchor[0].length,
      model,
      line: src.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

const IMPORT_LINE =
  'const { scopeQuery } = require("@school-erp/shared/src/middleware/branchScope");';
const IMPORT_WRITE =
  'const { branchIdForWrite } = require("@school-erp/shared/src/middleware/branchScope");';

// Returns the index of the `}` closing the object literal that opens at openIdx,
// ignoring braces inside string literals.
function matchBrace(src, openIdx) {
  return matchPair(src, openIdx, "{", "}");
}

// Same, for the `)` closing the call that opens at openIdx.
function matchPair(src, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i += 1;
        i += 1;
      }
    }
  }
  return -1;
}

/**
 * Offsets already covered by a scopeQuery(...) call, so pass 2 never wraps a
 * filter that pass 1 (or an earlier edit) already handled.
 */
function scopeQuerySpans(src) {
  const spans = [];
  const re = /scopeQuery\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = m.index + "scopeQuery".length;
    const close = matchPair(src, open, "(", ")");
    if (close === -1) continue;
    spans.push([m.index, close]);
  }
  return spans;
}

const inSpans = (spans, idx) => spans.some(([a, b]) => idx > a && idx < b);

/**
 * Pass 2: filter object literals handed straight to a Mongoose call, e.g.
 *   await Exam.findOne({ schoolId: req.tenantId, _id: req.params.id })
 * becomes
 *   await scopeQuery(Exam.findOne({ schoolId: req.tenantId, _id: req.params.id }), Exam, req)
 *
 * Only calls whose first argument is an object literal are handled, so
 * aggregate([...]) and distinct("field", {...}) are left for a human.
 */
function findInlineSites(src) {
  const spans = scopeQuerySpans(src);
  const re = new RegExp(`\\b([A-Z][A-Za-z0-9_]*)\\s*\\.\\s*(?:${USES.join("|")})\\s*\\(`, "g");
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    if (inSpans(spans, m.index)) continue;
    const model = m[1];
    const openParen = m.index + m[0].length - 1;
    let brace = openParen + 1;
    while (brace < src.length && /\s/.test(src[brace])) brace += 1;
    if (src[brace] !== "{") continue; // aggregate / distinct / updateMany(id, ...)
    const closeBrace = matchBrace(src, brace);
    if (closeBrace === -1) continue;
    const body = src.slice(brace, closeBrace + 1);
    if (!/schoolId:\s*req\.tenantId/.test(body)) continue;
    const callClose = matchPair(src, openParen, "(", ")");
    if (callClose === -1) continue;
    out.push({
      start: m.index,
      end: callClose,
      model,
      line: src.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

// Finds the model identifier a filter variable is passed to, scanning forward
// from the end of its declaration.
function resolveModel(src, fromIdx, varName) {
  const re = new RegExp(`(\\w+)\\s*\\.\\s*(?:${USES.join("|")})\\s*\\(\\s*${varName}\\b`);
  const m = re.exec(src.slice(fromIdx));
  return m ? m[1] : null;
}

const needsHand = [];
const modelsSeen = new Map();
const writesSeen = new Map();
let changedFiles = 0;
let changedSites = 0;
let inlineCount = 0;
let writeCount = 0;

for (const service of SERVICES) {
  const dir = path.join(ROOT, "services", service, "src", "controllers");
  if (!fs.existsSync(dir)) continue;
  const scopedModels = branchScopedModels(service);

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const full = path.join(dir, file);
    const rel = path.relative(ROOT, full).replace(/\\/g, "/");
    const before = fs.readFileSync(full, "utf8");
    let src = before;
    const inlinePre = findInlineSites(before);

    const declRe = /\b(const|let)\s+(filter)\s*=\s*\{/g;
    const sites = [];
    let m;
    while ((m = declRe.exec(src)) !== null) {
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = matchBrace(src, openIdx);
      if (closeIdx === -1) continue;
      const body = src.slice(openIdx, closeIdx + 1);
      if (!/schoolId:\s*req\.tenantId/.test(body)) continue;

      const line = src.slice(0, m.index).split("\n").length;
      const model = resolveModel(src, closeIdx, m[2]);
      if (!model) {
        needsHand.push(`${rel}:${line}  (could not resolve the model)`);
        continue;
      }
      modelsSeen.set(model, (modelsSeen.get(model) || 0) + 1);
      sites.push({ start: m.index, declLen: m[0].length, body, keyword: m[1], model });
    }

    const createPre = findCreateSites(before, scopedModels);
    if (!sites.length && !inlinePre.length && !createPre.length) continue;

    // Back to front so the earlier offsets stay valid.
    for (let i = sites.length - 1; i >= 0; i -= 1) {
      const s = sites[i];
      src =
        src.slice(0, s.start) +
        `${s.keyword} filter = scopeQuery(${s.model}, req, ${s.body})` +
        src.slice(s.start + s.declLen + s.body.length);
    }

    const inlineSites = findInlineSites(src);
    for (let i = inlineSites.length - 1; i >= 0; i -= 1) {
      const s = inlineSites[i];
      modelsSeen.set(s.model, (modelsSeen.get(s.model) || 0) + 1);
      inlineCount += 1;
      src =
        src.slice(0, s.start) +
        `scopeQuery(${src.slice(s.start, s.end + 1)}, ${s.model}, req)` +
        src.slice(s.end + 1);
    }

    const createSites = findCreateSites(src, scopedModels);
    for (let i = createSites.length - 1; i >= 0; i -= 1) {
      const s = createSites[i];
      writeCount += 1;
      writesSeen.set(s.model, (writesSeen.get(s.model) || 0) + 1);
      // Match the indentation of the schoolId line we are following.
      const lineStart = src.lastIndexOf("\n", s.insertAt - 2) + 1;
      const indent = /^[ \t]*/.exec(src.slice(lineStart))[0];
      src =
        src.slice(0, s.insertAt) +
        `\n${indent}branchId: branchIdForWrite(req),` +
        src.slice(s.insertAt);
    }

    const needWrite = createSites.length > 0;
    const wantWrite = needWrite && !/branchIdForWrite/.test(src);

    if (!/require\("@school-erp\/shared\/src\/middleware\/branchScope"\)/.test(src)) {
      const lines = src.split("\n");
      const at = lines.findIndex((l) => /^const .*require\(/.test(l));
      if (at === -1) {
        needsHand.push(`${rel}  (no require line to anchor the import)`);
        continue;
      }
      lines.splice(at, 0, wantWrite ? IMPORT_WRITE : IMPORT_LINE);
      src = lines.join("\n");
    } else if (wantWrite) {
      // Extend the existing destructured import rather than adding a second one.
      src = src.replace(
        /const \{([^}]*)\} = require\("@school-erp\/shared\/src\/middleware\/branchScope"\);/,
        (full, names) =>
          `const {${names.trim()}, branchIdForWrite } = require("@school-erp/shared/src/middleware/branchScope");`,
      );
    }

    if (src === before) continue;
    changedFiles += 1;
    changedSites += sites.length;
    if (APPLY) fs.writeFileSync(full, src, "utf8");
  }
}

console.log(APPLY ? "APPLY" : "DRY RUN");
console.log(`  files changed      : ${changedFiles}`);
console.log(`  filter decls       : ${changedSites}`);
console.log(`  inline calls       : ${inlineCount}`);
console.log(`  create payloads    : ${writeCount}`);
if (writesSeen.size) {
  console.log("\n  branch-scoped models stamped on insert:");
  for (const [model, n] of [...writesSeen.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(3)}  ${model}`);
  }
}
console.log("\n  models the wrapped filters belong to:");
for (const [model, n] of [...modelsSeen.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)}  ${model}`);
}
if (needsHand.length) {
  console.log(`\n  left for a human (${needsHand.length}):`);
  needsHand.forEach((r) => console.log(`    ${r}`));
}
