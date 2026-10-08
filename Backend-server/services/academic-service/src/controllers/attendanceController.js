const {
  scopeQuery,
  withBranchScope,
  branchIdForWrite,
} = require("@school-erp/shared/src/middleware/branchScope");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const { getStudentModel } = require("../db/studentDb");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const {
  findMissingMasterRefs,
  missingMessage,
} = require("../utils/masterRefs");

// Resolves the set of admissionNo values enrolled in the teacher's class +
// section for this school. Returns null when the student DB is unreachable so
// the caller can fail closed rather than trusting unvalidated studentIds.
const getEnrolledStudentIds = async (tenantId, classLabel, section) => {
  let Student;
  try {
    Student = await getStudentModel();
  } catch (err) {
    throw new Error("Student enrollment check unavailable: " + err.message);
  }
  const query = { schoolId: tenantId, class: classLabel };
  if (section) query.section = section;
  const enrolled = await Student.find(query).select("admissionNo").lean();
  return new Set(enrolled.map((s) => String(s.admissionNo)));
};

const markAttendance = async (req, res) => {
  try {
    const { records } = req.body; // [{ studentId, class, section, date, status, remarks }]
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: "records array is required" });
    }

    // Teacher writes are tied to their assigned class/section (guardClassBody
    // already validated every record against the teacherScope union). Every
    // studentId must actually be enrolled there, or the whole submission is
    // rejected — clients do not get to nominate arbitrary classmates.
    if (req.teacherScope) {
      const first = records.find((r) => r) || {};
      let allowed;
      try {
        allowed = await getEnrolledStudentIds(
          req.tenantId,
          String(first.class || "").trim() || undefined,
          String(first.section || "").trim() || undefined,
        );
      } catch (err) {
        return res.status(503).json({ success: false, message: err.message });
      }
      const invalid = [...new Set(records.map((r) => String(r.studentId).trim()).filter(Boolean))]
        .filter((id) => !allowed.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Some studentIds are not enrolled in your class/section",
          invalidStudentIds: invalid,
        });
      }
    }

    // Referential integrity: the class/section written on the records must
    // resolve to active masters when this school has configured the catalogs.
    const pairs = [
      ...new Set(
        records.map((r) => `${String(r.class || "").trim()}||${String(r.section || "").trim()}`),
      ),
    ];
    const missing = [];
    for (const pair of pairs) {
      const [cls, section] = pair.split("||");
      missing.push(
        ...(await findMissingMasterRefs({ schoolId: req.tenantId, branchId: req.branchId, class: cls, section })),
      );
    }
    if (missing.length) {
      return res.status(400).json({ success: false, message: missingMessage(missing), missing });
    }

    // Every studentId must belong to THIS school (and, for a campus-pinned
    // caller, to THIS campus) before we write. The upsert below cannot match on
    // branchId (see comment there), so this check is what enforces isolation.
    const submittedIds = [...new Set(records.map((r) => String(r.studentId || "").trim()).filter(Boolean))];
    if (submittedIds.length > 0) {
      let Student;
      try {
        Student = await getStudentModel();
      } catch (err) {
        return res.status(503).json({ success: false, message: "Student enrollment check unavailable: " + err.message });
      }
      // A record's studentId may be an admissionNo or a student _id, so match
      // whichever form is valid. Casting a non-ObjectId into _id throws.
      const asObjectIds = submittedIds.filter((id) => mongoose.isValidObjectId(id));
      const or = [{ admissionNo: { $in: submittedIds } }];
      if (asObjectIds.length > 0) or.push({ _id: { $in: asObjectIds } });
      const studentFilter = { schoolId: req.tenantId, $or: or };
      if (req.branchId) studentFilter.branchId = req.branchId;
      const owned = await Student.find(studentFilter).select("_id admissionNo").lean();
      const ownedIds = new Set();
      for (const s of owned) {
        ownedIds.add(String(s._id));
        if (s.admissionNo) ownedIds.add(String(s.admissionNo));
      }
      const notMine = submittedIds.filter((id) => !ownedIds.has(id));
      if (notMine.length > 0) {
        console.error(
          "[OWNERSHIP-DEBUG]",
          JSON.stringify({
            tenantId: req.tenantId,
            branchId: req.branchId,
            role: req.user && req.user.role,
            submittedIds,
            filter: studentFilter,
            ownedCount: owned.length,
            collection: Student.collection && Student.collection.collectionName,
            dbName: Student.db && Student.db.name,
            uriTail: (process.env.STUDENT_MONGODB_URI || "").slice(-30),
            mongooseVer: mongoose.version,
            strictQuery: Student.schema.options.strictQuery,
            bySchoolOnly: await Student.countDocuments({ schoolId: req.tenantId }),
            byAdmNo: await Student.countDocuments({ admissionNo: { $in: submittedIds } }),
          }),
        );
        return res.status(400).json({
          success: false,
          message: req.branchId
            ? "Some studentIds do not belong to this campus"
            : "Some studentIds do not belong to this school",
          invalidStudentIds: notMine,
        });
      }
    }

    const ops = records.map((r) => {
      // Whitelisted rebuild: record bodies are attacker input, so Mongo update
      // operators ($set/$inc/$push/...) in a record never reach the db.
      const studentId = String(r.studentId || "").trim();
      const classLabel = String(r.class || "").trim();
      const section = String(r.section || "").trim();
      const status = String(r.status || "").trim();
      const date = new Date(r.date);
      const set = {
        studentId,
        class: classLabel,
        section,
        status,
        date,
        schoolId: req.tenantId,
        // Stamped because upsert:true builds a brand new row from these fields;
        // without it the new row could never be matched by a branch filter.
        branchId: branchIdForWrite(req),
        markedBy: req.user.name,
      };
      if (typeof r.remarks === "string" && String(r.remarks).trim() !== "") {
        set.remarks = String(r.remarks).slice(0, 500);
      }
      return {
        updateOne: {
          // Match ONLY the unique index {schoolId, studentId, date}. branchId is
          // deliberately absent: it is not part of that index, so including it
          // made the lookup miss rows whose branchId is null (or another
          // campus), and the upsert then tried an INSERT and died on E11000.
          // Campus isolation for these writes is enforced by the student
          // ownership check above; branchId is still stamped on the row below.
          filter: { schoolId: req.tenantId, studentId, date },
          update: { $set: set },
          upsert: true,
        },
      };
    });
    await Attendance.bulkWrite(ops);

    // Push attendance event to communication-service for SSE broadcast.
    // Non-blocking — if the push fails, the attendance save still succeeds.
    const internalKey = process.env.INTERNAL_NOTIFY_KEY;
    if (internalKey) {
      const first = records[0] || {};
      const classLabel = String(first.class || "").trim();
      const section = String(first.section || "").trim();
      const dateStr = first.date ? new Date(first.date).toISOString().split("T")[0] : null;
      const pushPayload = {
        schoolId: req.tenantId,
        branchId: req.branchId,
        class: classLabel,
        section: section || null,
        date: dateStr,
        records: records.map((r) => ({
          studentId: String(r.studentId || "").trim(),
          status: String(r.status || "").trim(),
        })),
        markedBy: req.user.name,
      };
      const commUrl = process.env.COMMUNICATION_SERVICE_URL || "http://localhost:5006";
      fetch(`${commUrl}/api/attendance-stream/internal/push-attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify(pushPayload),
      }).catch(() => {}); // fire-and-forget
    }

    res.json({ success: true, message: `Attendance marked for ${records.length} student(s)` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getAttendance = async (req, res) => {
  try {
    const { studentId, class: cls, section, from, to } = req.query;
    const filter = scopeQuery(Attendance, req, { schoolId: req.tenantId })
    if (studentId) filter.studentId = studentId;
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const { page, limit, skip } = paginate(req.query);
    const [data, total, present] = await Promise.all([
      Attendance.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit),
      Attendance.countDocuments(filter),
      studentId ? Attendance.countDocuments({ ...filter, status: "Present" }) : Promise.resolve(0),
    ]);

    let summary = null;
    if (studentId) {
      summary = { total: total, present: present, percentage: total ? ((present / total) * 100).toFixed(2) : "0.00" };
    }

    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), summary, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


const getAttendanceReport = async (req, res) => {
  try {
    const { from, to, class: cls, section, studentId } = req.query;
      const match = withBranchScope(req, { schoolId: req.tenantId });
    if (cls) match.class = cls;
    if (section) match.section = section;
    if (studentId) match.studentId = studentId;
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(to);
    }

    const [totals] = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ["$status", "Leave"] }, 1, 0] } },
        },
      },
    ]);

    const totalRecords = totals?.totalRecords || 0;
    const presentCount = totals?.presentCount || 0;

    const classWise = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$class",
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          class: "$_id",
          total: 1,
          present: 1,
          percentage: { $cond: [{ $eq: ["$total", 0] }, "0.00", { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 2] }] },
        },
      },
      { $sort: { class: 1 } },
    ]);

    const dailyTrend = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          total: 1,
          present: 1,
          percentage: { $cond: [{ $eq: ["$total", 0] }, "0.00", { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 2] }] },
        },
      },
      { $sort: { date: 1 } },
    ]);

    res.json({
      success: true,
      totalRecords,
      presentCount,
      absentCount: totals?.absentCount || 0,
      leaveCount: totals?.leaveCount || 0,
      percentage: totalRecords ? ((presentCount / totalRecords) * 100).toFixed(2) : "0.00",
      classWise,
      dailyTrend,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { markAttendance, getAttendance, getAttendanceReport };
