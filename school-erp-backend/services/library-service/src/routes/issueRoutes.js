const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/issueController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentParam } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/issue", requirePermission("library:manage"), ctrl.issueBook);
router.patch("/:id/return", requirePermission("library:manage"), ctrl.returnBook);
router.get("/", requirePermission("library:read"), scopeStudentParam("borrowerId"), ctrl.getIssues);

module.exports = router;
