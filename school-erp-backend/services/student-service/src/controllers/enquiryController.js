const AdmissionEnquiry = require("../models/AdmissionEnquiry");

const createEnquiry = async (req, res) => {
  try {
    const enquiry = await AdmissionEnquiry.create({ ...req.body, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: enquiry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getEnquiries = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { schoolId: req.tenantId };
    if (status) filter.status = status;
    const data = await AdmissionEnquiry.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateEnquiry = async (req, res) => {
  try {
    const enquiry = await AdmissionEnquiry.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      req.body,
      { new: true },
    );
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    res.json({ success: true, data: enquiry });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await AdmissionEnquiry.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    res.json({ success: true, message: "Enquiry deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createEnquiry, getEnquiries, updateEnquiry, deleteEnquiry };
