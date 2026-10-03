#!/usr/bin/env node
/**
 * Detects the misuse of scopeQuery() where the arguments are in the wrong order:
 *
 *   scopeQuery(Model.findOne({...}), Model, req)   <- broken
 *   scopeQuery(Model, req, { ... })                <- correct
 *
 * The broken form silently returns the express `req` object instead of a query,
 * because scopeQuery's real signature is (model, req, filter). A controller that
 * then reads `.title` off the "document" gets undefined, and one that chains
 * `.lean()` throws. The branch-query scanner cannot see this: the query literal
 * sits inside a scopeQuery() call, so it counts as covered.
 *
 * A correct call's first argument is a bare model identifier, optionally with
 * `.modelName` - never a call or a member expression.
 *
 *   node scripts/check-scopequery-usage.js
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIRS = ["services", "shared"];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

// Blank out comments and string/template literals so a `scopeQuery(` inside a
// comment or a message string cannot be reported.
function codeMask(text) {
  const out = text.split("");
  let i = 0;
  const n = text.length;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k += 1) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      blank(i, end === -1 ? n : end);
      i = end === -1 ? n : end;
    } else if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      blank(i, end === -1 ? n : end + 2);
      i = end === -1 ? n : end + 2;
    } else if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === quote) break;
        j += 1;
      }
      blank(i, Math.min(j + 1, n));
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return out.join("");
}

const findings = [];
for (const dir of TARGET_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    if (file.includes(`${path.sep}test${path.sep}`)) continue;
    const text = fs.readFileSync(file, "utf8");
    const mask = codeMask(text);
    const lines = mask.split("\n");
    lines.forEach((line, idx) => {
      let from = 0;
      for (;;) {
        const at = line.indexOf("scopeQuery(", from);
        if (at === -1) return;
        from = at + 1;
        const rest = line.slice(at + "scopeQuery(".length);
        // First argument: a bare identifier (optionally model.modelName) is fine.
        // Anything containing a call, member access or spread is a query, not a model.
        const bad = /^\s*\(?\s*[A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*\s*)?\(/.test(rest);
        const isCorrect = /^\s*[A-Za-z_$][\w$]*\s*(?:\.\s*[A-Za-z_$][\w$]*\s*)?,\s*req\b/.test(rest);
        if (bad && !isCorrect) {
          findings.push({
            file: path.relative(ROOT, file).split(path.sep).join("/"),
            line: idx + 1,
            text: line.trim().slice(0, 100),
          });
        }
      }
    });
  }
}

if (!findings.length) {
  console.log("scopeQuery usage OK: every call passes a model first");
  process.exit(0);
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}
console.log(`scopeQuery() called with the wrong argument order: ${findings.length} site(s)\n`);
for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${list.length}  ${file}`);
  for (const f of list) console.log(`        L${f.line}: ${f.text}`);
}
console.log("\nFix: put the filter inside the query and wrap only the filter:");
console.log("  scopeQuery(Model.findOne({ a }), Model, req)");
console.log("  -> Model.findOne(scopeQuery(Model, req, { a }))");
process.exit(1);
