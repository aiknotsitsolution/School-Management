require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const { liveness, readiness } = require("@school-erp/shared/src/health");

const hostelRoutes = require("./routes/hostelRoutes");
const transportRoutes = require("./routes/transportRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const placeRoutes = require("./routes/placeRoutes");
const traccarSync = require("./services/traccarSync");

const app = express();
const PORT = process.env.FACILITY_SERVICE_PORT || 5008;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
      : false,
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "100kb" }));

mongoose
  .connect(process.env.FACILITY_MONGODB_URI, { maxPoolSize: 5 })
  .then(() =>
  {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) =>
  {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

app.get("/health", liveness("facility-service"));
app.get("/health/ready", readiness("facility-service", mongoose));
app.use("/api/hostel", hostelRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/inventory", inventoryRoutes);
// Feature-neutral alias for the place search the transport routes already serve
// (see routes/placeRoutes.js) — the branch form needs it without holding
// transport permissions.
app.use("/api/places", placeRoutes);

app.use((err, req, res, next) =>
{
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () =>
  console.log(`Facility Service running on port ${PORT}`),
);

// GPS telemetry poller. Started only when TRACCAR_ENABLED=true, so a deployment
// without a telematics provider behaves exactly as before.
if (process.env.TRACCAR_ENABLED === "true") {
  traccarSync.start();
} else {
  console.log("[traccar-sync] disabled (set TRACCAR_ENABLED=true to enable GPS polling)");
}