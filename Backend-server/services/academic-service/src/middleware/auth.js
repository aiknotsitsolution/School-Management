const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { getPermissionsFor } = require("@school-erp/shared/src/utils/permissions");
const { getJwtSecret } = require("@school-erp/shared/src/utils/jwtSecret");
const {
  scopeClassTeacher,
  scopeClassTeacherAggregate,
  guardClassBody,
} = require("@school-erp/shared/src/middleware/teacherScopeAuth");
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

    // A student's class/section live on the Student record. User.class is only
    // a denormalised copy, older accounts never received it, and the JWT is
    // minted from User at login — so an empty claim here silently 403s every
    // class-scoped student read (timetable, homework, exams), empties the
    // substitution list (substitutionController) and blocks the homework gate
    // (homeworkSubmissionController), even though /students/me happily returns
    // the class. Resolve from the authority so a broken account works
    // immediately: no backfill, no re-login.
    //
    // Scoped to exactly the broken case and loaded lazily, so the student
    // mirror connection is never opened for teachers/admins or for accounts
    // whose claim is already correct.
    if (decoded.role === "student" && !decoded.class && decoded.refId) {
      try {
        const { getStudentModel } = require("../db/studentDb");
        const Student = await getStudentModel();
        const doc = await Student.findOne({
          schoolId: decoded.schoolId,
          admissionNo: decoded.refId,
        })
          .select("class section")
          .lean();
        if (doc && doc.class) {
          req.user.class = doc.class;
          req.user.section = doc.section || null;
        }
      } catch (resolveErr) {
        // Deliberately swallowed: falling through leaves the empty claim, so
        // the route's own scope middleware answers with its clear 403 instead
        // of this becoming a 401/500 on a cosmetic field.
        console.error("[verifyToken] student class resolve failed:", resolveErr.message);
      }
    }

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

// Satisfied by holding *any one* of the listed permissions. The study-material
// writes use this: the shelf lives in the Library, so the librarian manages it
// through library:manage, while teachers/admins reach it through homework:write
// (their existing surface). Gating on one permission would either lock the
// librarian out of e-book uploads or hand every staff designation homework
// writes.
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
  if (req.user.role === "student") {
    req.query.studentId = req.user.refId;
    return next();
  }
  // Parents are scoped to their linked children: without an explicit
  // ?studentId they list all linked children via $in; with one they may only
  // pick one of their own children (never someone else's).
  if (req.user.role === "parent") {
    const linked = (req.user.linkedStudentIds || []).map((s) => String(s)).filter(Boolean);
    if (linked.length === 0) {
      // Fail closed: no children, so the query can never match anyone.
      req.query.studentId = { $in: [] };
      return next();
    }
    if (req.query.studentId) {
      const requested = String(req.query.studentId).trim();
      if (!linked.includes(requested)) {
        return res.status(403).json({ success: false, message: "You can only view your linked children's data" });
      }
      req.query.studentId = requested;
      return next();
    }
    req.query.studentId = { $in: linked };
    return next();
  }
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
//     sectionsFor(class),                    // assigned sections of one class
//     class, section, sections               // resolved request address
//   }
//
// guardClassBody validates write bodies against req.teacherScope.allScopes.

module.exports = { verifyToken, resolveTenant, requireTenant, requirePermission, requireAnyPermission, authorizeRoles, scopeStudentQuery, scopeStudentSchedule, scopeClassTeacher, scopeClassTeacherAggregate, guardClassBody };
