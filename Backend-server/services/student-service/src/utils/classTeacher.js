const {
  collection,
  staffDbName,
  asObjectId,
  resolveActiveSession,
} = require("@school-erp/shared/src/utils/teacherScope");

// Display name of the class teacher currently assigned to a class/section.
//
// TeacherAssignment lives in the staff DB, which student-service does not
// model natively, so this reads the `teacherassignments` collection through
// the shared helper — the exact access pattern
// shared/src/utils/teacherScope.resolveTeacherScope and academic-service's
// timetable generator already use. That keeps /students/me able to answer
// "who is your class teacher" without an HTTP hop to staff-service.
//
// Returns "" (never throws) when there is no assignment or the staff DB is
// unreachable: a lookup miss must not fail a student's own profile request.
async function classTeacherName(schoolId, cls, section) {
  try {
    const schoolOid = asObjectId(schoolId);
    const c = cls == null ? "" : String(cls).trim();
    const s = section == null ? "" : String(section).trim();
    if (!schoolOid || !c || !s) return "";

    const query = {
      schoolId: schoolOid,
      class: c,
      section: s,
      type: "class_teacher",
      status: "active",
    };
    // Assignments are session-scoped and soft-ended, so an older session can
    // still hold status "active". Prefer the current session so last year's
    // class teacher never shows; with no session configured, any active row wins.
    const session = await resolveActiveSession(schoolId);
    if (session) query.session = String(session);

    const assignments = await collection(staffDbName(), "teacherassignments");
    const row = await assignments.findOne(query, {
      sort: { updatedAt: -1 },
      projection: { staffName: 1 },
    });
    return row && row.staffName ? String(row.staffName).trim() : "";
  } catch (err) {
    console.error("[class teacher lookup skipped]", err.message);
    return "";
  }
}

module.exports = { classTeacherName };
