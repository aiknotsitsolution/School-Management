const Notice = require("../models/Notice");

const createNotice = async (req, res) => {
  try {
    const notice = await Notice.create({ ...req.body, schoolId: req.tenantId, postedBy: req.user.name });
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
