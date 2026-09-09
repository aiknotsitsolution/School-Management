const Homework = require("../models/Homework");
const HomeworkSubmission = require("../models/HomeworkSubmission");
const imagekit = require("../config/imagekit");
const { notifyByRefIds } = require("../utils/notify");
const { paginate, pageInfo } = require("../utils/pagination");

// Neutralizes problematic characters in uploaded filenames before they reach
// ImageKit while keeping the original name for display purposes.
const sanitizeFileName = (name = "") =>
  String(name)
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 100);

// Student submits their own homework. Identity (studentId/admissionNo/schoolId)
// is derived from the authenticated token, never trusted from the body.
const submitHomework = async (req, res) => {
  try {
    if (!["student"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Only students can submit homework" });
    }
    const admissionNo = req.user.refId;
    if (!admissionNo) {
      return res.status(403).json({ success: false, message: "No student identity on this account" });
    }

    const homework = await Homework.findOne({
      _id: req.params.homeworkId,
      schoolId: req.tenantId,
    });
    if (!homework) {
      return res.status(404).json({ success: false, message: "Homework not found" });
    }
    // Enforce student's class/section belongs to this homework.
    if (String(homework.class) !== String(req.user.class) || String(homework.section) !== String(req.user.section)) {
      return res.status(403).json({ success: false, message: "This homework is not assigned to your class" });
    }

    const { content = "", attachments = [] } = req.body || {};
    let parsedAttachments = [];
    if (Array.isArray(attachments)) {
      parsedAttachments = attachments;
    } else if (typeof attachments === "string" && attachments) {
      // multipart form fields come through as JSON strings
      try {
        const parsed = JSON.parse(attachments);
        if (Array.isArray(parsed)) parsedAttachments = parsed;
      } catch {
        parsedAttachments = [];
      }
    }
    const attachmentList = [...parsedAttachments];

    // Optional single file attachment, uploaded securely server-side via the
    // service's ImageKit configuration (never the browser).
    if (req.file) {
      if (!imagekit) {
        return res.status(503).json({ success: false, message: "Image provider is not configured" });
      }
      const uploaded = await imagekit.upload({
        file: req.file.buffer.toString("base64"),
        fileName: `homework-${Date.now()}-${sanitizeFileName(req.file.originalname)}`,
        folder: "/school-erp/homework",
        useUniqueFileName: true,
      });
      attachmentList.push({
        fileName: req.file.originalname,
        fileUrl: uploaded.url,
        fileId: uploaded.fileId,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      });
    } else if (!String(content || "").trim() && attachmentList.length === 0) {
      return res.status(400).json({ success: false, message: "Add a written answer or attach a file before submitting" });
    }

    const now = Date.now();
    const status =
      homework.dueDate && now > new Date(homework.dueDate).getTime()
        ? "Late"
        : "Submitted";

    const submission = await HomeworkSubmission.findOneAndUpdate(
      { schoolId: req.tenantId, homeworkId: homework._id, admissionNo },
      {
        $set: {
          schoolId: req.tenantId,
          homeworkId: homework._id,
          studentId: admissionNo,
          admissionNo,
          studentName: req.user.name,
          content: String(content || ""),
          attachments: attachmentList,
          status,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(201).json({ success: true, data: submission });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Student views their own submissions for the given homework (or all of their
// submissions when no homeworkId). Always restricted to the authenticated student.
const getMySubmissions = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ success: false, message: "Students only" });
    }
    const admissionNo = req.user.refId;
    if (!admissionNo) {
      return res.status(403).json({ success: false, message: "No student identity on this account" });
    }
    const filter = { schoolId: req.tenantId, admissionNo };
    if (req.params.homeworkId) filter.homeworkId = req.params.homeworkId;
    // If a homeworkId is provided from the query, ensure it belongs to the student's class.
    if (req.query.homeworkId) filter.homeworkId = req.query.homeworkId;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      HomeworkSubmission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      HomeworkSubmission.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Teacher reviews submissions for their assigned class/section.
const reviewSubmission = async (req, res) => {
  try {
    const submission = await HomeworkSubmission.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    // Teacher must be scoped to the class/section of the homework this submission belongs to.
    const homework = await Homework.findOne({
      _id: submission.homeworkId,
      schoolId: req.tenantId,
    });
    if (!homework) {
      return res.status(404).json({ success: false, message: "Homework not found" });
    }
    if (req.teacherScope) {
      const inScope =
        String(homework.class) === String(req.teacherScope.class) &&
        (!req.teacherScope.section || String(homework.section) === String(req.teacherScope.section));
      if (!inScope) {
        return res.status(403).json({ success: false, message: "Not authorized to review this submission" });
      }
    } else if (req.user.role === "student") {
      return res.status(403).json({ success: false, message: "Students cannot review submissions" });
    }

    const { teacherFeedback = null, marks = null } = req.body || {};
    if (marks != null && (Number(marks) < 0 || Number(marks) > (homework.maxMarks || 100))) {
      return res.status(400).json({ success: false, message: "Marks exceed the maximum for this homework" });
    }

    submission.teacherFeedback = teacherFeedback;
    if (marks != null) submission.marks = Number(marks);
    submission.gradedAt = new Date();
    submission.status = "Reviewed";
    submission.reviewedBy = req.user.name;
    await submission.save();

    // Notify the submitting student that their homework has been reviewed.
    notifyByRefIds({
      schoolId: submission.schoolId,
      refIds: [submission.admissionNo],
      title: "Homework reviewed",
      message: `${homework.title}: ${teacherFeedback ? `“${String(teacherFeedback).slice(0, 120)}”` : "Your submission has been reviewed."}`,
      kind: "system",
      link: "/student/homework",
    });

    res.json({ success: true, data: submission });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Teacher lists submissions for their class/section, optionally filtered by homework.
const listSubmissionsForClass = async (req, res) => {
  try {
    if (req.user.role === "student") {
      return res.status(403).json({ success: false, message: "Students cannot list class submissions" });
    }
    const filter = { schoolId: req.tenantId };
    if (req.query.homeworkId) filter.homeworkId = req.query.homeworkId;
    if (req.query.status) filter.status = req.query.status;

    const homeworkFilter = { schoolId: req.tenantId };
    if (req.teacherScope) {
      homeworkFilter.class = req.teacherScope.class;
      if (req.teacherScope.section) homeworkFilter.section = req.teacherScope.section;
    } else if (req.query.class) {
      homeworkFilter.class = req.query.class;
      if (req.query.section) homeworkFilter.section = req.query.section;
    }
    const homeworks = await Homework.find(homeworkFilter).select("_id").lean();
    if (!homeworks.length) return res.json({ success: true, count: 0, data: [] });
    filter.homeworkId = { $in: homeworks.map((h) => h._id) };

    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      HomeworkSubmission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      HomeworkSubmission.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  submitHomework,
  getMySubmissions,
  reviewSubmission,
  listSubmissionsForClass,
};
