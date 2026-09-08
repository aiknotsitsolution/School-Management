const Notice = require("../models/Notice");
const Notification = require("../models/Notification");
const { getUserModel } = require("../models/userLite");

const AUDIENCE_ROLES = {
  school_admin: ["school_admin"],
  class_teacher: ["class_teacher"],
  staff: ["staff"],
  student: ["student"],
  all: ["school_admin", "class_teacher", "staff", "student"],
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
    const notice = await Notice.create({ ...req.body, schoolId: req.tenantId, postedBy: req.user.name });
    fanOutNotice({ schoolId: req.tenantId, title: notice.title, audience: notice.audience });
    res.status(201).json({ success: true, data: notice });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getNotices = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId, $or: [{ audience: req.user.role }, { audience: "all" }] };
    const data = await Notice.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
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
