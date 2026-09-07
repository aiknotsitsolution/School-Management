const Event = require("../models/Event");

const createEvent = async (req, res) => {
  try {
    const event = await Event.create({ ...req.body, schoolId: req.tenantId, createdBy: req.user.name });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId, $or: [{ audience: req.user.role }, { audience: "all" }] };
    const data = await Event.find(filter).sort({ date: 1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      req.body,
      { new: true, runValidators: true },
    );
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    res.json({ success: true, data: event });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    res.json({ success: true, message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createEvent, getEvents, updateEvent, deleteEvent };
