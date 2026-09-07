const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const School = require("../models/School");
const { validatePassword } = require("../utils/password");
const { getPermissionsFor } = require("../utils/permissions");
const { generateAccessToken, generateRefreshToken } = require("../utils/generateToken");
const { getJwtSecret } = require("../utils/jwtSecret");

const VALID_ROLES = ["super_admin", "school_admin", "class_teacher", "staff", "student"];
const SCHOOL_ADMIN_CREATABLE = ["class_teacher", "staff", "student"];

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
  permissions: getPermissionsFor(user),
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
      refId: refId || null,
      linkedStudentIds,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: toPublicUser(user),
    });
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
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: "Invalid refresh token" });

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
    const { role, schoolId } = req.query;
    const filter = {};

    if (req.user.role === "super_admin") {
      const sid = schoolId || req.header("X-School-Id") || null;
      if (sid) filter.schoolId = sid;
    } else {
      filter.schoolId = req.user.schoolId;
    }
    if (role) filter.role = role;

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users.map(toPublicUser) });
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
    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });

    target.isActive = isActive;
    await target.save();
    res.json({ success: true, data: toPublicUser(target) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const target = await loadManageableUser(req.user, req.params.id);
    if (target.error) return res.status(target.error.status).json({ success: false, message: target.error.message });

    await User.findByIdAndDelete(target._id);
    res.json({ success: true, message: "User deleted" });
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
    const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!school) return res.status(404).json({ success: false, message: "School not found" });
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
  listUsers, updateUserStatus, deleteUser,
  createSchool, listSchools, getSchool, updateSchool,
  verify,
};