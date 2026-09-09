require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1", "0.0.0.0"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const imagekit = require("./config/imagekit");

const timetableRoutes = require("./routes/timetableRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const homeworkSubmissionRoutes = require("./routes/homeworkSubmissionRoutes");
const examRoutes = require("./routes/examRoutes");
const marksRoutes = require("./routes/marksRoutes");

const app = express();
const PORT = process.env.ACADEMIC_SERVICE_PORT || 5004;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  }),
);
app.use(morgan("dev"));
app.use(express.json());

mongoose
  .connect(process.env.ACADEMIC_MONGODB_URI)
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
  res.json({ success: true, service: "academic-service", status: "UP" }),
);
app.use("/api/timetable", timetableRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/homework/submissions", homeworkSubmissionRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/marks", marksRoutes);

app.use((err, req, res, next) =>
{
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => console.log(`Academic Service running on port ${PORT}`));
