const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/healthController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeClassTeacher } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Read health record — students own-only; teachers scoped; admins any.
const gateHealthRead = (req, res, next) => {
  const perm = req.user?.role === "student" ? "profile:read" : "students:read";
  return requirePermission(perm)(req, res, next);
};
const gateHealthWrite = (req, res, next) => {
  const perm = req.user?.role === "student" ? "profile:update" : "students:write";
  return requirePermission(perm)(req, res, next);
};

router.get("/", gateHealthRead, scopeClassTeacher, ctrl.getHealth);
router.put("/", gateHealthWrite, scopeClassTeacher, ctrl.upsertHealth);

module.exports = router;
