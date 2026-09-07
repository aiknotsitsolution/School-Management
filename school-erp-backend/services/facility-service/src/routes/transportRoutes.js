const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/transportController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentParam } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("transport:update"), ctrl.createRoute);
router.get("/", requirePermission("transport:read"), scopeStudentParam("studentId"), ctrl.getRoutes);
router.patch("/:id/location", requirePermission("transport:update"), ctrl.updateLocation);
router.patch("/:id/assign", requirePermission("transport:update"), ctrl.assignStudent);

module.exports = router;
