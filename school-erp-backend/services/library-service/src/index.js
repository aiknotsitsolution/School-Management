require("dotenv").config();

const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const bookRoutes = require("./routes/bookRoutes");
const issueRoutes = require("./routes/issueRoutes");

const app = express();
const PORT = process.env.LIBRARY_SERVICE_PORT || 5007;

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

app.get("/health", (req, res) =>
  res.json({ success: true, service: "library-service", status: "UP" }),
);
app.use("/api/library/books", bookRoutes);
app.use("/api/library/issues", issueRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () =>
  console.log(`Library Service running on port ${PORT}`),
);