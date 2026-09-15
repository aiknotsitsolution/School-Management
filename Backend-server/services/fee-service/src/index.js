require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const feeStructureRoutes = require("./routes/feeStructureRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const paymentOrderRoutes = require("./routes/paymentOrderRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const internalPaymentRoutes = require("./routes/internalPaymentRoutes");
const { startOverdueInvoiceScheduler } = require("./services/overdueInvoices");

const app = express();
const PORT = process.env.FEE_SERVICE_PORT || 5005;

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

// Provider webhooks need the RAW body for signature verification — this must
// run BEFORE the JSON parser that follows.
app.use(
  "/api/webhooks",
  express.raw({ type: () => true, limit: "200kb" }),
  webhookRoutes,
);

app.use(express.json({ limit: "100kb" }));

mongoose
  .connect(process.env.FEE_MONGODB_URI, { maxPoolSize: 5 })
  .then(() =>
  {
    console.log("✅ MongoDB Connected Successfully");
    startOverdueInvoiceScheduler();
  })
  .catch((err) =>
  {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

app.get("/health", (req, res) =>
  res.json({ success: true, service: "fee-service", status: "UP" }),
);
app.use("/api/fees/structure", feeStructureRoutes);
app.use("/api/fees", invoiceRoutes);
app.use("/api/payments/internal", internalPaymentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/payments/orders", paymentOrderRoutes);

app.use((err, req, res, next) =>
{
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => console.log(`Fee Service running on port ${PORT}`));