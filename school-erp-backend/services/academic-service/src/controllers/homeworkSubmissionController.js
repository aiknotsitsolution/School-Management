const Homework = require("../models/Homework");
const HomeworkSubmission = require("../models/HomeworkSubmission");
const { notifyByRefIds } = require("../utils/notify");

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
          content,
          attachments: Array.isArray(attachments) ? attachments : [],
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
    const data = await HomeworkSubmission.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
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

    const data = await HomeworkSubmission.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
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
