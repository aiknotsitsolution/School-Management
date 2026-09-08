const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getPermissionsFor } = require("../utils/permissions");
const { getJwtSecret } = require("../utils/jwtSecret");
const JWT_SECRET = getJwtSecret();

// Decodes the JWT and attaches the tenant + role payload to req.user.
// Validates account activity when the User model is registered (auth-service).
const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);

    const UserModel = mongoose.models.User;
    if (process.env.TOKEN_VALIDATION !== "off" && UserModel) {
      const user = await UserModel.findById(decoded.id)
        .select("isActive schoolId")
        .lean();
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

// Resolves the effective tenant for this request. Normal users inherit it from
// the token; platform (super_admin) can act on behalf of a school via the
// X-School-Id header.
const resolveTenant = (req, res, next) => {
  let schoolId = req.user.schoolId || null;
  if (req.user.role === "super_admin" && req.header("X-School-Id")) {
    schoolId = req.header("X-School-Id");
  }
  req.tenantId = schoolId;
  next();
};

// Guards that a school-scoped resource actually has a tenant. Super_admin
// without X-School-Id cannot hit school-scoped domain routes.
const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({ success: false, message: "No school context for this request" });
  }
  next();
};

// Role-scoped guard. More granular than authorizeRoles.
const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
  const perms = getPermissionsFor(req.user);
  if (!perms.includes("*") && !perms.includes(permission)) {
    return res.status(403).json({ success: false, message: "Access denied for this role" });
  }
  next();
};

// Coarse role guard (kept for existing callers).
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Access denied for this role" });
  }
  next();
};

// Students see only their own data (single student/parent account).
const scopeStudentQuery = (req, res, next) => {
  if (req.user.role === "student") req.query.studentId = req.user.refId;
  next();
};

// Restrict a student to only their own record(s); staff/class teachers allowed.
const restrictToOwnStudent = (getStudentIdFromReq) => (req, res, next) => {
  if (["school_admin", "class_teacher", "staff"].includes(req.user.role)) return next();
  const targetId = getStudentIdFromReq(req);
  if (req.user.role === "student" && req.user.refId === targetId) return next();
  return res.status(403).json({ success: false, message: "You can only access your own student record" });
};

// Class Teacher scoping: locks GET queries to the teacher's assigned class
// & section and rejects teachers with no class assignment.
const scopeClassTeacher = (req, res, next) => {
  const { role, class: cls, section } = req.user || {};
  if (role !== "class_teacher") return next();
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

module.exports = { verifyToken, resolveTenant, requireTenant, requirePermission, authorizeRoles, scopeStudentQuery, restrictToOwnStudent, scopeClassTeacher };