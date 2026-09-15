const mongoose = require("mongoose");
const URI = "mongodb+srv://atlaknotssolutions_db_user:mxYuUigEoRTUleZ1@cluster0.mtwtyaf.mongodb.net/?appName=Cluster0&compressors=zlib";

(async () => {
  const c1 = await mongoose.createConnection(URI + "&authSource=admin").asPromise();
  const db = c1.db;

  console.log("=== erp_auth > schools ===");
  console.log(JSON.stringify(await db.collection("schools").find({}).toArray(), null, 2));

  console.log("\n=== erp_auth > users ===");
  console.log(JSON.stringify(await db.collection("users").find({}).toArray(), null, 2));

  console.log("\n=== erp_staff > staffs ===");
  const sdb = (await mongoose.createConnection(URI + "&authSource=admin").asPromise()).db;
  console.log(JSON.stringify(await sdb.collection("staffs").find({}).toArray(), null, 2));

  console.log("\n=== erp_student > students ===");
  const stdb = (await mongoose.createConnection(URI + "&authSource=admin").asPromise()).db;
  console.log(JSON.stringify(await stdb.collection("students").find({}).toArray(), null, 2));

  await c1.close();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
