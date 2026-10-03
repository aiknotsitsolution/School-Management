const express = require("express");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
const ctrl = require("../controllers/conversationController");
const { verifyToken, resolveTenant, requireTenant } = require("../middleware/auth");

// Direct person-to-person messaging. This is separate from messageRoutes.js
// (the student-anchored parent <-> class-teacher threads) and the two do not
// share storage or access rules.
//
// Membership is verified per request against the conversation's participant
// list, so there is no single role that owns the feature: a student, a parent,
// a teacher and an admin can all hold a conversation. What every request does
// require is a resolved tenant — the tenant is the only access boundary here,
// since both participants are by construction users of the same school.
router.use(verifyToken, resolveTenant, requireTenant);

router.get("/people", ctrl.searchPeople);
router.get("/", ctrl.listConversations);
router.post("/", ctrl.openConversation);
router.get("/:id", ctrl.getConversation);
router.post("/:id/reply", ctrl.replyToConversation);

module.exports = router;
