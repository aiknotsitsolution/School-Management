require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db");
const studentRoutes = require("./routes/studentRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const app = express();
const PORT = process.env.STUDENT_SERVICE_PORT || 5002;

connectDB();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

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
