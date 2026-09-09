const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("../middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/notificationController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/push", requirePermission("notices:publish"), ctrl.pushNotifications);
router.get("/", ctrl.getNotifications);
router.get("/unread-count", ctrl.getUnreadCount);
router.patch("/read-all", ctrl.markAllRead);
router.patch("/:id/read", ctrl.markAsRead);

module.exports = router;