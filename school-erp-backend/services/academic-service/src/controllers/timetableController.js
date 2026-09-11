const Timetable = require("../models/Timetable");
const { findMissingMasterRefs, findMissingSubjects, missingMessage } = require("../utils/masterRefs");

// Mass-assignment guard: only these fields may be set from the request body.
const TIMETABLE_FIELDS = ["class", "section", "day", "periods"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Normalise & validate the incoming periods array. Returns { ok, errors, periods }.
function validatePeriods(periods, { schoolId, cls, section, day, currentId }) {
  const errors = [];
  if (!Array.isArray(periods)) {
    return { ok: false, errors: ["periods must be an array"] };
  }
  if (periods.length === 0) return { ok: true, errors: [], periods };

  const seenTimes = new Set();
  const normalized = periods.map((p, i) => {
    const subject = String(p.subject || "").trim();
    const teacherId = String(p.teacherId || "").trim();
    const teacherName = String(p.teacherName || "").trim();
    const startTime = String(p.startTime || "").trim();
    const endTime = String(p.endTime || "").trim();

    if (!subject) errors.push(`Period ${i + 1}: subject is required`);
    if (!startTime || !TIME_RE.test(startTime)) {
      errors.push(`Period ${i + 1}: invalid startTime "${startTime}" (expected HH:MM 24h)`);
    }
    if (!endTime || !TIME_RE.test(endTime)) {
      errors.push(`Period ${i + 1}: invalid endTime "${endTime}" (expected HH:MM 24h)`);
    }
    if (startTime && endTime && TIME_RE.test(startTime) && TIME_RE.test(endTime) && endTime <= startTime) {
      errors.push(`Period ${i + 1}: endTime must be after startTime`);
    }
    if (startTime) {
      if (seenTimes.has(startTime)) {
        errors.push(`Period ${i + 1}: duplicate period startTime "${startTime}" in the same day`);
      }
      seenTimes.add(startTime);
    }
    return { subject, teacherId, teacherName, startTime, endTime };
  });

  if (errors.length) return { ok: false, errors, periods: normalized };

  return { ok: true, errors, periods: normalized };
}

// Detect cross-class teacher conflicts for the same day+startTime within the school,
// excluding the record currently being written (if any).
async function checkTeacherConflicts({ schoolId, day, periods, currentId }) {
  const committed = periods.filter((p) => p.teacherId && p.startTime);
  if (!committed.length) return [];

  const overlapping = await Timetable.find({
    schoolId,
    day,
    _id: currentId ? { $ne: currentId } : { $ne: null },
    periods: {
      $elemMatch: {
        teacherId: { $in: committed.map((p) => p.teacherId) },
        startTime: { $in: committed.map((p) => p.startTime) },
      },
    },
  }).lean();

  const conflicts = [];
  for (const doc of overlapping) {
    for (const other of doc.periods) {
      const match = committed.find(
        (p) => p.teacherId === other.teacherId && p.startTime === other.startTime
      );
      if (match) {
        conflicts.push(
          `${other.teacherName || other.teacherId} is already teaching ${other.subject} at ${other.startTime} on ${day} (${doc.class}-${doc.section})`
        );
      }
    }
  }
  return conflicts;
}

const upsertTimetable = async (req, res) => {
  try {
    const { class: cls = "", section = "", day = "", periods } = req.body;

    if (!cls || !section) {
      return res.status(400).json({ success: false, message: "class and section are required" });
    }
    if (!DAYS.includes(day)) {
      return res.status(400).json({ success: false, message: `day must be one of: ${DAYS.join(", ")}` });
    }

    const check = await validatePeriods(periods, { schoolId: req.tenantId, cls, section, day });
    if (!check.ok) {
      return res.status(400).json({ success: false, message: check.errors.join("; ") });
    }

    // Referential integrity: class/section/period-subjects must resolve to
    // active masters when this school has configured the catalogs.
    const missing = [
      ...(await findMissingMasterRefs({ schoolId: req.tenantId, class: cls, section })),
      ...(await findMissingSubjects({
        schoolId: req.tenantId,
        subjects: check.periods.map((p) => p.subject),
      })),
    ];
    if (missing.length) {
      return res.status(400).json({ success: false, message: missingMessage(missing) });
    }

    const existing = await Timetable.findOne({ schoolId: req.tenantId, class: cls, section, day }).lean();
    const currentId = existing ? existing._id : null;

    const teacherConflicts = await checkTeacherConflicts({
      schoolId: req.tenantId,
      day,
      periods: check.periods,
      currentId,
    });
    if (teacherConflicts.length) {
      return res.status(409).json({
        success: false,
        message: "Scheduling conflict detected",
        conflicts: teacherConflicts,
      });
    }

    const payload = { class: cls, section, day, periods: check.periods };
    const timetable = await Timetable.findOneAndUpdate(
      { schoolId: req.tenantId, class: cls, section, day },
      { ...pick(payload, TIMETABLE_FIELDS), schoolId: req.tenantId },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(existing ? 200 : 201).json({ success: true, data: timetable });
  } catch (err) {
    if (err && err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "A timetable for this class, section and day already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const getTimetable = async (req, res) => {
  try {
    const { class: cls, section, day } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    if (day) filter.day = day;
    const data = await Timetable.find(filter);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteTimetable = async (req, res) => {
  try {
    // Teachers may only delete records for their own assigned classes/sections.
    if (req.teacherScope) {
      const slot = await Timetable.findOne({ _id: req.params.id, schoolId: req.tenantId }).lean();
      if (!slot) return res.status(404).json({ success: false, message: "Timetable slot not found" });
      if (!req.teacherScope.has(slot.class, slot.section)) {
        return res.status(403).json({
          success: false,
          message: "Teachers can only manage their assigned classes and sections",
        });
      }
    }
    const slot = await Timetable.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!slot) return res.status(404).json({ success: false, message: "Timetable slot not found" });
    res.json({ success: true, message: "Timetable slot removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { upsertTimetable, getTimetable, deleteTimetable };
