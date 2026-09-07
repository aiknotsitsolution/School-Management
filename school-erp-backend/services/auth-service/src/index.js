require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const platformRoutes = require("./routes/platformRoutes");
const ensureBillingDefaults = require("./init/ensureBillingDefaults");

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 5001;

const start = async () => {
  try {
    await connectDB();
    await ensureBillingDefaults();
    app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
  } catch (err) {
    console.error("[auth-service] startup failed:", err.message);
    process.exit(1);
  }
};

void start();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
      : true,
  })
);
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => res.json({ success: true, service: "auth-service", status: "UP" }));
app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});
