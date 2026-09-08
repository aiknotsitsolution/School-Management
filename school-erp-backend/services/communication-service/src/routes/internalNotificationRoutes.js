const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/notificationController");

// [INTERNAL] Service-to-service inbound. Not intended for browser clients.
// Guarded by a shared secret (INTERNAL_NOTIFY_KEY) rather than a user JWT.
const internalKey = process.env.INTERNAL_NOTIFY_KEY;

router.post("/push-by-refs", (req, res, next) => {
  const presented = req.headers["x-internal-key"];
  if (!internalKey || !presented || presented !== internalKey) {
    return res.status(401).json({ success: false, message: "Invalid internal key" });
  }
  next();
}, ctrl.pushByRefIds);

module.exports = router;