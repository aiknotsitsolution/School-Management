const AdmissionEnquiry = require("../models/AdmissionEnquiry");

// One Admission ID per admitted enquiry within a school. Existing student
// records (e.g. a platform-created shell) with the same Admission ID are fine
// — the enquiry links to them rather than creating duplicates.
const assertAdmissionIdAvailable = async (schoolId, admissionNo, excludeId) => {
  if (!admissionNo) return { required: false };
  const used = await AdmissionEnquiry.findOne({
    schoolId,
    admissionNo,
    status: "Admitted",
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (used) {
    return { conflict: `Admission ID "${admissionNo}" is already assigned to another admitted enquiry` };
  }
  return { required: false };
};

const validateAdmission = async ({ schoolId, status, admissionNo, id }) => {
  if (status !== "Admitted") return {};
  const admId = String(admissionNo || "").trim();
  if (!admId) {
    return { error: { status: 400, message: "Admission ID is required when an enquiry is Admitted" } };
  }
  const { conflict } = await assertAdmissionIdAvailable(schoolId, admId, id);
  if (conflict) return { error: { status: 409, message: conflict } };
  return { admissionNo: admId };
};

const createEnquiry = async (req, res) => {
  try {
    const { schoolId, status, admissionNo, id } = {
      schoolId: req.tenantId,
      ...req.body,
      id: undefined,
    };
    const check = await validateAdmission({ schoolId, status, admissionNo, id });
    if (check.error) {
      return res.status(check.error.status).json({ success: false, message: check.error.message });
    }
    const enquiry = await AdmissionEnquiry.create({
      ...req.body,
      schoolId: req.tenantId,
      admissionNo:
        check.admissionNo !== undefined ? check.admissionNo : req.body.admissionNo || null,
    });
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
    const enquiry = await AdmissionEnquiry.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    const status = req.body.status !== undefined ? req.body.status : enquiry.status;
    const admissionNo =
      req.body.admissionNo !== undefined ? req.body.admissionNo : enquiry.admissionNo;
    const check = await validateAdmission({
      schoolId: req.tenantId,
      status,
      admissionNo,
      id: enquiry._id,
    });
    if (check.error) {
      return res.status(check.error.status).json({ success: false, message: check.error.message });
    }

    enquiry.set({ ...req.body, admissionNo: check.admissionNo !== undefined ? check.admissionNo : admissionNo });
    await enquiry.save();
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
