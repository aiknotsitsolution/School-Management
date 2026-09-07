const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getPermissionsFor } = require("../utils/permissions");
const { getJwtSecret } = require("../utils/jwtSecret");
const JWT_SECRET = getJwtSecret();

// Decodes the JWT and attaches the tenant + role payload to req.user.
// When the User model is registered (auth-service), also validates that the
// account is still active so disabled users lose access immediately.
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

module.exports = { verifyToken, resolveTenant, requirePermission, authorizeRoles, scopeStudentQuery };