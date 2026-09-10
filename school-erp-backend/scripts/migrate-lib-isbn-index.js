// One-off migration: relax the library Book `isbn` index so ISBN becomes
// optional. The old full unique index ({schoolId, isbn}) would reject a second
// book that has no ISBN; replace it with a partial unique index that only
// enforces uniqueness for non-empty ISBNs.
//
// Sequence is gap-free: create the partial index first (still unique for real
// ISBNs), then drop the old stricter index.
require("dotenv").config();
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "0.0.0.0"]);
const mongoose = require("mongoose");

const uri = process.env.LIBRARY_MONGODB_URI;
if (!uri) {
  console.error("LIBRARY_MONGODB_URI is not set");
  process.exit(1);
}

const OLD_INDEX = "schoolId_1_isbn_1";
const NEW_INDEX = "schoolId_1_isbn_unique";

(async () => {
  const conn = await mongoose.createConnection(uri);
  const books = conn.collection("books");

  await books.createIndex(
    { schoolId: 1, isbn: 1 },
    {
      unique: true,
      name: NEW_INDEX,
      partialFilterExpression: { isbn: { $type: "string", $gt: "" } },
    },
  );
  console.log(`created partial unique index "${NEW_INDEX}"`);

  const exists = (await books.indexes()).some((i) => i.name === OLD_INDEX);
  if (exists) {
    await books.dropIndex(OLD_INDEX);
    console.log(`dropped old full unique index "${OLD_INDEX}"`);
  } else {
    console.log(`old index "${OLD_INDEX}" not present — nothing to drop`);
  }

  console.log(
    "final indexes:",
    (await books.indexes()).map((i) => i.name).join(", "),
  );
  await conn.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});