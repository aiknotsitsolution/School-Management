const express = require("express");
const multer = require("multer");
const router = express.Router();
const ctrl = require("../controllers/studentController");
const {
  verifyToken,
  resolveTenant,
  requireTenant,
  requirePermission,
  restrictToOwnStudent,
} = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

router.post("/", requirePermission("students:write"), ctrl.createStudent);
router.get(
  "/stats/summary",
  requirePermission("students:read"),
  ctrl.bulkStats,
);
// "Current student" must be declared before the parameterized /:id route.
router.get("/me", requirePermission("students:read"), ctrl.getMyStudent);
router.get(
  "/counsellor/stats",
  requirePermission("students:read"),
  ctrl.counsellorStats,
);
router.get("/", requirePermission("students:read"), ctrl.getStudents);
router.get(
  "/:id",
  requirePermission("students:read"),
  restrictToOwnStudent((req) => req.params.id),
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
