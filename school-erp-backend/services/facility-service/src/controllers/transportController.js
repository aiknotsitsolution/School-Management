const BusRoute = require("../models/BusRoute");

const createRoute = async (req, res) => {
  try {
    const route = await BusRoute.create({ ...req.body, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getRoutes = async (req, res) => {
  try {
    const { studentId } = req.query;
    const filter = { schoolId: req.tenantId };
    if (studentId) filter.assignedStudents = studentId;
    const data = await BusRoute.find(filter);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const route = await BusRoute.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { currentLocation: { lat, lng, updatedAt: new Date() } },
      { new: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const assignStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    const route = await BusRoute.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      { $addToSet: { assignedStudents: studentId } },
      { new: true },
    );
    if (!route) return res.status(404).json({ success: false, message: "Route not found" });
    res.json({ success: true, data: route });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { createRoute, getRoutes, updateLocation, assignStudent };
