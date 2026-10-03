const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/transportController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, authorizeRoles, scopeStudentParam } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Fleet-wide and provider-operator surfaces are staff-only. Students and parents
// hold `transport:read` for their own route, which is served by GET /me below —
// it is scoped from the token, so nothing here may be reachable by those roles.
const staffOnly = authorizeRoles("school_admin", "super_admin", "staff");

// Static paths are declared before the "/:id/..." ones so a route id can never
// shadow them (e.g. a route literally named "me").
router.get("/me", requirePermission("transport:read"), ctrl.myRoute);
router.get("/places/search", requirePermission("transport:read"), staffOnly, ctrl.searchPlacesFor);
router.get("/places/reverse", requirePermission("transport:read"), staffOnly, ctrl.reversePlaceFor);
router.get("/tracking/status", requirePermission("transport:read"), staffOnly, ctrl.trackingStatus);
router.get("/devices", requirePermission("transport:read"), staffOnly, ctrl.providerDevices);

router.post("/", requirePermission("transport:update"), ctrl.createRoute);
router.get("/", requirePermission("transport:read"), staffOnly, scopeStudentParam("studentId"), ctrl.getRoutes);
router.patch("/:id", requirePermission("transport:update"), ctrl.updateRoute);
router.patch("/:id/location", requirePermission("transport:update"), ctrl.updateLocation);
router.patch("/:id/assign", requirePermission("transport:update"), ctrl.assignStudent);
router.patch("/:id/unassign", requirePermission("transport:update"), ctrl.unassignStudent);
// Draft preview takes no route id, so it must be a static path: `router.param`
// validates ":id" as an ObjectId and would reject the "draft" placeholder the
// planner sends before a route has been created.
router.post("/plan/preview", requirePermission("transport:read"), staffOnly, ctrl.previewPlan);
router.post("/:id/plan/preview", requirePermission("transport:read"), staffOnly, ctrl.previewPlan);
router.post("/:id/bind-device", requirePermission("transport:update"), ctrl.bindDevice);
router.delete("/:id/bind-device", requirePermission("transport:update"), ctrl.unbindDevice);
router.post("/:id/sync", requirePermission("transport:update"), ctrl.syncRoute);
router.get("/:id/history", requirePermission("transport:read"), ctrl.routeHistory);

module.exports = router;
