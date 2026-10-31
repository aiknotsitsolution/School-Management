const applicationUsername = process.env.MONGO_APP_USERNAME;
const applicationPassword = process.env.MONGO_APP_PASSWORD;

if (!applicationUsername || !applicationPassword) {
  throw new Error("MONGO_APP_USERNAME and MONGO_APP_PASSWORD are required");
}

db.getSiblingDB("admin").createUser({
  user: applicationUsername,
  pwd: applicationPassword,
  roles: [
    { role: "readWrite", db: "erp_auth" },
    { role: "readWrite", db: "erp_student" },
    { role: "readWrite", db: "erp_staff" },
    { role: "readWrite", db: "erp_academic" },
    { role: "readWrite", db: "erp_fee" },
    { role: "readWrite", db: "erp_communication" },
    { role: "readWrite", db: "erp_library" },
    { role: "readWrite", db: "erp_facility" },
    { role: "readWrite", db: "erp_accounting" },
  ],
});
