const jwt = require("jsonwebtoken");

// JWT v2 payload carries tenant + role data so every downstream service can
// enforce scoping without a DB round trip. Access tokens are short-lived on
// purpose so role/isActive/school-status changes take effect quickly.
const generateAccessToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      schoolId: user.schoolId || null,
      refId: user.refId || null,
      designation: user.designation || null,
      class: user.class || null,
      section: user.section || null,
      linkedStudentIds: user.linkedStudentIds || [],
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "30m" }
  );

const generateRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  });

module.exports = { generateAccessToken, generateRefreshToken };