require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("node:path");
const mongoose = require("mongoose");
const morgan = require("morgan");

const studentRoutes = require("./routes/studentRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");

const app = express();
const PORT = process.env.STUDENT_SERVICE_PORT || 5002;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

mongoose
  .connect(process.env.STUDENT_MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

app.get("/health", (req, res) =>
  res.json({ success: true, service: "student-service", status: "UP" }),
);
app.use("/api/students", studentRoutes);
app.use("/api/admissions", enquiryRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => console.log(`Student Service running on port ${PORT}`));