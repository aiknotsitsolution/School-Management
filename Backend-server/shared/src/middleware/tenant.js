const mongoose = require("mongoose");

// Matches a strictly 24-char hex ObjectId. Mongoose's ObjectId.isValid also
// accepts 12-byte strings, which would let a junk header through; caller
// identity for X-School-Id must be a real ObjectId.
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

// Methods that cannot mutate tenant state. DELETE is deliberately absent:
// soft delete writes deletedAt, which is still a write.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Guardrail for platform impersonation, NOT a trust boundary.
 *
 * A super_admin holds the wildcard permission set and can always impersonate a
 * tenant, so this cannot stop a determined caller — it only has to stop the
 * ordinary case of a support session mutating a real school's payroll by
 * muscle memory. That is worth doing: soft delete makes a mistaken delete
 * recoverable, but a fee or payroll edit is not.
 *
 * It is enforced here because resolveTenant is the single choke point every
 * service router passes through (router.use(verifyToken, resolveTenant, ...)),
 * so one change covers every module instead of one per service.
 */
const resolveTenant = async (req, res, next) => {
  try {
    let schoolId = req.user.schoolId || null;
    const rawHeader = req.header("X-School-Id");
    if (req.user.role === "super_admin" && rawHeader) {
      const candidate = String(rawHeader).trim();
      if (!OBJECT_ID_REGEX.test(candidate)) {
        return res.status(400).json({ success: false, message: "X-School-Id must be a valid ObjectId" });
      }
      const SchoolModel = mongoose.models.School;
      if (SchoolModel) {
        const school = await SchoolModel.findById(candidate).select({ _id: 1 }).lean();
        if (!school) {
          return res.status(400).json({ success: false, message: "School not found for X-School-Id" });
        }
      }
      schoolId = candidate;
      // Absent header means read-only: a client that never heard of the mode
      // must not be able to write by omission.
      if (!SAFE_METHODS.has(req.method) && req.header("X-Impersonate-Mode") !== "write") {
        return res.status(403).json({
          success: false,
          message:
            "Impersonation session is read-only. Re-enable editing in the tenant switcher to make changes.",
        });
      }
    }
    req.tenantId = schoolId;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { resolveTenant };