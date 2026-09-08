const Hostel = require("../models/Hostel");

const createRoom = async (req, res) => {
  try {
    const room = await Hostel.create({ ...req.body, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getRooms = async (req, res) => {
  try {
    const filter = { schoolId: req.tenantId };
    if (req.user.role === "student") {
      // Students may only see rooms they are allotted in; the admission number
      // is always taken from the token, never from a query parameter.
      filter.occupants = req.user.refId;
    } else if (req.query.studentId) {
      filter.occupants = req.query.studentId;
    }
    const data = await Hostel.find(filter);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const allotRoom = async (req, res) => {
  try {
    const { studentId } = req.body;
    const room = await Hostel.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    if (room.occupants.length >= room.capacity) {
      return res.status(400).json({ success: false, message: "Room is full" });
    }
    if (!room.occupants.includes(studentId)) room.occupants.push(studentId);
    await room.save();
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const vacateRoom = async (req, res) => {
  try {
    const room = await Hostel.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { $pull: { occupants: req.body.studentId } },
      { new: true },
    );
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const room = await Hostel.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    if (room.occupants.length) {
      return res.status(400).json({ success: false, message: "Move out occupants first" });
    }
    await room.deleteOne();
    res.json({ success: true, message: "Room deleted" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createRoom, getRooms, allotRoom, vacateRoom, deleteRoom };
