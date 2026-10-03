const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/studyMaterialController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeClassTeacher, scopeClassTeacherAggregate, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Materials are listed class-wise (the manage screen filters by class only), so
// the read is a class aggregate. Teachers stay pinned to the class the route
// resolved and to the sections they are assigned to.
router.get("/", requirePermission("homework:read"), scopeClassTeacherAggregate, ctrl.getMaterials);
router.post("/", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.createMaterial);
router.delete("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.deleteMaterial);

module.exports = router;
