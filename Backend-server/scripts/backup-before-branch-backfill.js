// Safety net for `backfill-branches.js --apply`: dumps every collection the
// backfill may touch (plus auth users/schools) to a single JSON file so the
// change can be reverted without mongodump.
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");

// This machine's default resolver refuses the SRV lookups the MongoDB driver
// needs (querySrv ECONNREFUSED) even though the records exist. Public resolvers
// answer them, so pin them for the script's lifetime.
require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);

const { BRANCH_SCOPED_COLLECTIONS, uriForDb } = require("../shared/src/branchScopedCollections");
const OUT_DIR = process.env.BRANCH_BACKUP_DIR || path.join(process.cwd(), "..", "branch-backup");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `pre-branch-backfill-${STAMP}.json`);
  const backup = { createdAt: new Date().toISOString(), databases: {} };

  const targets = Object.entries(BRANCH_SCOPED_COLLECTIONS).map(([db, collections]) => ({
    db,
    collections: [...Object.keys(collections), "users", "schools", "branches"],
  }));

  let totalDocs = 0;
  for (const { db: dbName, collections } of targets) {
    const uri = uriForDb(dbName);
    if (!uri) {
      console.error(`no URI env var configured for ${dbName} - skipping`);
      process.exitCode = 1;
      continue;
    }
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise();
    const existing = new Set((await conn.db.listCollections().toArray()).map((c) => c.name));
    backup.databases[dbName] = {};
    for (const collName of collections) {
      if (!existing.has(collName)) continue;
      const docs = await conn.db.collection(collName).find({}).toArray();
      backup.databases[dbName][collName] = { indexes: await conn.db.collection(collName).indexes(), documents: docs };
      totalDocs += docs.length;
      process.stdout.write(`  ${dbName}.${collName}: ${docs.length}\n`);
    }
    await conn.close();
  }

  fs.writeFileSync(outFile, JSON.stringify(backup, null, 0), "utf8");
  const size = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`\nbacked up ${totalDocs} document(s) -> ${outFile} (${size} KB)`);
})().catch((err) => {
  console.error("backup failed:", err.message);
  process.exit(1);
});
