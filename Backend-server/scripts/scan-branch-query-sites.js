#!/usr/bin/env node
/**
 * Find tenant-scoped query/write sites in service controllers that are NOT yet
 * wrapped in a branch-scoping helper, plus sites that take a branchId from the
 * request body without going through assertBranchAssignable().
 *
 * Why this exists: the codemod only rewrites `const filter = { schoolId: ... }`
 * declarations. Everything else (inline findOne/updateMany/aggregate filters,
 * multi-line literals, $in lists) still has to be found and fixed by hand, and
 * nothing else in the repo can tell us when that list is empty. This script is
 * the gate for flipping BRANCH_SCOPE on, so it has to be trustworthy rather than
 * merely plausible - hence the lexer below.
 *
 *   node scripts/scan-branch-query-sites.js
 *   node scripts/scan-branch-query-sites.js --by-file
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SERVICES = path.join(ROOT, "services");

const TENANT_RE = /schoolId\s*:\s*req\.tenantId/g;
// Property shorthand - `{ schoolId, class }` - reads the `schoolId` binding and
// is just as tenant-only, so it has to be tracked or these sites stay invisible.
const TENANT_SHORTHAND_RE = /(?:^|[{,\s])schoolId\s*[,}]/g;
const WRITE_TENANT_RE = /schoolId\s*:\s*(req\.body|body)\b/g;
const BRANCH_BODY_RE = /branchId\s*:\s*(req\.body|body)\b/g;

/**
 * Controllers that are school-wide on purpose, so their `schoolId:` filters are
 * correct as written. Keep this list tiny and justified - every entry is a place
 * where a branch filter would be wrong, not just inconvenient.
 *
 * Anything NOT listed here has to prove it is branch-safe.
 */
const SCHOOL_WIDE = new Map([
  [
    "auth-service/src/controllers/branchController.js",
    "Branch rows are the campuses themselves; they are listed per school by design.",
  ],
  [
    "auth-service/src/controllers/academicSessionController.js",
    "Academic sessions (2026-27) are one per school, shared by all its campuses.",
  ],
  [
    "auth-service/src/controllers/tenantController.js",
    "School-level usage stats/plan counters; not per-campus data.",
  ],
  [
    "auth-service/src/controllers/paymentGatewayController.js",
    "School-level billing settings.",
  ],
  [
    "academic-service/src/controllers/gradingScaleController.js",
    "Grading scales are a school-level pass-mark policy: one set of bands is meant to apply across every campus (and resolveScale() is called school-wide by the result engine), so 'grading scales' is deliberately absent from BRANCH_SCOPED_COLLECTIONS.",
  ],
  [
    "academic-service/src/controllers/cceController.js",
    "Co-scholastic rows are keyed by {schoolId, studentId, term, session} and admissionNo is unique per school, so each row already belongs to exactly one student and therefore one campus. 'coscholastics' is deliberately absent from BRANCH_SCOPED_COLLECTIONS.",
  ],
  // Whole accounting service: a single consolidated ledger for the school.
  [
    "accounting-service/src/controllers/accountController.js",
    "Confirmed product decision: the ledger is consolidated per school. Accounts, journal entries and the trial-balance / income-expense / balance-sheet reports intentionally span every campus, and erp_accounting is not in DB_URI_ENV_VAR either.",
  ],
  [
    "accounting-service/src/controllers/journalController.js",
    "Same consolidated school-wide ledger as accountController - see the note there.",
  ],
  [
    "accounting-service/src/controllers/reportController.js",
    "Same consolidated school-wide ledger as accountController - see the note there.",
  ],
  [
    "fee-service/src/controllers/internalPaymentController.js",
    "Creates platform gateway orders for school subscription upgrades, paid by the school to the platform on X-School-Id. These are deliberately not campus-specific, so PaymentOrder.branchId stays null for purpose='subscription_upgrade'.",
  ],
  [
    "library-service/src/controllers/bookController.js",
    "'books' is deliberately absent from BRANCH_SCOPED_COLLECTIONS: one school-wide catalogue. IssueRecord IS branch-scoped, since an issue belongs to a student.",
  ],
  [
    "library-service/src/controllers/digitalController.js",
    "'digitalbooks' is deliberately absent from BRANCH_SCOPED_COLLECTIONS, same as 'books' - a single school-wide digital catalogue.",
  ],
  [
    "student-service/src/controllers/tcController.js",
    "TcCounter is a per-school, per-year transfer-certificate number sequence (TC-2026-0001). It is deliberately school-wide and absent from BRANCH_SCOPED_COLLECTIONS, because the certificate numbers have to stay a single gapless run for the school - splitting them per campus would hand out duplicate numbers.",
  ],
  // auth-service internal routes: no campus data at all. They resolve a school
  // by id/code, manage school-level billing (PaymentGateway, Subscription,
  // School.plan) and toggle a user account by admissionNo (school-wide unique).
  [
    "auth-service/src/controllers/internalController.js",
    "Service-to-service surface with no campus-scoped collection: school resolution by id/code, school-level platform billing (PaymentGateway, Subscription, School.plan) and identity-targeted user activation/purge by admissionNo, which is school-wide unique.",
  ],
  [
    "auth-service/src/controllers/platformController.js",
    "Platform super-admin console: subscriptions, plans and schools span every campus by design, so it is school-wide like the rest of the platform surface.",
  ],
]);

// Whole services that are school-wide by design. A notice, diary entry or
// broadcast is addressed to the school and is meant to reach every campus, so
// these collections are deliberately absent from BRANCH_SCOPED_COLLECTIONS.
const SCHOOL_WIDE_SERVICES = new Map([
  [
    "communication-service",
    "Notices/events/diary/broadcast/messages are school-wide announcements; none of these collections are branch-scoped.",
  ],
]);

/**
 * Helpers that take the plain filter and return a branch-scoped one, so every
 * `schoolId:` inside their argument list is already covered.
 */
const SCOPING_WRAPPERS = ["scopeQuery", "withBranchScope"];

// Helper calls that scope internally, keyed on the branchId they receive.
const SELF_SCOPING = /findMissing(?:MasterRefs|Subjects|Rooms)\(/;

/**
 * Helper calls whose schoolId argument identifies one specific target rather
 * than selecting a collection. admissionNo is unique per school, so these
 * cannot reach another campus and do not need a branch filter.
 *
 * notifyByRoles is deliberately NOT here: it broadcasts by role across the whole
 * school, so a branch-specific event must not use it.
 */
const IDENTITY_TARGETED = /\b(notifyByRefIds|deactivateStudentUser|pushNotifications)\s*\(/;

/**
 * Helpers that only check a per-school-unique identifier, so they cannot reach
 * another campus. validateAdmission() asks "is this admissionNo already taken
 * and admitted", and assertAdmissionIdAvailable() asks the same thing. admissionNo
 * is unique per school - narrowing either to one campus would actually BREAK
 * them, by letting a real collision through.
 */
const IDENTITY_UNIQUE =
  /\b(validateAdmission|assertAdmissionIdAvailable|ensureStudentLink|ensureStaffLink)\s*\(/;

/**
 * Whole helper bodies that do nothing but resolve ONE row by an identifier which
 * is unique per school (admissionNo, employeeId). admissionNo/employeeId are
 * school-wide unique, so a row they match is that person's row in exactly one
 * campus - a branch filter here could only ever fail to find them.
 *
 * Every name added to this list must be a pure single-row identity resolver;
 * anything that selects a collection, lists rows, or aggregates does not belong.
 */
const IDENTITY_HELPER_BODY = [
  "ensureStudentLink",
  "ensureStaffLink",
  "studentExistsFor",
  "staffRecordFor",
  "assertAdmissionIdAvailable",
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Build a "code mask": the same length as the input, with every character that
 * is not executable code replaced by a space (newlines preserved).
 *
 * Brace/paren matching on raw source is wrong whenever a string, comment, regex
 * or template literal contains a brace - `/\{(\w+)\}/` or `` `Class ${x}` `` are
 * both common in this codebase and both unbalance a naive counter, which then
 * reports every later literal in the file as unsafe. Masking first makes the
 * structural analysis exact, and as a bonus it stops TENANT_RE from matching
 * example code inside comments.
 */
function codeMask(src) {
  const out = src.split("");
  const blank = (i) => {
    if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  // Last non-whitespace code char, used to tell a regex literal from division.
  const lastMeaningful = (i) => {
    for (let k = i - 1; k >= 0; k -= 1) {
      if (out[k] !== " " && out[k] !== "\n" && out[k] !== "\r" && out[k] !== "\t") return out[k];
    }
    return "";
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") blank(i++);
      continue;
    }
    if (ch === "/" && next === "*") {
      blank(i++);
      blank(i++);
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) blank(i++);
      if (i < src.length) blank(i++);
      if (i < src.length) blank(i++);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      blank(i++);
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") blank(i++);
        if (i < src.length) blank(i++);
      }
      if (i < src.length) blank(i++);
      continue;
    }
    if (ch === "`") {
      // Treated as one opaque token. Any ${...} inside is masked too, which is
      // safe because the interpolated expression is always brace-balanced.
      blank(i++);
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") blank(i++);
        if (i < src.length) blank(i++);
      }
      if (i < src.length) blank(i++);
      continue;
    }
    if (ch === "/") {
      const prev = lastMeaningful(i);
      const startsRegex =
        prev === "" || "([{=,:;!&|?+-*%<>~^".includes(prev) || /\b(return|typeof|case|in|of|new|delete|void|do|else)$/.test(lastMeaningful(i));
      if (startsRegex) {
        blank(i++);
        let inClass = false;
        while (i < src.length && src[i] !== "\n") {
          if (src[i] === "\\") {
            blank(i++);
            if (i < src.length) blank(i++);
            continue;
          }
          if (src[i] === "[") inClass = true;
          else if (src[i] === "]") inClass = false;
          else if (src[i] === "/" && !inClass) {
            blank(i++);
            break;
          } else blank(i++);
          i += 1;
        }
        continue;
      }
    }
    i += 1;
  }
  return out.join("");
}

/** Index of the '(' that opens the call started on this line, or -1. */
function openParenFor(mask, from) {
  for (let i = from; i < mask.length; i += 1) if (mask[i] === "(") return i;
  return -1;
}

/** End offset of the call whose '(' sits at `open`, or mask.length if unbalanced. */
function callEnd(mask, open) {
  let depth = 0;
  for (let i = open; i < mask.length; i += 1) {
    if (mask[i] === "(") depth += 1;
    else if (mask[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return mask.length;
}

/**
 * Return, per line index, the character offset from which that line is inside a
 * branch-scoping helper call, or null when it is not covered at all. Char offsets
 * (not just line numbers) matter because plenty of lines are shaped like
 *   const x = { schoolId: req.tenantId }; const rows = await scopeQuery(...);
 * where the unfiltered part sits to the left of the call.
 *
 * Single pass with a paren stack: a wrapper only opens a covered region when we
 * are not already inside one, otherwise nested calls would unbalance the count.
 */
/**
 * Character ranges covered by a branch-scoping helper call, as [from, to) column
 * bounds per line (from = Infinity / to = -1 when untouched).
 *
 * Offset-based on purpose. The earlier version recorded only "the column where
 * the call ended on this line" and treated every earlier column as covered,
 * which is wrong for a call that *ends* on a line it did not start on - the
 * shape `Model.findOneAndUpdate(scopeQuery(Model, req, {` produces. Comparing
 * against a real [open, close] range is shape-independent.
 */
function wrapperCoverage(mask, lines) {
  const from = new Array(lines.length).fill(Infinity);
  const to = new Array(lines.length).fill(-1);
  const names = SCOPING_WRAPPERS.map((n) => `${n}(`);

  const lineStarts = [0];
  for (let i = 0; i < mask.length; i += 1) if (mask[i] === "\n") lineStarts.push(i + 1);
  let cursor = 0;
  const lineOf = (off) => {
    while (cursor + 1 < lineStarts.length && lineStarts[cursor + 1] <= off) cursor += 1;
    return cursor;
  };

  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] !== "(") continue;
    if (!names.some((n) => mask.startsWith(n, i - n.length + 1))) continue;
    const end = callEnd(mask, i);
    if (end === -1) continue;

    let line = lineOf(i);
    let pos = i;
    for (;;) {
      const nl = mask.indexOf("\n", pos);
      const lineEnd = nl === -1 ? mask.length : nl;
      const segEnd = Math.min(end, lineEnd);
      if (segEnd >= pos) {
        from[line] = Math.min(from[line], pos - lineStarts[line]);
        to[line] = Math.max(to[line], segEnd - lineStarts[line]);
      }
      if (end <= lineEnd) break;
      pos = lineEnd + 1;
      line += 1;
    }
    i = end;
  }
  return { from, to };
}

/**
 * Marks the characters that make up the *update payload* of a mongoose write,
 * i.e. argument 1 of `Model.findOneAndUpdate(filter, update, options)` and
 * friends.
 *
 * A `schoolId` in that object is not a tenant filter - it is the value being
 * written (and on upsert it is what keeps the row's tenant consistent). Flagging
 * it would demand a branch filter on a document that is not being read, so the
 * check is limited to the payload range and never touches argument 0, which is
 * the filter that actually needs scoping.
 */
function updatePayloadRanges(mask) {
  const flags = new Array(mask.length).fill(false);
  const re = /\.(?:findOneAndUpdate|findByIdAndUpdate|findOneAndReplace|updateOne|updateMany|replaceOne)\s*\(/g;
  let m;
  while ((m = re.exec(mask)) !== null) {
    const open = m.index + m[0].length - 1;
    const end = callEnd(mask, open);
    if (end === -1) continue;
    const commas = [];
    let depth = 0;
    for (let i = open; i < end; i += 1) {
      const c = mask[i];
      if (c === "(" || c === "[" || c === "{") depth += 1;
      else if (c === ")" || c === "]" || c === "}") depth -= 1;
      else if (c === "," && depth === 1) {
        let j = i + 1;
        while (j < end && /\s/.test(mask[j])) j += 1;
        if (j < end) commas.push(i);
      }
    }
    if (commas.length < 1) continue;
    const start = commas[0] + 1;
    const stop = commas.length > 1 ? commas[1] : end;
    for (let k = start; k < stop; k += 1) flags[k] = true;
    re.lastIndex = end;
  }
  return flags;
}

function collect(re, line, from = 0) {
  const hits = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(line))) if (m.index >= from) hits.push(m.index);
  return hits;
}

/**
 * Return the full text of the object literal containing `idx`, or "" when it
 * cannot be identified. Needs BOTH ends: a `branchId:` written after the
 * `schoolId:` still scopes the literal, so slicing only up to `idx` would
 * under-report it as unsafe. Runs on the mask, so braces inside strings,
 * comments and regexes cannot throw the depth off.
 */
function enclosingLiteral(mask, idx) {
  let depth = 0;
  let open = -1;
  for (let i = idx; i >= 0; i -= 1) {
    const ch = mask[i];
    if (ch === "}") depth += 1;
    else if (ch === "{") {
      if (depth === 0) {
        open = i;
        break;
      }
      depth -= 1;
    }
  }
  if (open === -1) return "";
  let d = 0;
  for (let i = open; i < mask.length; i += 1) {
    const ch = mask[i];
    if (ch === "{") d += 1;
    else if (ch === "}") {
      d -= 1;
      if (d === 0) return mask.slice(open, i + 1);
    }
  }
  return "";
}

/**
 * True when the literal containing `idx` is a destructuring target rather than
 * a query/payload object: a function parameter list (`async ({ schoolId }) =>`,
 * `function f({ schoolId }) {`) or a destructuring assignment
 * (`const { schoolId } = req.query`). Both only read a binding, neither queries.
 * Telling them apart matters because a bare `schoolId,` inside a pattern is
 * otherwise indistinguishable from a filter.
 */
function isDestructuringPattern(mask, idx) {
  const lit = enclosingLiteral(mask, idx);
  if (!lit) return true; // no literal at all: not a query either
  const start = mask.indexOf(lit, Math.max(0, idx - lit.length));
  const after = mask.slice(start + lit.length, start + lit.length + 6);
  return /^\s*\)\s*(=>|\{)/.test(after) || /^\s*=/.test(after);
}

/**
 * True when the `schoolId` token at `tokenStart` is the VALUE half of a
 * `key: value` pair rather than a shorthand property.
 *
 * `{ schoolId: schoolId, cls }` is a redundant longhand, not a filter - but
 * TENANT_SHORTHAND_RE cannot tell it apart from `{ schoolId, cls }`, because
 * the value token is followed by a comma in both. Looking at what precedes the
 * token separates them.
 */
function isLonghandValue(lineMask, tokenStart) {
  return /[A-Za-z0-9_$]\s*:\s*$/.test(lineMask.slice(0, tokenStart));
}

function scanFile(file) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  const text = fs.readFileSync(file, "utf8");
  const mask = codeMask(text);
  const maskLines = mask.split(/\n/);
  const rawLines = text.split(/\r?\n/);
  const lineCount = Math.min(maskLines.length, rawLines.length);
  const offsets = [0];
  for (let i = 1; i < lineCount; i += 1) {
    offsets.push(offsets[i - 1] + maskLines[i - 1].length + 1);
  }
  const { from: coverFrom, to: coverTo } = wrapperCoverage(mask, maskLines);
  const lineCovered = (line, col) => col >= coverFrom[line] && col < coverTo[line];
  const inUpdatePayload = updatePayloadRanges(mask);
  const unfiltered = [];
  const bodyWrites = [];
  const branchFromBody = [];

  /**
   * Mark the lines of a call whose exemption depends on the call receiving a
   * branchId, then clear the flag for any whose argument list omits it. The
   * argument list usually spans several lines, so line-local matching is not
   * enough.
   */
  const exemptCallLines = (pattern) => {
    const flags = new Array(lineCount).fill(false);
    for (let i = 0; i < lineCount; i += 1) {
      if (!pattern.test(maskLines[i])) continue;
      const open = openParenFor(mask, offsets[i]);
      if (open === -1) continue;
      const end = callEnd(mask, open);
      const startLine = mask.slice(0, open).split("\n").length - 1;
      const endLine = mask.slice(0, end).split("\n").length - 1;
      const argText = mask.slice(open, end);
      if (!/\bbranchId\s*[:,]/.test(argText)) continue;
      for (let j = startLine; j <= Math.min(endLine, lineCount - 1); j += 1) flags[j] = true;
    }
    return flags;
  };

  // Exemptions that hold regardless of arguments: the target is one row
  // identified by an id, or a school-unique identifier.
  const unconditionalExempt = (pattern) => {
    const flags = new Array(lineCount).fill(false);
    for (let i = 0; i < lineCount; i += 1) {
      if (!pattern.test(maskLines[i])) continue;
      const open = openParenFor(mask, offsets[i]);
      if (open === -1) continue;
      const end = callEnd(mask, open);
      const startLine = mask.slice(0, open).split("\n").length - 1;
      const endLine = mask.slice(0, end).split("\n").length - 1;
      for (let j = startLine; j <= Math.min(endLine, lineCount - 1); j += 1) flags[j] = true;
    }
    return flags;
  };

  const identityTargeted = unconditionalExempt(IDENTITY_TARGETED);
  const identityUnique = unconditionalExempt(IDENTITY_UNIQUE);

  const identityBody = new Array(lineCount).fill(false);
  for (const name of IDENTITY_HELPER_BODY) {
    const defRe = new RegExp(`^(?:const|let|function|async function)\\s+${name}\\b`);
    for (let i = 0; i < lineCount; i += 1) {
      if (!defRe.test(maskLines[i])) continue;
      // Bodies here are top-level, so the helper ends at the first line that is
      // just `}` or `};` - no indentation-depth guessing needed.
      for (let j = i; j < lineCount; j += 1) {
        identityBody[j] = true;
        if (/^\};?\s*$/.test(maskLines[j])) break;
      }
    }
  }

  const selfScoped = exemptCallLines(SELF_SCOPING);

  const schoolWideKey = [...SCHOOL_WIDE.keys()].find((k) => rel.endsWith(k));
  const schoolWideService = [...SCHOOL_WIDE_SERVICES.keys()].find((s) =>
    rel.includes(`services/${s}/`),
  );
  const schoolWide = Boolean(schoolWideKey || schoolWideService);

  for (let i = 0; i < lineCount; i += 1) {
    const line = maskLines[i];
    // A bare `schoolId,` is only a tenant filter when it sits inside an object
    // literal; as a function argument or a shorthand assignment it is unrelated.
    const shorthandHits = collect(TENANT_SHORTHAND_RE, line).filter(
      (at) =>
        !isLonghandValue(line, at + 1) && !isDestructuringPattern(mask, offsets[i] + at),
    );
    for (const at of [...collect(TENANT_RE, line), ...shorthandHits]) {
      if (schoolWide || selfScoped[i] || identityTargeted[i] || identityUnique[i] || identityBody[i])
        continue;
      // already inside scopeQuery()/withBranchScope()
      if (lineCovered(i, at)) continue;
      // a schoolId in the update payload of a write is not a tenant filter
      if (inUpdatePayload[offsets[i] + at]) continue;
      // A literal that mentions a branch binding at all is taken as deliberately
      // branch-scoped. Matching only `branchId` misses the shorthand forms
      // (`branchId,`, `branchId }`, `...(branchId ? { branchId } : {})`) and the
      // `...branchClause` indirection that aggregates need.
      if (/\bbranch\w*/i.test(enclosingLiteral(mask, offsets[i] + at))) continue;
      unfiltered.push(i + 1);
    }
    if (coverTo[i] > coverFrom[i]) continue; // inside a branch-scoping helper
    if (collect(WRITE_TENANT_RE, line).length) bodyWrites.push(i + 1);
    if (collect(BRANCH_BODY_RE, line).length) branchFromBody.push(i + 1);
  }

  return {
    file: rel,
    unfiltered: [...new Set(unfiltered)],
    bodyWrites: [...new Set(bodyWrites)],
    branchFromBody: [...new Set(branchFromBody)],
    schoolWide,
  };
}

const files = walk(SERVICES)
  .filter((f) => /[\\/]controllers[\\/].*\.js$/.test(f))
  .filter((f) => !f.includes(path.join("node_modules", "")))
  .sort();

const results = files.map(scanFile).filter((r) => r.unfiltered.length || r.branchFromBody.length);

const byFile = process.argv.includes("--by-file");
let totalUnfiltered = 0;
let totalBranchBody = 0;

if (byFile) {
  results.sort((a, b) => b.unfiltered.length - a.unfiltered.length);
  for (const r of results) {
    totalUnfiltered += r.unfiltered.length;
    totalBranchBody += r.branchFromBody.length;
    console.log(`${String(r.unfiltered.length).padStart(3)} unfiltered  ${r.file}  L${r.unfiltered.join(",")}`);
    if (r.branchFromBody.length) {
      console.log(`    ^ ${r.branchFromBody.length} site(s) take branchId from the body: L${r.branchFromBody.join(",")}`);
    }
  }
} else {
  for (const r of results) {
    totalUnfiltered += r.unfiltered.length;
    totalBranchBody += r.branchFromBody.length;
  }
  console.log("files scanned                 :", files.length);
  console.log("tenant filters NOT branch-safe:", totalUnfiltered);
  console.log("branchId taken from req.body  :", totalBranchBody);
  console.log("");
  const buckets = new Map();
  for (const r of results) {
    const key = r.file.split("/")[1];
    buckets.set(key, (buckets.get(key) || 0) + r.unfiltered.length);
  }
  for (const [svc, n] of [...buckets].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${svc}`);
  }
}

console.log("");
console.log(totalUnfiltered === 0 ? "no unscoped tenant filters left" : `${totalUnfiltered} site(s) still need manual scoping`);
