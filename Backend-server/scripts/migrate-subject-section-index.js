require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const { uriForDb } = require("../shared/src/branchScopedCollections");

const APPLY = process.argv.includes("--apply");
const DATABASE = "erp_academic";
const COLLECTION = "schoolsubjects";
const NEW_INDEX = {
  name: "scope_1_schoolId_1_branchId_1_className_1_sectionId_1_normalizedName_1",
  key: {
    scope: 1,
    schoolId: 1,
    branchId: 1,
    className: 1,
    sectionId: 1,
    normalizedName: 1,
  },
  unique: true,
  partialFilterExpression: { scope: "tenant" },
};
const OLD_KEY_SEQUENCES = [
  ["scope", "schoolId", "branchId", "className", "normalizedName"],
  ["scope", "schoolId", "className", "normalizedName"],
];

const sameSequence = (index, sequence) =>
  JSON.stringify(Object.keys(index.key)) === JSON.stringify(sequence);

async function migrate() {
  const uri = uriForDb(DATABASE);
  if (!uri) throw new Error("ACADEMIC_MONGODB_URI is not configured");

  const connection = await mongoose
    .createConnection(uri, { serverSelectionTimeoutMS: 20000 })
    .asPromise();
  try {
    const collections = new Set(
      (await connection.db.listCollections({ name: COLLECTION }).toArray())
        .map((collection) => collection.name),
    );
    if (!collections.has(COLLECTION)) {
      throw new Error(`${DATABASE}.${COLLECTION} does not exist`);
    }

    const collection = connection.db.collection(COLLECTION);
    const indexes = await collection.indexes();
    const next = indexes.find((index) => index.name === NEW_INDEX.name);
    if (next) {
      const correct =
        next.unique === true &&
        next.partialFilterExpression?.scope === "tenant" &&
        JSON.stringify(next.key) === JSON.stringify(NEW_INDEX.key);
      if (!correct) throw new Error(`Existing ${NEW_INDEX.name} has unexpected options`);
    }

    const oldIndexes = indexes.filter(
      (index) =>
        index.unique === true &&
        index.partialFilterExpression?.scope === "tenant" &&
        OLD_KEY_SEQUENCES.some((sequence) => sameSequence(index, sequence)),
    );

    if (!APPLY) {
      console.log(`Database: ${DATABASE}`);
      console.log(`Collection: ${COLLECTION}`);
      console.log(`New section-scoped index: ${next ? "already exists" : "would create"}`);
      console.log(
        oldIndexes.length
          ? `Old class-scoped indexes to replace: ${oldIndexes.map((index) => index.name).join(", ")}`
          : "No old class-scoped unique index found",
      );
      console.log("Dry run only. Pass --apply to perform the index migration.");
      return;
    }

    if (!next) {
      await collection.createIndex(NEW_INDEX.key, {
        name: NEW_INDEX.name,
        unique: NEW_INDEX.unique,
        partialFilterExpression: NEW_INDEX.partialFilterExpression,
      });
      console.log(`Created ${NEW_INDEX.name}`);
    }

    for (const index of oldIndexes) {
      await collection.dropIndex(index.name);
      console.log(`Dropped obsolete index ${index.name}`);
    }
    console.log("Subject section index migration completed.");
  } finally {
    await connection.close();
  }
}

migrate().catch((error) => {
  console.error("Subject section index migration failed:", error.message);
  process.exitCode = 1;
});
