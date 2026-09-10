const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/authController");
const { verifyToken, resolveTenant, requirePermission, authorizeRoles } = require("../middleware/auth");

// Public
router.post("/login", ctrl.login);
router.post("/refresh-token", ctrl.refreshToken);
router.post("/reset-password", ctrl.resetPassword);
router.post("/forgot-password", ctrl.requestPasswordReset);
router.post("/verify-reset-otp", ctrl.verifyResetOtp);
router.post("/reset-password-otp", ctrl.resetPasswordWithOtp);

// Protected - account self-service
router.get("/me", verifyToken, resolveTenant, ctrl.getMe);
router.post("/change-password", verifyToken, ctrl.changePassword);
router.get("/verify", verifyToken, ctrl.verify);

// Self-service school branding / report-card customization (own tenant only)
router.get("/school/me", verifyToken, resolveTenant, ctrl.getMySchool);
router.patch("/school/me", verifyToken, resolveTenant, requirePermission("school:settings"), ctrl.updateMySchool);

// Password recovery - admin initiated (no email provider in the fleet)
router.post("/users/:id/reset-password", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.adminResetPassword);
router.post("/users/:id/send-reset-otp", verifyToken, resolveTenant, requirePermission("users:manage"), ctrl.adminSendResetOtp);

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