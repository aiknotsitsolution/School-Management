// [INTERNAL] Service-to-service recipient-resolution for academic notifications
// (returns admissionNos = the refId that pushByRefIds resolves). Guarded by the
// shared INTERNAL_NOTIFY_KEY exactly like communication-service's internal
// routes, and firewalled out of the public gateway alongside those routes.
const express = require("express");
const crypto = require("node:crypto");
const Student = require("../models/Student");

const router = express.Router();

const internalKey = process.env.INTERNAL_NOTIFY_KEY;
const keyUsable = Boolean(internalKey) && internalKey.length >= 32;

router.get("/by-class", (req, res, next) => {
  if (!keyUsable) {
    return res.status(503).json({
      success: false,
      message: "Internal channel is not configured",
    });
  }
  const presented = req.headers["x-internal-key"];
  if (!presented) {
    return res.status(401).json({ success: false, message: "Invalid internal key" });
  }
  const expectedHex = Buffer.from(String(internalKey), "utf8").toString("hex");
  const presentedHex = Buffer.from(String(presented), "utf8").toString("hex");
  const valid =
    expectedHex.length === presentedHex.length &&
    crypto.timingSafeEqual(Buffer.from(expectedHex), Buffer.from(presentedHex));
  if (!valid) {
    return res.status(401).json({ success: false, message: "Invalid internal key" });
  }
  next();
}, async (req, res) => {
  try {
    const { schoolId, branchId, class: cls, section } = req.query;
    if (!schoolId || !cls) {
      return res.status(400).json({ success: false, message: "schoolId and class are required" });
    }
    // Class labels repeat across campuses ("Class 10" exists in every branch), so
    // an unfiltered lookup here would return students from every branch and fan the
    // notification out to all of them. Callers pass the acting branch; an absent
    // branchId means a deliberate all-branches (super-admin) view.
    const filter = { schoolId, class: cls, status: "Active", deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (section) filter.section = section;
    const students = await Student.find(filter).select("admissionNo").lean();
    const refIds = [...new Set(students.map((s) => String(s.admissionNo).trim()).filter(Boolean))];
    res.json({ success: true, count: refIds.length, refIds });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Resolve a set of admission numbers to display names. BusRoute stores
// `assignedStudents` as admission numbers, so facility-service needs this to
// render a route roster instead of a column of raw codes. Returns only the
// requested, tenant-scoped fields — never the whole student record.
router.get("/by-admission", async (req, res) => {
  const { schoolId } = req.query;
  if (!schoolId) {
    return res.status(400).json({ success: false, message: "schoolId is required" });
  }
  const admissionNos = String(req.query.admissionNos || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (admissionNos.length === 0) {
    return res.json({ success: true, count: 0, students: [] });
  }
  try {
    // schoolId is mandatory here: an unscoped lookup would resolve admission
    // numbers belonging to another tenant.
    const students = await Student.find({
      schoolId,
      admissionNo: { $in: admissionNos },
      deletedAt: null,
    })
      .select("admissionNo name class section")
      .lean();
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;