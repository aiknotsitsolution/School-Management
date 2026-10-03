// Definitive answer to "which models will scopeQuery() actually filter?":
// requires every mongoose model in every service and checks its schema for a
// `branchId` path. No connection is opened, so this is safe to run anywhere.
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

const ROOT = path.join(__dirname, "..");
const { BRANCH_SCOPED_COLLECTIONS } = require(path.join(ROOT, "shared/src/branchScopedCollections"));

const SERVICES = [
  "student-service",
  "staff-service",
  "academic-service",
  "fee-service",
  "facility-service",
  "library-service",
  "communication-service",
  "accounting-service",
  "auth-service",
];

const declared = new Set(
  Object.entries(BRANCH_SCOPED_COLLECTIONS).flatMap(([db, colls]) =>
    Object.keys(colls).map((c) => `${db}.${c}`),
  ),
);

const withField = [];
const withoutField = [];
// plural collection name -> { hasField, file }
const byCollection = new Map();
const declaredButMissingField = [];

for (const service of SERVICES) {
  const dir = path.join(ROOT, "services", service, "src", "models");
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const full = path.join(dir, file);
    let model;
    try {
      model = require(full);
    } catch {
      continue; // not a standalone model file (helpers/constants)
    }
    // Some model files export a named bag, e.g. { TransferCertificate, TcCounter },
    // so unwrap to whichever member is actually a model.
    const candidates = [model, ...Object.values(model || {})].filter(
      (m) => m?.schema?.paths,
    );
    if (!candidates.length) continue;

    for (const cand of candidates) {
      model = cand;
      // Register under every name this model could be known by: the resolved
      // collection name, the model name, and the model name minus a trailing "s".
      // Mongoose only fills collection.name once it has resolved the plural,
      // which it does lazily, so all three are needed to match the declared map.
      let hasField = false;
      try {
        hasField = Boolean(model.schema.path("branchId"));
      } catch {
        hasField = false;
      }
      const rel = path.relative(ROOT, full).replace(/\\/g, "/");
      (hasField ? withField : withoutField).push(`${model.modelName.padEnd(24)} ${rel}`);
      for (const key of [model.collection?.name, model.modelName, model.modelName?.replace(/s$/, "")]) {
        if (key) byCollection.set(String(key).toLowerCase(), { hasField, file: rel });
      }
    }
  }
}

// Now the question that actually gates the rollout: of the collections we told
// the migration to stamp, which ones can still be filtered afterwards?
for (const key of declared) {
  const coll = key.split(".")[1];
  const hit =
    byCollection.get(coll) ||
    // "transfercertificates" -> TransferCertificate
    byCollection.get(coll.replace(/ies$/, "y").replace(/s$/, ""));
  if (!hit) {
    declaredButMissingField.push(`${key.padEnd(34)} (no model found for "${coll}")`);
  } else if (!hit.hasField) {
    declaredButMissingField.push(`${key.padEnd(34)} (${hit.file})`);
  }
}

console.log(`declared branch-scoped collections : ${declared.size}`);
console.log(`models WITH branchId               : ${withField.length}`);
console.log(`models WITHOUT branchId            : ${withoutField.length}`);
console.log(`declared but NOT filterable        : ${declaredButMissingField.length}`);

console.log("\n--- models that WILL be branch-filtered ---");
withField.sort().forEach((l) => console.log(`  ${l}`));

console.log("\n--- stamped by the migration but the model has no branchId ---");
console.log("    (rows are tagged in the DB, yet scopeQuery() cannot filter them)");
if (declaredButMissingField.length) declaredButMissingField.sort().forEach((l) => console.log(`  ${l}`));
else console.log("  (none)");
