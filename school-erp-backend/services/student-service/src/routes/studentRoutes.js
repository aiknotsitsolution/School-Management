const express = require("express");
const multer = require("multer");
const router = express.Router();
const { validateObjectIdParam } = require("../middleware/objectId");
router.param("id", validateObjectIdParam);
router.param("homeworkId", validateObjectIdParam);
const ctrl = require("../controllers/studentController");
const {
  verifyToken,
  resolveTenant,
  requireTenant,
  requirePermission,
  restrictToOwnStudent,
  scopeClassTeacher,
} = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Own-profile lookup is self-scoped (token refId) and only served to
// student/parent accounts; the gate mirrors that intent instead of requiring
// students:read.
const gateOwnProfile = (req, res, next) => {
  const perm = ["student", "parent"].includes(req.user.role)
    ? "profile:read"
    : "students:read";
  return requirePermission(perm)(req, res, next);
};

router.post("/", requirePermission("students:write"), ctrl.createStudent);
router.get(
  "/stats/summary",
  requirePermission("students:read"),
  scopeClassTeacher,
  ctrl.bulkStats,
);
// "Current student" must be declared before the parameterized /:id route.
router.get("/me", gateOwnProfile, ctrl.getMyStudent);
router.get(
  "/counsellor/stats",
  requirePermission("students:read"),
  scopeClassTeacher,
  ctrl.counsellorStats,
);
router.get("/", requirePermission("students:read"), scopeClassTeacher, ctrl.getStudents);
router.get(
  "/:id",
  requirePermission("students:read"),
  restrictToOwnStudent((req) => req.params.id),
  scopeClassTeacher,
  ctrl.getStudentById,
);
router.put("/:id", requirePermission("students:write"), ctrl.updateStudent);
router.post(
  "/:id/complete-profile",
  requirePermission("students:write"),
  ctrl.completeProfile,
);
router.delete("/:id", requirePermission("students:write"), ctrl.deleteStudent);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype.startsWith("image/")) return callback(null, true);
    callback(new Error("Only image files are allowed"));
  },
});

router.post(
  "/upload-photo",
  requirePermission("students:write"),
  upload.single("photo"),
  ctrl.uploadStudentPhoto,
);

module.exports = router;
