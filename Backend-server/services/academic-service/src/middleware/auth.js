const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getPermissionsFor } = require("@school-erp/shared/src/utils/permissions");
const { getJwtSecret } = require("@school-erp/shared/src/utils/jwtSecret");
const {
  scopeClassTeacher,
  guardClassBody,
} = require("@school-erp/shared/src/middleware/teacherScopeAuth");
const { resolveTenant } = require("@school-erp/shared/src/middleware/tenant");
const JWT_SECRET = getJwtSecret();

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    const UserModel = mongoose.models.User;
    const tokenValidationOff = process.env.TOKEN_VALIDATION === "off" && process.env.NODE_ENV !== "production";
    if (!tokenValidationOff && UserModel) {
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

// Teacher scoping is ASSIGNMENT-driven: an authenticated teacher's authority
// is resolved from active TeacherAssignment records (teaching + class_teacher)
// for the current session and exposed on req.teacherScope. See
// @school-erp/shared/src/middleware/teacherScopeAuth for the implementation.
//
//   req.teacherScope = {
//     teaching:      [{ class, section, subject }],
//     classTeacher:  [{ class, section }],
//     allScopes:     [{ class, section }],   // deduped union
//     hasClassTeacher,
//     has(class, section),                   // scope membership check
//     class, section                         // resolved single-class address
//   }
//
// guardClassBody validates write bodies against req.teacherScope.allScopes.

module.exports = { verifyToken, resolveTenant, requireTenant, requirePermission, authorizeRoles, scopeStudentQuery, scopeStudentSchedule, scopeClassTeacher, guardClassBody };
