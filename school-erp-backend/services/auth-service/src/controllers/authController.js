const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const School = require("../models/School");
const { validatePassword } = require("../utils/password");
const { getPermissionsFor } = require("../utils/permissions");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");
const { getJwtSecret } = require("../utils/jwtSecret");
const { writeAudit } = require("../utils/audit");

const VALID_ROLES = ["super_admin", "school_admin", "class_teacher", "staff", "student"];
const SCHOOL_ADMIN_CREATABLE = ["class_teacher", "staff", "student"];

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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: "refreshToken is required" });

    const decoded = jwt.verify(refreshToken, getJwtSecret());
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.deletedAt) return res.status(401).json({ success: false, message: "Invalid refresh token" });

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
    res.status(500).json({ success: false, message: err.message });
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
    await user.save();
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
  }
};

const listSchools = async (req, res) => {
  try {
    const schools = await School.find().sort({ createdAt: -1 });
    res.json({ success: true, count: schools.length, data: schools });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSchool = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ success: false, message: "School not found" });
    res.json({ success: true, data: school });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    res.status(500).json({ success: false, message: err.message });
  }
};

const verify = async (req, res) => {
  res.json({ success: true, data: req.user });
};

module.exports = {
  createUser, login, refreshToken, getMe, changePassword,
  listUsers, updateUserStatus, deleteUser, restoreUser, updateUser,
  createSchool, listSchools, getSchool, updateSchool,
  verify,
};