require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "0.0.0.0"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const noticeRoutes = require("./routes/noticeRoutes");
const eventRoutes = require("./routes/eventRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const internalNotificationRoutes = require("./routes/internalNotificationRoutes");

const app = express();
const PORT = process.env.COMMUNICATION_SERVICE_PORT || 5006;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

mongoose
  .connect(process.env.COMMUNICATION_MONGODB_URI)
  .then(() =>
  {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) =>
  {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

app.get("/health", (req, res) =>
  res.json({ success: true, service: "communication-service", status: "UP" }),
);
app.use("/api/notices", noticeRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/notifications/internal", internalNotificationRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err, req, res, next) =>
{
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () =>
  console.log(`Communication Service running on port ${PORT}`),
);