const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getPermissionsFor } = require("../utils/permissions");
const { getJwtSecret } = require("../utils/jwtSecret");
const JWT_SECRET = getJwtSecret();

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    const UserModel = mongoose.models.User;
    if (process.env.TOKEN_VALIDATION !== "off" && UserModel) {
      const user = await UserModel.findById(decoded.id).select("isActive schoolId").lean();
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, message: "Account is inactive" });
      }
      if (user.schoolId && String(user.schoolId) !== String(decoded.schoolId || "")) {
        return res.status(401).json({ success: false, message: "Token tenant mismatch" });
      }
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const resolveTenant = (req, res, next) => {
  let schoolId = req.user.schoolId || null;
  if (req.user.role === "super_admin" && req.header("X-School-Id")) {
    schoolId = req.header("X-School-Id");
  }
  req.tenantId = schoolId;
  next();
};

const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({ success: false, message: "No school context for this request" });
  }
  next();
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
  const perms = getPermissionsFor(req.user);
  if (!perms.includes("*") && !perms.includes(permission)) {
    return res.status(403).json({ success: false, message: "Access denied for this role" });
  }
  next();
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Access denied for this role" });
  }
  next();
};

const scopeStudentQuery = (req, res, next) => {
  if (req.user.role === "student") req.query.studentId = req.user.refId;
  next();
};

// Locks timetable/homework/exam GET queries to the student's own class (and
// optionally section). A student can never read another class's schedule.
const scopeStudentSchedule = ({ section = false } = {}) => (req, res, next) => {
  if (req.user.role !== "student") return next();
  const { class: cls, section: sec } = req.user || {};
  if (!cls) {
    return res.status(403).json({
      success: false,
      message: "No class assigned to this account. Contact your school admin.",
    });
  }
  req.query.class = String(cls);
  if (section && sec) req.query.section = String(sec);
  else if (section) delete req.query.section;
  next();
};

// Teacher scoping (class_teacher — homeroom holder — or teacher with a primary
// teaching scope): locks GET queries to the token's class & section and rejects
// teachers with no class assignment. Full multi-class scope lives in
// TeacherAssignment; this middleware enforces the primary scope server-side.
const scopeClassTeacher = (req, res, next) => {
  const { role, class: cls, section } = req.user || {};
  if (!["class_teacher", "teacher"].includes(role)) return next();
  if (!cls) {
    return res.status(403).json({
      success: false,
      message: "No class assigned to this account. Contact your school admin.",
    });
  }
  req.teacherScope = { class: String(cls), section: section ? String(section) : null };
  if (req.method === "GET") {
    req.query.class = req.teacherScope.class;
    if (req.teacherScope.section) req.query.section = req.teacherScope.section;
    else delete req.query.section;
  }
  next();
};

// For class_teacher writes: validates that class/section fields carried in the
// request body match the teacher's assignment. `arrayField` points to an array
// of records (e.g. attendance records); otherwise the body itself is checked.
const guardClassBody = (arrayField) => (req, res, next) => {
  const scope = req.teacherScope;
  if (!scope) return next();
  const items = arrayField ? req.body[arrayField] : req.body;
  const list = Array.isArray(items) ? items : [items];
  const mismatch = list.some(
    (r) =>
      !r ||
      String(r.class) !== scope.class ||
      (scope.section && String(r.section) !== scope.section)
  );
  if (mismatch) {
    return res.status(403).json({
      success: false,
      message: "Class Teacher can only manage their assigned class and section",
    });
  }
  next();
};

module.exports = { verifyToken, resolveTenant, requireTenant, requirePermission, authorizeRoles, scopeStudentQuery, scopeStudentSchedule, scopeClassTeacher, guardClassBody };
