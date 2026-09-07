require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.GATEWAY_PORT || 5000;
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 10000);

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Global rate limiter - protects all downstream microservices
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});
app.use(limiter);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "api-gateway",
    status: "UP",
    time: new Date().toISOString(),
  });
});

// Route map: gateway path -> downstream microservice
const routes = [
  {
    path: "/api/auth",
    target: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
  },
  {
    path: "/api/platform",
    target: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
  },
  {
    path: "/api/students",
    target: process.env.STUDENT_SERVICE_URL || "http://localhost:5002",
  },
  {
    path: "/api/admissions",
    target: process.env.STUDENT_SERVICE_URL || "http://localhost:5002",
  },
  {
    path: "/api/staff",
    target: process.env.STAFF_SERVICE_URL || "http://localhost:5003",
  },
  {
    path: "/api/leaves",
    target: process.env.STAFF_SERVICE_URL || "http://localhost:5003",
  },
  {
    path: "/api/payroll",
    target: process.env.STAFF_SERVICE_URL || "http://localhost:5003",
  },
  {
    path: "/api/attendance",
    target: process.env.ACADEMIC_SERVICE_URL || "http://localhost:5004",
  },
  {
    path: "/api/timetable",
    target: process.env.ACADEMIC_SERVICE_URL || "http://localhost:5004",
  },
  {
    path: "/api/homework",
    target: process.env.ACADEMIC_SERVICE_URL || "http://localhost:5004",
  },
  {
    path: "/api/exams",
    target: process.env.ACADEMIC_SERVICE_URL || "http://localhost:5004",
  },
  {
    path: "/api/marks",
    target: process.env.ACADEMIC_SERVICE_URL || "http://localhost:5004",
  },
  {
    path: "/api/fees",
    target: process.env.FEE_SERVICE_URL || "http://localhost:5005",
  },
  {
    path: "/api/payments",
    target: process.env.FEE_SERVICE_URL || "http://localhost:5005",
  },
  {
    path: "/api/notices",
    target: process.env.COMMUNICATION_SERVICE_URL || "http://localhost:5006",
  },
  {
    path: "/api/events",
    target: process.env.COMMUNICATION_SERVICE_URL || "http://localhost:5006",
  },
  {
    path: "/api/library",
    target: process.env.LIBRARY_SERVICE_URL || "http://localhost:5007",
  },
  {
    path: "/api/hostel",
    target: process.env.FACILITY_SERVICE_URL || "http://localhost:5008",
  },
  {
    path: "/api/transport",
    target: process.env.FACILITY_SERVICE_URL || "http://localhost:5008",
  },
  {
    path: "/api/inventory",
    target: process.env.FACILITY_SERVICE_URL || "http://localhost:5008",
  },
];

routes.forEach(({ path, target }) => {
  app.use(
    path,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      timeout: PROXY_TIMEOUT_MS,
      proxyTimeout: PROXY_TIMEOUT_MS,
      pathRewrite: (_requestPath, req) => req.originalUrl,
      on: {
        error: (_error, _request, response) => {
          if (!response.headersSent) {
            response.status(503).json({
              success: false,
              message: "Requested service is temporarily unavailable",
            });
          }
        },
      },
    }),
  );
});

app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: "Route not found on API Gateway" });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
