const Notice = require("../models/Notice");
const Notification = require("../models/Notification");
const { getUserModel } = require("../models/userLite");
const { paginate, pageInfo } = require("../utils/pagination");

// Mass-assignment guard: only these fields may be set from the request body
// (schoolId / postedBy / timestamps stay server-owned).
const NOTICE_FIELDS = [
  "title", "description", "category", "pinned", "audience", "attachments", "expiryDate",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const AUDIENCE_ROLES = {
  school_admin: ["school_admin"],
  class_teacher: ["class_teacher", "teacher"],
  staff: ["staff"],
  student: ["student"],
  all: ["school_admin", "class_teacher", "teacher", "staff", "student"],
};

// After a notice is published, fan out an inbox notification to the matching
// audience. Failures are logged but never block notice creation.
const fanOutNotice = async ({ schoolId, title, audience = [] }) => {
  try {
    const roles = [...new Set(audience.flatMap((a) => AUDIENCE_ROLES[a] || []))];
    if (roles.length === 0) return;
    const User = getUserModel();
    const userIds = await User.find(
      { schoolId, isActive: true, role: { $in: roles } },
      { _id: 1 }
    ).lean();
    const all = userIds.map((u) => String(u._id));
    if (all.length === 0) return;
    await Notification.insertMany(
      all.map((userId) => ({
        schoolId,
        userId,
        title: "New Notice",
        message: title,
        kind: "notice",
        link: "/notice-board",
      }))
    );
  } catch (err) {
    console.error("[notice fanout skipped]", err.message);
  }
};

const createNotice = async (req, res) => {
  try {
    const notice = await Notice.create({ ...pick(req.body, NOTICE_FIELDS), schoolId: req.tenantId, postedBy: req.user.name });
    fanOutNotice({ schoolId: req.tenantId, title: notice.title, audience: notice.audience });
    res.status(201).json({ success: true, data: notice });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getNotices = async (req, res) => {
  try {
    // "teacher" accounts are teaching staff: they see school-wide ("all")
    // notices as well as notices published for class_teacher audiences.
    const effectiveAudiences =
      req.user.role === "teacher"
        ? ["teacher", "class_teacher", "all"]
        : [req.user.role, "all"];
    const filter = { schoolId: req.tenantId, audience: { $in: effectiveAudiences } };
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      Notice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notice.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });
    res.json({ success: true, message: "Notice deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createNotice, getNotices, deleteNotice };
