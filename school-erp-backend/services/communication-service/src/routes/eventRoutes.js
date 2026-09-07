const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/eventController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("events:publish"), ctrl.createEvent);
router.get("/", requirePermission("events:read"), ctrl.getEvents);
router.put("/:id", requirePermission("events:publish"), ctrl.updateEvent);
router.delete("/:id", requirePermission("events:publish"), ctrl.deleteEvent);

module.exports = router;
