const Student = require("../models/Student");
const getImageKit = require("../config/imagekit");

// Fields that must be filled before a profile is considered complete.
// class/section/name are schema-level; these are the counsellor-fillable ones.
const PROFILE_REQUIRED_FIELDS = [
  "dob",
  "gender",
  "address",
  "parentName",
  "parentContact",
  "motherName",
];

const isEmpty = (v) => v === undefined || v === null || String(v).trim() === "";

const computeProfileStatus = (doc) =>
  isEmpty(doc) || PROFILE_REQUIRED_FIELDS.some((f) => isEmpty(doc[f]))
    ? "incomplete"
    : "complete";

const isDuplicateKey = (err) =>
  err && (err.code === 11000 || (err.name === "MongoServerError" && err.code === 11000));

const uploadStudentPhoto = async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "Photo file is required" });
    const imagekit = getImageKit();
    const uploaded = await imagekit.upload({
      file: req.file.buffer.toString("base64"),
      fileName: `student-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
      folder: "/school-erp/students",
      useUniqueFileName: true,
    });
    res
      .status(201)
      .json({
        success: true,
        data: { url: uploaded.url, fileId: uploaded.fileId },
      });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
};

const createStudent = async (req, res) => {
  try {
    const {
      admissionNo,
      fatherName,
      motherName,
      phone,
      email,
      ...studentData
    } = req.body;

    const admissionId = String(admissionNo || "").trim();
    if (!admissionId) {
      return res.status(400).json({
        success: false,
        message: "Admission ID (admissionNo) is required for a student record",
      });
    }

    const existing = await Student.findOne({
      schoolId: req.tenantId,
      admissionNo: admissionId,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Admission ID "${admissionId}" already exists in this school`,
      });
    }

    const data = {
      ...studentData,
      schoolId: req.tenantId,
      admissionNo: admissionId,
      parentName: studentData.parentName || fatherName,
      parentContact: studentData.parentContact || phone,
      parentEmail: studentData.parentEmail || email,
      motherName: studentData.motherName || motherName,
    };
    data.profileStatus = computeProfileStatus(data);
    if (data.profileStatus === "complete") data.profileCompletedAt = new Date();

    const student = await Student.create(data);
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    if (isDuplicateKey(err)) {
      return res.status(409).json({
        success: false,
        message: "This Admission ID already exists in this school",
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const {
      class: cls,
      section,
      status,
      profileStatus,
      admissionNo,
      search,
      q,
      page = 1,
      limit = 20,
    } = req.query;
    const filter = { schoolId: req.tenantId };
    if (req.user.role === "student") filter.admissionNo = req.user.refId;
    if (req.user.role === "parent")
      filter._id = { $in: req.user.linkedStudentIds || [] };
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (status) filter.status = status;
    if (profileStatus) filter.profileStatus = profileStatus;
    if (admissionNo) filter.admissionNo = String(admissionNo).trim();
    const term = String(q || search || "").trim();
    if (term) {
      const rx = { $regex: term, $options: "i" };
      filter.$or = [{ name: rx }, { admissionNo: rx }];
    }
    const students = await Student.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Student.countDocuments(filter);
    res.json({
      success: true,
      count: students.length,
      total,
      page: Number(page),
      data: students,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// "Current student" for the logged-in student account — resolves schoolId +
// refId (Admission ID) exactly like every other student-scoped request.
const getMyStudent = async (req, res) => {
  try {
    if (!["student", "parent"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only a student account can request its own profile",
      });
    }
    if (!req.user.refId) {
      return res.status(404).json({
        success: false,
        message: "No Admission ID linked to this account",
      });
    }
    const student = await Student.findOne({
      schoolId: req.tenantId,
      admissionNo: req.user.refId,
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student profile found. Contact your Admission Counsellor.",
      });
    }
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Aggregate KPI surface for the Admission Counsellor workspace.
const counsellorStats = async (req, res) => {
  try {
    const base = { schoolId: req.tenantId };
    const [total, incomplete, complete] = await Promise.all([
      Student.countDocuments(base),
      Student.countDocuments({ ...base, profileStatus: "incomplete" }),
      Student.countDocuments({ ...base, profileStatus: "complete" }),
    ]);
    const recent = await Student.find(base)
      .sort({ createdAt: -1 })
      .limit(8)
      .select(
        "name admissionNo class section status profileStatus createdAt",
      );
    res.json({ success: true, data: { total, incomplete, complete, recent } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStudentById = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStudent = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    const patch = { ...req.body };
    delete patch.schoolId;
    if (patch.admissionNo !== undefined) {
      patch.admissionNo = String(patch.admissionNo).trim();
      if (!patch.admissionNo) {
        return res
          .status(400)
          .json({ success: false, message: "Admission ID cannot be empty" });
      }
    }

    student.set(patch);
    student.profileStatus = computeProfileStatus(student);
    student.profileCompletedAt =
      student.profileStatus === "complete" ? (student.profileCompletedAt || new Date()) : null;
    await student.save();

    res.json({ success: true, data: student });
  } catch (err) {
    if (isDuplicateKey(err)) {
      return res.status(409).json({
        success: false,
        message: "This Admission ID already exists in this school",
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

// Manual completion gate: validates required fields then marks the profile
// complete. Secured by students:write at the route level.
const completeProfile = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    const missing = PROFILE_REQUIRED_FIELDS.filter((f) => isEmpty(student[f]));
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Profile incomplete. Missing: ${missing
          .map((f) => f.replace(/([A-Z])/g, " $1").toLowerCase())
          .join(", ")}`,
      });
    }
    if (!student.class || !student.section) {
      return res.status(400).json({
        success: false,
        message: "Class and section are required before completing the profile",
      });
    }

    student.profileStatus = "complete";
    student.profileCompletedAt = new Date();
    await student.save();
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    res.json({ success: true, message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const bulkStats = async (req, res) => {
  try {
    const total = await Student.countDocuments({ schoolId: req.tenantId });
    const byClass = await Student.aggregate([
      { $match: { schoolId: req.tenantId } },
      { $group: { _id: "$class", count: { $sum: 1 } } },
    ]);
    const active = await Student.countDocuments({
      schoolId: req.tenantId,
      status: "Active",
    });
    res.json({ success: true, data: { total, active, byClass } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  uploadStudentPhoto,
  createStudent,
  getStudents,
  getStudentById,
  getMyStudent,
  counsellorStats,
  updateStudent,
  completeProfile,
  deleteStudent,
  bulkStats,
};
