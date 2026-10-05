const express = require("express");
const multer = require("multer");
const router = express.Router();
const { validateObjectIdParam } = require("@school-erp/shared/src/middleware/objectId");
router.param("id", validateObjectIdParam);
const ctrl = require("../controllers/studyMaterialController");
const { verifyToken, resolveTenant, requireTenant, requirePermission, scopeStudentSchedule, scopeClassTeacher, scopeClassTeacherAggregate, guardClassBody } = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Material files (PDF e-books, worksheets, images) live on the CDN; this is
// the same in-memory multer + byte-signature check the documents flow uses.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    if (ok) return callback(null, true);
    callback(new Error("Only PDF and image files are allowed"));
  },
});

// Materials are listed class-wise (the manage screen filters by class only), so
// the read is a class aggregate. Teachers stay pinned to the class the route
// resolved and to the sections they are assigned to; students are pinned to
// their own class (and section) so one class can never read another's shelf.
// Read sits on library:read (not homework:read) because the shelf now lives in
// the Library, which every staff designation may browse — writes stay on
// homework:write (school admin + teachers).
router.get("/", requirePermission("library:read"), scopeStudentSchedule({ section: true }), scopeClassTeacherAggregate, ctrl.getMaterials);
router.post("/upload", requirePermission("homework:write"), upload.single("file"), ctrl.uploadMaterialFile);
router.post("/", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.createMaterial);
router.patch("/:id", requirePermission("homework:write"), scopeClassTeacher, guardClassBody(), ctrl.updateMaterial);
router.delete("/:id", requirePermission("homework:write"), scopeClassTeacher, ctrl.deleteMaterial);

module.exports = router;
