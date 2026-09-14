const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
const ctrl = require("../controllers/behaviorController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeClassTeacher } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

const gateBehaviorRead = (req, res, next) => {
  return requirePermission("students:read")(req, res, next);
};
const gateBehaviorWrite = (req, res, next) => {
  return requirePermission("students:write")(req, res, next);
};

router.post("/", gateBehaviorWrite, scopeClassTeacher, ctrl.createRecord);
router.get("/", gateBehaviorRead, scopeClassTeacher, ctrl.listRecords);
router.get("/:id", gateBehaviorRead, ctrl.getRecord);
router.put("/:id", gateBehaviorWrite, scopeClassTeacher, ctrl.updateRecord);
router.delete("/:id", gateBehaviorWrite, ctrl.deleteRecord);

module.exports = router;
