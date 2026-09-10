const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getPermissionsFor } = require("@school-erp/shared/src/utils/permissions");
const { getJwtSecret } = require("@school-erp/shared/src/utils/jwtSecret");
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
    req.token = header.split(" ")[1];
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

// Staff, teachers & class_teacher scoped to their own record; school_admin /
// super_admin see all. "teacher" resolves via Staff.userId / email / refId.
const restrictToOwnStaff = (getStaffIdFromReq) => (req, res, next) => {
  if (["school_admin", "super_admin"].includes(req.user.role)) return next();
  if (["class_teacher", "teacher", "staff"].includes(req.user.role)) {
    const targetId = getStaffIdFromReq(req);
    if (req.user.refId === targetId) return next();
    return res.status(403).json({ success: false, message: "You can only access your own staff record" });
  }
  next();
};

module.exports = { verifyToken, resolveTenant, requireTenant, requirePermission, authorizeRoles, scopeStudentQuery, restrictToOwnStaff };
