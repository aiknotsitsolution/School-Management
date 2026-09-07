require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db");
const staffRoutes = require("./routes/staffRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const app = express();
const PORT = process.env.STAFF_SERVICE_PORT || 5003;

connectDB();
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) =>
  res.json({ success: true, service: "staff-service", status: "UP" }),
);
app.use("/api/staff", staffRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => console.log(`Staff Service running on port ${PORT}`));
