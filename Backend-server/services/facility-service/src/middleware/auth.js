const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getPermissionsFor } = require("@school-erp/shared/src/utils/permissions");
const { getJwtSecret } = require("@school-erp/shared/src/utils/jwtSecret");
const { resolveTenant } = require("@school-erp/shared/src/middleware/tenant");
const { requireSchoolActive } = require("@school-erp/shared/src/middleware/requireSchoolActive");
const { requireSubscriptionActive } = require("@school-erp/shared/src/middleware/requireSubscriptionActive");
const { resolveBranchScope } = require("@school-erp/shared/src/middleware/branchScope");
const JWT_SECRET = getJwtSecret();

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(header.split(" ")[1], JWT_SECRET);
    // Reject refresh tokens used as access tokens (typ claim).
    if (decoded.typ !== "access") {
      return res.status(401).json({ success: false, message: "Invalid token type" });
    }
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

const requireTenant = async (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({ success: false, message: "No school context for this request" });
  }
  return requireSchoolActive(req, res, (err) => {
    if (err) return next(err);
    // Branch scope is part of school context, so it resolves here rather than
    // per route: every router already runs requireTenant, which keeps
    // X-Branch-Id honoured on all endpoints without touching route files.
    return requireSubscriptionActive(req, res, (subErr) => {
      if (subErr) return next(subErr);
      return resolveBranchScope(req, res, next);
    });
  });
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
  const perms = getPermissionsFor(req.user);
  if (!perms.includes("*") && !perms.includes(permission)) {
    return res.status(403).json({ success: false, message: "Access denied for this role" });
  }
  next();
};

// Satisfied by holding *any one* of the listed permissions. Needed by the shared
// place-search surface, which serves two unrelated features (the transport route
// planner and the branch form). Gating it on a single permission would force one
// of those features to depend on the other's permission set — a school admin who
// can edit branches but not transport could not locate their own campus.
const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
  const perms = getPermissionsFor(req.user);
  if (!perms.includes("*") && !permissions.some((p) => perms.includes(p))) {
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

// Like scopeStudentQuery but thrusts the student's own id into any query param
// (e.g. "borrowerId" for library issues, "studentId" for transport).
const scopeStudentParam = (param) => (req, res, next) => {
  if (req.user.role === "student") req.query[param] = req.user.refId;
  next();
};

module.exports = { verifyToken, resolveTenant, requireTenant, requirePermission, requireAnyPermission, authorizeRoles, scopeStudentQuery, scopeStudentParam };
