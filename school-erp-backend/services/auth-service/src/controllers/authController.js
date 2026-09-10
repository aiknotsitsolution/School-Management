const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const School = require("../models/School");
const OtpToken = require("../models/OtpToken");
const { validatePassword } = require("../utils/password");
const { sendEmail } = require("../utils/email");
const { getPermissionsFor } = require("@school-erp/shared/src/utils/permissions");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");
const { getJwtSecret } = require("@school-erp/shared/src/utils/jwtSecret");
const { writeAudit } = require("../utils/audit");

const VALID_ROLES = ["super_admin", "school_admin", "class_teacher", "teacher", "staff", "student"];
const SCHOOL_ADMIN_CREATABLE = ["class_teacher", "teacher", "staff", "student"];

// Failure responses never dump raw error/debug text (stack traces, DB paths,
// index/duplicate details) to the client. Details go to the server log only.
const unexpectedError = (res, err) => {
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "Duplicate entry violates a unique constraint" });
  }
  console.error("[auth] unexpected error:", err?.stack || err.message);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};

// School fields a caller may update directly. Tenant identity (code) is
// immutable after creation; anything else is ignored → no mass assignment.
const SCHOOL_EDITABLE_FIELDS = [
  "name",
  "shortName",
  "address",
  "city",
  "phone",
  "email",
  "logo",
  "website",
  "domain",
  "session",
  "plan",
  "status",
];

// Student-role linking: enforce `PlatformUser.refId === Student.admissionNo`
// within the SAME school. When the student record already exists it is linked
// (and blocked if already owned by another active account); when it does not,
// a safe incomplete shell/draft is created for the Admission Counsellor.
const ensureStudentLink = async ({ schoolId, admissionId, userId, name, cls, section }) => {
  try {
    const { getStudentModel } = require("../db/studentDb");
    const Student = await getStudentModel();

    const existing = await Student.findOne({ schoolId, admissionNo: admissionId });
    if (existing) {
      if (existing.userId) {
        const linked = await User.findById(existing.userId).lean();
        if (linked && !linked.deletedAt && String(linked._id) !== String(userId)) {
          return { status: 409, message: "This Admission ID is already linked to another active account" };
        }
      }
      await Student.updateOne({ _id: existing._id }, { $set: { userId: String(userId) } });
      return { linked: existing._id };
    }

    const created = await Student.create({
      schoolId,
      admissionNo: admissionId,
      userId: String(userId),
      name: name ? String(name).trim() : "Student",
      class: cls || null,
      section: section || null,
      profileStatus: "incomplete",
    });
    return { linked: created._id, created: true };
  } catch (err) {
    return { status: 503, message: `Cannot link student profile: ${err.message}` };
  }
};

// True when the given Admission ID already maps to a student record in this
// school. Non-fatal on infrastructure failure so it only ever *prevents* an
// unsafe assignment, never blocks legitimate school operations.
const studentExistsFor = async (schoolId, admissionNo) => {
  try {
    const { getStudentModel } = require("../db/studentDb");
    const Student = await getStudentModel();
    return Boolean(
      await Student.findOne({ schoolId, admissionNo })
        .select("_id")
        .lean(),
    );
  } catch {
    return null;
  }
};

const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  schoolId: user.schoolId || null,
  designation: user.designation || null,
  class: user.class || null,
  section: user.section || null,
  phone: user.phone || null,
  refId: user.refId || null,
  linkedStudentIds: user.linkedStudentIds || [],
  isActive: user.isActive !== false,
  emailVerified: user.emailVerified !== false,
  deletedAt: user.deletedAt || null,
  lastLogin: user.lastLogin || null,
  lastActivity: user.lastActivity || null,
  createdAt: user.createdAt || null,
  permissions: user.deletedAt ? [] : getPermissionsFor(user),
});

// Admin-only user creation (no public self-register). Enforces privilege
// hierarchy so a school admin can never create admins or touch other schools.
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, refId, linkedStudentIds = [], designation, section } = req.body;
    const cls = req.body.class;
    const creator = req.user;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "name, email, password and role are required" });
    }
    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ success: false, message: passErr });
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `role must be one of: ${VALID_ROLES.join(", ")}` });
    }

    let schoolId;
    if (creator.role === "super_admin") {
      schoolId = role === "super_admin" ? null : req.body.schoolId || req.header("X-School-Id") || null;
      if (!schoolId && role !== "super_admin") {
        return res.status(400).json({ success: false, message: "schoolId is required for school-scoped roles" });
      }
    } else {
      if (!SCHOOL_ADMIN_CREATABLE.includes(role)) {
        return res.status(403).json({ success: false, message: "School admin cannot create this role" });
      }
      schoolId = creator.schoolId;
      if (!schoolId) {
        return res.status(403).json({ success: false, message: "School admin must belong to a school" });
      }
    }

    if (role === "staff" && !designation) {
      return res.status(400).json({ success: false, message: "designation is required for staff role" });
    }
    if (role === "class_teacher" && !cls) {
      return res.status(400).json({ success: false, message: "class is required for class_teacher role" });
    }
    // A plain "teacher" account's class/section is an optional PRIMARY teaching
    // scope used by teaching modules (timetable, attendance, homework, marks).
    // Full multi-class scope lives in TeacherAssignment records.

    const admissionId = role === "student" ? String(refId || "").trim() : null;
    if (role === "student" && !admissionId) {
      return res.status(400).json({ success: false, message: "Admission ID (refId) is required for student accounts" });
    }

    // An Admission Counsellor's own refId (Staff ID) must NEVER collide with a
    // student's Admission ID — otherwise their lookup logic could address
    // someone else's profile.
    if (
      role === "staff" &&
      designation === "admission_counsellor" &&
      String(refId || "").trim()
    ) {
      const collides = await studentExistsFor(schoolId, String(refId).trim());
      if (collides) {
        return res.status(409).json({
          success: false,
          message: "This ID belongs to an admitted student — it cannot be used as a counsellor's Staff ID",
        });
      }
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role,
      schoolId,
      designation: designation || undefined,
      class: cls || undefined,
      section: section || undefined,
      phone,
      refId: role === "student" ? String(refId).trim() : refId || null,
      linkedStudentIds,
    });

    // Student accounts must resolve to a real student record in the SAME
    // school (PlatformUser.refId === Student.admissionNo). Failing to link
    // (e.g. cross-school ID, duplicate ownership) rolls the account back.
    if (role === "student") {
      const linkResult = await ensureStudentLink({
        schoolId,
        admissionId,
        userId: user._id,
        name,
        cls,
        section,
      });
      if (linkResult.status) {
        await User.deleteOne({ _id: user._id }).catch(() => {});
        return res.status(linkResult.status).json({ success: false, message: linkResult.message });
      }
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: toPublicUser(user),
    });
    await writeAudit({ req, user: creator, action: "user.created", targetType: "user", targetId: user._id, message: `Created ${role} user ${user.email}` });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "email and password are required" });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: "Invalid credentials" });
    if (user.deletedAt) return res.status(403).json({ success: false, message: "This account has been removed. Contact your school administrator." });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });

    let school = null;
    if (user.schoolId) {
      school = await School.findById(user.schoolId).lean();
      if (!school || school.status !== "active") {
        return res.status(403).json({ success: false, message: "Your school account is inactive" });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken,
        user: toPublicUser(user),
        school: school
          ? { id: school._id, name: school.name, code: school.code, shortName: school.shortName, logo: school.logo, session: school.session, plan: school.plan, status: school.status }
          : null,
      },
    });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: "refreshToken is required" });

    const decoded = jwt.verify(refreshToken, getJwtSecret());
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.deletedAt) return res.status(401).json({ success: false, message: "Invalid refresh token" });
    // Refresh tokens issued before the password was last changed/reset are
    // invalidated so a credential change (or compromise response) kills all
    // existing sessions.
    if (user.passwordChangedAt && decoded.iat * 1000 <= user.passwordChangedAt.getTime()) {
      return res.status(401).json({ success: false, message: "Session expired, please log in again" });
    }

    const accessToken = generateAccessToken(user);
    const newRefresh = generateRefreshToken(user);
    res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let school = null;
    if (user.schoolId) school = await School.findById(user.schoolId).select("name code shortName logo session plan status").lean();

    res.json({ success: true, data: { user: toPublicUser(user), school } });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(400).json({ success: false, message: "Old password incorrect" });

    const passErr = validatePassword(newPassword);
    if (passErr) return res.status(400).json({ success: false, message: passErr });

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const listUsers = async (req, res) => {
  try {
    const { role, schoolId, q, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (req.user.role === "super_admin") {
      const sid = schoolId || req.header("X-School-Id") || null;
      if (sid) filter.schoolId = sid;
    } else {
      filter.schoolId = req.user.schoolId;
    }
    if (role) filter.role = role;
    if (req.query.includeDeleted !== "true") filter.deletedAt = null;

    if (q && String(q).trim()) {
      const rx = new RegExp(
        String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      filter.$or = [{ name: rx }, { email: rx }, { refId: rx }];
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (p - 1) * l;

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(l),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, count: users.length, total, page: p, limit: l, pages: Math.ceil(total / l), data: users.map(toPublicUser) });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// Only super_admin can modify super_admin/school_admin; school admins manage
// staff/teachers/students/parents within their own school only.
const loadManageableUser = async (editor, targetId) => {
  const target = await User.findById(targetId);
  if (!target) return { error: { status: 404, message: "User not found" } };

  if (editor.role === "super_admin") return target;

  if (editor.role !== "school_admin") {
    return { error: { status: 403, message: "Access denied for this role" } };
  }
  if (String(target.schoolId) !== String(editor.schoolId)) {
    return { error: { status: 403, message: "Cannot manage user from another school" } };
  }
  if (["super_admin", "school_admin"].includes(target.role)) {
    return { error: { status: 403, message: "Cannot manage this role" } };
  }
  return target;
};

const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") return res.status(400).json({ success: false, message: "isActive must be a boolean" });

    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });
    if (target.deletedAt) return res.status(400).json({ success: false, message: "Restore the user before changing status" });

    target.isActive = isActive;
    await target.save();
    await writeAudit({ req, user: req.user, action: isActive ? "user.activated" : "user.deactivated", targetType: "user", targetId: target._id, message: `${isActive ? "Activated" : "Deactivated"} user ${target.email}` });
    res.json({ success: true, data: toPublicUser(target) });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// Soft delete: preserves the record (and history) while locking access.
const deleteUser = async (req, res) => {
  try {
    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });
    if (String(target._id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account" });
    }

    target.deletedAt = new Date();
    target.isActive = false;
    await target.save();
    await writeAudit({ req, user: req.user, action: "user.soft_deleted", targetType: "user", targetId: target._id, message: `Soft-deleted user ${target.email}` });
    res.json({ success: true, message: "User removed and access revoked. History is preserved." });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// Restore a soft-deleted user (super_admin / same-school school_admin).
const restoreUser = async (req, res) => {
  try {
    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });

    target.deletedAt = null;
    target.isActive = true;
    await target.save();
    await writeAudit({ req, user: req.user, action: "user.restored", targetType: "user", targetId: target._id, message: `Restored user ${target.email}` });
    res.json({ success: true, message: "User restored", data: toPublicUser(target) });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// Update editable profile fields for a manageable user (no roles/emails by
// design here; role changes are a prompted, audited flow).
const updateUser = async (req, res) => {
  try {
    const { designation, class: cls, section, phone, refId, name, linkedStudentIds } = req.body;
    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });
    if (target.deletedAt) return res.status(400).json({ success: false, message: "Restore the user before editing" });

    if (name !== undefined) target.name = String(name).trim();
    if (designation !== undefined) target.designation = designation || null;
    if (cls !== undefined) target.class = cls || null;
    if (section !== undefined) target.section = section || null;
    if (phone !== undefined) target.phone = phone || null;
    if (target.role === "student") {
      const newRef = refId !== undefined ? String(refId || "").trim() : (target.refId || "");
      if (!newRef) {
        return res.status(400).json({ success: false, message: "Admission ID is required for student accounts" });
      }
      if (newRef !== target.refId) {
        const linkResult = await ensureStudentLink({
          schoolId: target.schoolId,
          admissionId: newRef,
          userId: target._id,
          name: target.name,
          cls: target.class,
          section: target.section,
        });
        if (linkResult.status) {
          return res.status(linkResult.status).json({ success: false, message: linkResult.message });
        }
      }
      target.refId = newRef;
    } else if (refId !== undefined) {
      const trimmed = String(refId || "").trim();
      if (
        target.role === "staff" &&
        (target.designation || designation) === "admission_counsellor" &&
        trimmed
      ) {
        const collides = await studentExistsFor(target.schoolId, trimmed);
        if (collides) {
          return res.status(409).json({
            success: false,
            message: "This ID belongs to an admitted student — it cannot be used as a counsellor's Staff ID",
          });
        }
      }
      target.refId = trimmed || null;
    }
    if (linkedStudentIds !== undefined) target.linkedStudentIds = Array.isArray(linkedStudentIds) ? linkedStudentIds : [];

    await target.save();
    await writeAudit({ req, user: req.user, action: "user.updated", targetType: "user", targetId: target._id, message: `Updated user ${target.email}` });
    res.json({ success: true, data: toPublicUser(target) });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// Password recovery (no email/SMS provider in the fleet — admin-initiated).
// An authorised admin generates a short-lived, single-use reset link and hands
// the token to the user out-of-band (in person / phone). Access tokens are
// never issued through this flow and no reset token is ever delivered to an
// unauthenticated caller.
const adminResetPassword = async (req, res) => {
  try {
    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });
    if (target.deletedAt) return res.status(400).json({ success: false, message: "Restore the user before resetting the password" });
    if (!target.isActive) return res.status(400).json({ success: false, message: "Activate the user before resetting the password" });

    const token = jwt.sign(
      { sub: String(target._id), purpose: "password-reset" },
      getJwtSecret(),
      { expiresIn: 15 * 60 },
    );
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${encodeURIComponent(token)}`;

    await writeAudit({ req, user: req.user, action: "user.password_reset_generated", targetType: "user", targetId: target._id, message: `Generated password reset link for ${target.email}` });
    res.json({
      success: true,
      message: "Password reset link generated",
      data: { resetLink, expiresInMinutes: 15, resetUserId: String(target._id) },
    });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// Public endpoint: applies a reset link. The token is the only secret; links
// are signed, short-lived and single-use (passwordChangedAt watermark).
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: "token and newPassword are required" });

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
    }
    if (decoded.purpose !== "password-reset" || !decoded.sub) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
    }

    const passErr = validatePassword(newPassword);
    if (passErr) return res.status(400).json({ success: false, message: passErr });

    const user = await User.findById(decoded.sub).select("+password");
    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
    if (!user.isActive || user.deletedAt) {
      return res.status(403).json({ success: false, message: "This account is inactive or has been removed" });
    }
    if (user.schoolId) {
      const school = await School.findById(user.schoolId).select("status").lean();
      if (!school || school.status !== "active") {
        return res.status(403).json({ success: false, message: "Your school account is inactive" });
      }
    }

    const issuedAtMs = decoded.iat * 1000;
    if (user.passwordChangedAt && issuedAtMs <= user.passwordChangedAt.getTime()) {
      return res.status(400).json({ success: false, message: "This reset link has already been used" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date(issuedAtMs);
    await user.save();
    await writeAudit({ req, user: { id: user._id, email: user.email, role: user.role }, action: "user.password_reset", targetType: "user", targetId: user._id, message: `Password reset for ${user.email}` });
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// ── OTP-based Password Reset ────────────────────────────────────────────────

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const maskEmail = (email) => {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
};

const otpEmailHtml = (otp, name) => `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <div style="background:#1C2331;border-radius:12px;padding:24px;margin-bottom:24px">
    <p style="color:#E8A33D;font-weight:bold;font-size:18px;margin:0">School ERP</p>
  </div>
  <h2 style="color:#1C2331;font-size:20px;margin-bottom:8px">Password Reset OTP</h2>
  <p style="color:#555;font-size:14px;line-height:1.6">Hi ${name || "there"},</p>
  <p style="color:#555;font-size:14px;line-height:1.6">Your one-time password for resetting your password is:</p>
  <div style="background:#F5F5F5;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
    <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1C2331">${otp}</span>
  </div>
  <p style="color:#555;font-size:14px;line-height:1.6">This OTP is valid for <strong>10 minutes</strong>. If you did not request this, please ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="color:#999;font-size:12px">School Management ERP &copy; ${new Date().getFullYear()}</p>
</div>`;

const MAX_OTP_REQUESTS = 3;
const OTP_WINDOW_MS = 15 * 60 * 1000;

const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, message: "email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    const genericMsg = "If an account with that email exists, an OTP has been sent";

    if (!user) return res.json({ success: true, message: genericMsg });
    if (!user.isActive || user.deletedAt) return res.json({ success: true, message: genericMsg });
    if (user.role === "super_admin") {
      return res.json({ success: true, message: genericMsg });
    }

    const cutoff = new Date(Date.now() - OTP_WINDOW_MS);
    const recentCount = await OtpToken.countDocuments({
      userId: user._id,
      purpose: "password-reset",
      createdAt: { $gte: cutoff },
    });
    if (recentCount >= MAX_OTP_REQUESTS) {
      return res.status(429).json({ success: false, message: "Too many requests. Please try again after 15 minutes." });
    }

    await OtpToken.updateMany(
      { userId: user._id, purpose: "password-reset", used: false },
      { $set: { used: true } },
    );

    const plainOtp = generateOtp();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OtpToken.create({
      userId: user._id,
      email: normalizedEmail,
      otp: hashedOtp,
      purpose: "password-reset",
      expiresAt,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: "Your Password Reset OTP — School ERP",
      html: otpEmailHtml(plainOtp, user.name),
    });

    await writeAudit({
      req,
      user: { id: user._id, email: user.email, role: user.role },
      action: "user.password_reset_otp_sent",
      targetType: "user",
      targetId: user._id,
      message: `OTP sent to ${user.email}`,
    });

    res.json({ success: true, message: genericMsg, data: { maskedEmail: maskEmail(normalizedEmail) } });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const MAX_OTP_ATTEMPTS = 5;

const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: "email and otp are required" });

    const normalizedEmail = email.trim().toLowerCase();
    const otpDoc = await OtpToken.findOne({
      email: normalizedEmail,
      purpose: "password-reset",
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new OTP." });
    }

    const valid = await bcrypt.compare(String(otp).trim(), otpDoc.otp);
    if (!valid) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = MAX_OTP_ATTEMPTS - otpDoc.attempts;
      if (remaining <= 0) {
        return res.status(429).json({ success: false, message: "Too many failed attempts. Please request a new OTP." });
      }
      return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.` });
    }

    const resetToken = jwt.sign(
      { sub: String(otpDoc.userId), purpose: "otp-verified-reset", otpId: String(otpDoc._id) },
      getJwtSecret(),
      { expiresIn: 10 * 60 },
    );

    res.json({
      success: true,
      message: "OTP verified successfully",
      data: { resetToken, expiresInMinutes: 10 },
    });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const resetPasswordWithOtp = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: "token and newPassword are required" });

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }
    if (decoded.purpose !== "otp-verified-reset" || !decoded.sub || !decoded.otpId) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    const passErr = validatePassword(newPassword);
    if (passErr) return res.status(400).json({ success: false, message: passErr });

    const user = await User.findById(decoded.sub).select("+password");
    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    if (!user.isActive || user.deletedAt) {
      return res.status(403).json({ success: false, message: "This account is inactive or has been removed" });
    }
    if (user.schoolId) {
      const school = await School.findById(user.schoolId).select("status").lean();
      if (!school || school.status !== "active") {
        return res.status(403).json({ success: false, message: "Your school account is inactive" });
      }
    }

    const otpDoc = await OtpToken.findById(decoded.otpId);
    if (!otpDoc || otpDoc.used) {
      return res.status(400).json({ success: false, message: "This reset token has already been used" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    await user.save();

    otpDoc.used = true;
    await otpDoc.save();

    await writeAudit({
      req,
      user: { id: user._id, email: user.email, role: user.role },
      action: "user.password_reset_otp",
      targetType: "user",
      targetId: user._id,
      message: `Password reset via OTP for ${user.email}`,
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const adminSendResetOtp = async (req, res) => {
  try {
    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });
    if (target.deletedAt) return res.status(400).json({ success: false, message: "Restore the user before sending OTP" });
    if (!target.isActive) return res.status(400).json({ success: false, message: "Activate the user before sending OTP" });

    const normalizedEmail = target.email.toLowerCase();

    await OtpToken.updateMany(
      { userId: target._id, purpose: "password-reset", used: false },
      { $set: { used: true } },
    );

    const plainOtp = generateOtp();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OtpToken.create({
      userId: target._id,
      email: normalizedEmail,
      otp: hashedOtp,
      purpose: "password-reset",
      expiresAt,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: "Your Password Reset OTP — School ERP",
      html: otpEmailHtml(plainOtp, target.name),
    });

    await writeAudit({
      req,
      user: req.user,
      action: "user.password_reset_otp_sent_admin",
      targetType: "user",
      targetId: target._id,
      message: `Admin sent OTP to ${target.email}`,
    });

    res.json({
      success: true,
      message: `OTP sent to ${maskEmail(normalizedEmail)}`,
      data: { maskedEmail: maskEmail(normalizedEmail) },
    });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

// School / tenant management (platform layer) -------------------------------

const createSchool = async (req, res) => {
  try {
    const { name, code, shortName, address, city, phone, email, logo, session, plan, status } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: "name and code are required" });

    const codeSlug = String(code).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const existing = await School.findOne({ code: codeSlug });
    if (existing) return res.status(409).json({ success: false, message: "School code already exists" });

    const school = await School.create({ name, code: codeSlug, shortName, address, city, phone, email, logo, session, plan, status });
    await writeAudit({ req, user: req.user, action: "school.created", targetType: "school", targetId: school._id, message: `Created school ${name} (${codeSlug})` });
    res.status(201).json({ success: true, message: "School created successfully", data: school });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const listSchools = async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req.query, { fallback: 50, max: 200 });
    const filter = {};
    if (req.query.q && String(req.query.q).trim()) {
      filter.name = { $regex: String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }
    const [schools, total] = await Promise.all([
      School.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      School.countDocuments(filter),
    ]);
    res.json({ success: true, count: schools.length, total, ...pageInfo(total, page, limit), data: schools });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const getSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ success: false, message: "School not found" });
    res.json({ success: true, data: school });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const updateSchool = async (req, res) => {
  try {
    const patch = {};
    for (const key of SCHOOL_EDITABLE_FIELDS) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    const school = await School.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!school) return res.status(404).json({ success: false, message: "School not found" });
    await writeAudit({ req, user: req.user, action: "school.updated", targetType: "school", targetId: school._id, message: `Updated school fields: ${Object.keys(patch).join(", ") || "(none)"}` });
    res.json({ success: true, message: "School updated successfully", data: school });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const verify = async (req, res) => {
  res.json({ success: true, data: req.user });
};

// ------------------------------------------------- self-service school branding
// Report-card customization lives on the school record: top-level logo/address
// plus settings.reportCard (affiliation, tagline, footerNote, accent). Only a
// whitelist is editable so a school admin can never touch platform settings.
const REPORT_CARD_SETTINGS_FIELDS = ["affiliation", "tagline", "footerNote", "accent"];
const ID_CARD_SETTINGS_FIELDS = [
  "accent",
  "headerTitle",
  "footerNote",
  "showParentContact",
  "showBloodGroup",
  "showDob",
  "showRollNo",
  "showHouse",
];
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
const BOOL_RE = /^(true|false)$/i;

// Logo may be an http(s) URL or an uploaded base64 data URI (capped size).
// Returns null when invalid, "" when explicitly cleared.
const sanitizeLogo = (logo) => {
  if (logo == null) return "";
  if (typeof logo !== "string") return null;
  const str = logo.trim();
  if (str === "") return "";
  if (str.length > 2_000_000) return null;
  if (/^https?:\/\//i.test(str)) return str;
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/.test(str)) return str;
  return null;
};

// Shape exposed to the client for self-service school endpoints. Mirrors the
// login `school` payload while adding address + settings for the admin UI.
const publicSchool = (s) =>
  s && {
    id: s._id,
    name: s.name,
    code: s.code,
    shortName: s.shortName || "",
    address: s.address || "",
    logo: s.logo || "",
    session: s.session || "",
    plan: s.plan || "trial",
    status: s.status || "active",
    settings: s.settings || {},
  };

const getMySchool = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: "No school context" });
    }
    const school = await School.findById(req.tenantId).lean();
    if (!school) return res.status(404).json({ success: false, message: "School not found" });
    res.json({ success: true, data: publicSchool(school) });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

const updateMySchool = async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: "No school context" });
    }
    const school = await School.findById(req.tenantId);
    if (!school) return res.status(404).json({ success: false, message: "School not found" });

    const set = {};
    if (req.body.shortName !== undefined) set.shortName = String(req.body.shortName).trim();
    if (req.body.address !== undefined) set.address = String(req.body.address).trim();
    if (req.body.logo !== undefined) {
      const logo = sanitizeLogo(req.body.logo);
      if (logo === null) {
        return res.status(400).json({
          success: false,
          message: "Logo must be an image URL or an uploaded image (max 2MB)",
        });
      }
      set.logo = logo;
    }

    const rc = req.body.reportCard;
    if (rc && typeof rc === "object") {
      for (const key of REPORT_CARD_SETTINGS_FIELDS) {
        if (rc[key] === undefined) continue;
        if (key === "accent") {
          const value = String(rc[key] || "").trim();
          if (!ACCENT_RE.test(value)) {
            return res.status(400).json({ success: false, message: "Accent must be a hex color like #E8A33D" });
          }
          set[`settings.reportCard.${key}`] = value;
        } else {
          set[`settings.reportCard.${key}`] = String(rc[key] ?? "").trim();
        }
      }
    }

    const idc = req.body.idCard;
    if (idc && typeof idc === "object") {
      for (const key of ID_CARD_SETTINGS_FIELDS) {
        if (idc[key] === undefined) continue;
        const path = `settings.idCard.${key}`;
        if (key === "accent") {
          const value = String(idc[key] || "").trim();
          if (!ACCENT_RE.test(value)) {
            return res.status(400).json({ success: false, message: "ID card accent must be a hex color like #1E2A44" });
          }
          set[path] = value;
        } else if (key.startsWith("show") && typeof idc[key] === "boolean") {
          set[path] = idc[key];
        } else {
          set[path] = String(idc[key] ?? "").trim();
        }
      }
    }

    if (Object.keys(set).length) {
      await School.updateOne({ _id: school._id }, { $set: set });
    }

    const fresh = await School.findById(school._id).lean();
    await writeAudit({
      req,
      user: req.user,
      action: "school.settings_updated",
      targetType: "school",
      targetId: school._id,
      message: "School updated branding (report card / ID card)",
    });
    res.json({ success: true, message: "School branding updated", data: publicSchool(fresh) });
  } catch (err) {
    return unexpectedError(res, err);
  }
};

module.exports = {
  createUser, login, refreshToken, getMe, changePassword,
  listUsers, updateUserStatus, deleteUser, restoreUser, updateUser,
  adminResetPassword, resetPassword,
  requestPasswordReset, verifyResetOtp, resetPasswordWithOtp, adminSendResetOtp,
  createSchool, listSchools, getSchool, updateSchool,
  getMySchool, updateMySchool,
  verify,
};