const express = require("express");
const multer = require("multer");
const router = express.Router();
const ctrl = require("../controllers/studentController");
const {
  verifyToken,
  authorizeRoles,
  restrictToOwnStudent,
} = require("../middleware/auth");

router.use(verifyToken);

router.post("/", authorizeRoles("admin"), ctrl.createStudent);
router.get(
  "/stats/summary",
  authorizeRoles("admin", "teacher"),
  ctrl.bulkStats,
);
router.get(
  "/",
  authorizeRoles("admin", "teacher", "student", "parent"),
  ctrl.getStudents,
);
router.get(
  "/:id",
  restrictToOwnStudent((req) => req.params.id),
  ctrl.getStudentById,
);
router.put("/:id", authorizeRoles("admin"), ctrl.updateStudent);
router.delete("/:id", authorizeRoles("admin"), ctrl.deleteStudent);

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
  authorizeRoles("admin"),
  upload.single("photo"),
  ctrl.uploadStudentPhoto,
);

module.exports = router;
