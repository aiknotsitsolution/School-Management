require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db");
const timetableRoutes = require("./routes/timetableRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const examRoutes = require("./routes/examRoutes");
const marksRoutes = require("./routes/marksRoutes");

const app = express();
const PORT = process.env.ACADEMIC_SERVICE_PORT || 5004;

connectDB();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({ success: true, service: "academic-service", status: "UP" }),
);
app.use("/api/timetable", timetableRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/marks", marksRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => console.log(`Academic Service running on port ${PORT}`));
