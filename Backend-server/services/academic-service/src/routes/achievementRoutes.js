const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
const ctrl = require("../controllers/achievementController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeClassTeacher } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

const gateAchievementRead = (req, res, next) => {
  return requirePermission("students:read")(req, res, next);
};
const gateAchievementWrite = (req, res, next) => {
  return requirePermission("students:write")(req, res, next);
};

router.post("/", gateAchievementWrite, scopeClassTeacher, ctrl.createAchievement);
router.get("/", gateAchievementRead, scopeClassTeacher, ctrl.listAchievements);
router.get("/:id", gateAchievementRead, ctrl.getAchievement);
router.put("/:id", gateAchievementWrite, scopeClassTeacher, ctrl.updateAchievement);
router.delete("/:id", gateAchievementWrite, ctrl.deleteAchievement);

module.exports = router;
