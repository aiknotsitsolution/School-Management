const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/authController");
const { verifyToken, resolveTenant, requirePermission, authorizeRoles } = require("../middleware/auth");

// Public
router.post("/login", ctrl.login);
router.post("/refresh-token", ctrl.refreshToken);

// Protected - account self-service
router.get("/me", verifyToken, resolveTenant, ctrl.getMe);
router.post("/change-password", verifyToken, ctrl.changePassword);
router.get("/verify", verifyToken, ctrl.verify);

// User management - admin only (no public self-register).
// /register kept as an alias for backwards compat but requires auth + permission.
router.post("/register", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.createUser);
router.post("/users", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.createUser);
router.get("/users", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.listUsers);
router.patch("/users/:id/status", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.updateUserStatus);
router.patch("/users/:id", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.updateUser);
router.delete("/users/:id", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.deleteUser);
router.post("/users/:id/restore", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.restoreUser);

// School / tenant management - platform owner only
router.post("/schools", verifyToken, authorizeRoles("super_admin"), ctrl.createSchool);
router.get("/schools", verifyToken, authorizeRoles("super_admin"), ctrl.listSchools);
router.get("/schools/:id", verifyToken, authorizeRoles("super_admin"), ctrl.getSchool);
router.patch("/schools/:id", verifyToken, authorizeRoles("super_admin"), ctrl.updateSchool);

module.exports = router;