const ExamType = require("../models/ExamType");
const FeeType = require("../models/FeeType");
const BookCategory = require("../models/BookCategory");
const SchoolClass = require("../models/SchoolClass");
const SchoolSection = require("../models/SchoolSection");
const SchoolSubject = require("../models/SchoolSubject");
const TimeSlot = require("../models/TimeSlot");
const Room = require("../models/Room");
const AttendanceStatus = require("../models/AttendanceStatus");
const {
  createMasterController,
  httpError,
  clean,
  normalizeKey,
} = require("@school-erp/shared/src/master-data");
const { findMissingMasterRefs, missingMessage } = require("../utils/masterRefs");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------------------------------------------- formatters
function format12h(time) {
  const [hh, mm] = time.split(":").map(Number);
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour}:${String(mm).padStart(2, "0")} ${suffix}`;
}

function timeSlotLabel(startTime, endTime) {
  return `${format12h(startTime)} – ${format12h(endTime)}`;
}

// ------------------------------------------------------- per-school defaults
const CLASS_SEEDS = [
  "Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "10", "11-Sci", "11-Com", "12-Sci", "12-Com",
];
const SECTION_SEEDS = ["A", "B", "C"];
const SUBJECT_SEEDS = [
  "Mathematics", "English", "Science", "Hindi", "Social Science",
  "Computer Science", "Physics", "Chemistry", "Biology", "Accountancy",
  "Business Studies", "Economics", "Physical Education",
];

// Platform-level (global) subject library seeded once. Available to every
// tenant; tenant customs are stored separately with scope=tenant.
const GLOBAL_SUBJECT_SEEDS = [
  "Mathematics", "English", "Hindi", "Science", "Social Science",
  "Physics", "Chemistry", "Biology", "Computer Science", "Physical Education",
  "Accountancy", "Business Studies", "Economics", "Art & Craft",
  "Environmental Studies", "General Knowledge", "Moral Education",
];
const FEE_TYPE_SEEDS = [
  "Tuition", "Transport", "Hostel", "Exam", "Library", "Sports", "Lab", "Miscellaneous",
];
const BOOK_CATEGORY_SEEDS = [
  "Textbook", "Fiction", "Finance", "Biography", "History", "Self-Help", "Science", "Reference",
];
const EXAM_TYPE_SEEDS = [
  "Term 1 — Unit Test", "Term 1 — Mid Term", "Term 1 — Final",
  "Term 2 — Unit Test", "Term 2 — Mid Term", "Term 2 — Final",
  "Pre-Board", "Practical",
];
const ROOM_SEEDS = [
  "Room 101", "Room 102", "Room 201", "Room 202", "Room 203", "Room 204",
  "Room 301", "Room 302", "Lab 1", "Lab 2", "Auditorium", "Hall A",
];
const TIME_SLOT_SEEDS = [
  ["09:00", "11:00"], ["09:00", "12:00"], ["10:00", "12:00"],
  ["11:00", "13:00"], ["13:00", "15:00"], ["14:00", "16:00"],
];
const ATTENDANCE_STATUS_SEEDS = ["Present", "Absent", "Late", "Leave"];

const SUBJECT_KIND = {
  label: "Subject",
  model: SchoolSubject,
  dualScope: true,
  sort: { name: 1 },
  build(payload) {
    const name = clean(payload.name);
    if (!name) throw httpError(400, "Subject name is required");
    const out = { name, className: clean(payload.className) };
    if (payload.description != null) out.description = clean(payload.description);
    return out;
  },
  // Cross-scope duplicate check on the logical name (className intentionally
  // excluded so a school cannot have two "Mathematics" rows under one scope).
  dupQuery(payload) {
    const name = normalizeKey(payload.name);
    return name ? { normalizedName: name } : {};
  },
  seeds: () => SUBJECT_SEEDS.map((name) => ({ name, className: "" })),
  globalSeeds: () =>
    GLOBAL_SUBJECT_SEEDS.map((name) => ({ name, normalizedName: normalizeKey(name) })),
  // Subjects merge the global library + this school's tenant-scoped subjects.
  async listDualScope({ req, canWrite }) {
    const tenantCount = await SchoolSubject.countDocuments({
      scope: "tenant",
      schoolId: req.tenantId,
    });
    if (tenantCount === 0 && canWrite) {
      const rows = SUBJECT_SEEDS.map((name) => ({
        scope: "tenant",
        schoolId: req.tenantId,
        tenantId: req.tenantId,
        name,
        className: "",
      }));
      await SchoolSubject.insertMany(rows).catch(() => {});
    }
    const rows = await SchoolSubject.find({
      status: "active",
      $or: [{ scope: "global" }, { scope: "tenant", schoolId: req.tenantId }],
    })
      .sort({ scope: -1, name: 1 })
      .lean();
    // Merge global + tenant into one clean list. Same name can exist in both
    // scopes (tenant copied a global); prefer the tenant's copy. The user should
    // not see duplicates or need to know where a subject came from.
    const byName = new Map();
    for (const row of rows) {
      if (!byName.has(row.normalizedName)) byName.set(row.normalizedName, row);
    }
    return Array.from(byName.values());
  },
};

const MASTERS = {
  "exam-types": {
    label: "Exam type",
    model: ExamType,
    sort: { name: 1 },
    build(payload) {
      const name = clean(payload.name);
      if (!name) throw httpError(400, "Exam type name is required");
      return { name };
    },
    dupFilter(payload) {
      const name = normalizeKey(payload.name);
      return name ? { key: name } : null;
    },
    seeds: () => EXAM_TYPE_SEEDS.map((name) => ({ name })),
  },
  classes: {
    label: "Class",
    model: SchoolClass,
    sort: { name: 1 },
    build(payload) {
      const name = clean(payload.name);
      if (!name) throw httpError(400, "Class name is required");
      return { name };
    },
    dupFilter(payload) {
      const name = normalizeKey(payload.name);
      return name ? { key: name } : null;
    },
    seeds: () => CLASS_SEEDS.map((name) => ({ name })),
  },
  sections: {
    label: "Section",
    model: SchoolSection,
    sort: { className: 1, name: 1 },
    build(payload) {
      const name = clean(payload.name);
      if (!name) throw httpError(400, "Section name is required");
      return { name, className: clean(payload.className) };
    },
    dupFilter(payload) {
      const name = normalizeKey(payload.name);
      return name ? { className: clean(payload.className), key: name } : null;
    },
    seeds: () =>
      CLASS_SEEDS.flatMap((className) =>
        SECTION_SEEDS.map((name) => ({ className, name })),
      ),
  },
  subjects: SUBJECT_KIND,
  "time-slots": {
    label: "Time slot",
    model: TimeSlot,
    sort: { startTime: 1, endTime: 1 },
    build(payload) {
      const startTime = clean(payload.startTime);
      const endTime = clean(payload.endTime);
      if (!startTime || !endTime) {
        throw httpError(400, "Start time and end time are required (HH:MM)");
      }
      if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
        throw httpError(400, "Times must use HH:MM format (24h)");
      }
      if (startTime >= endTime) {
        throw httpError(400, "End time must be after start time");
      }
      return { startTime, endTime, label: timeSlotLabel(startTime, endTime) };
    },
    dupFilter(payload) {
      const startTime = clean(payload.startTime);
      const endTime = clean(payload.endTime);
      return startTime && endTime ? { startTime, endTime } : null;
    },
    seeds: () =>
      TIME_SLOT_SEEDS.map(([startTime, endTime]) => ({
        startTime,
        endTime,
        label: timeSlotLabel(startTime, endTime),
      })),
  },
  "fee-types": {
    label: "Fee type",
    model: FeeType,
    sort: { name: 1 },
    build(payload) {
      const name = clean(payload.name);
      if (!name) throw httpError(400, "Fee type name is required");
      return { name };
    },
    dupFilter(payload) {
      const name = normalizeKey(payload.name);
      return name ? { key: name } : null;
    },
    seeds: () => FEE_TYPE_SEEDS.map((name) => ({ name })),
  },
  "book-categories": {
    label: "Book category",
    model: BookCategory,
    sort: { name: 1 },
    build(payload) {
      const name = clean(payload.name);
      if (!name) throw httpError(400, "Book category name is required");
      return { name };
    },
    dupFilter(payload) {
      const name = normalizeKey(payload.name);
      return name ? { key: name } : null;
    },
    seeds: () => BOOK_CATEGORY_SEEDS.map((name) => ({ name })),
  },
  rooms: {
    label: "Room",
    model: Room,
    sort: { name: 1 },
    build(payload) {
      const name = clean(payload.name);
      if (!name) throw httpError(400, "Room name is required");
      return { name };
    },
    dupFilter(payload) {
      const name = normalizeKey(payload.name);
      return name ? { key: name } : null;
    },
    seeds: () => ROOM_SEEDS.map((name) => ({ name })),
  },
  "attendance-statuses": {
    label: "Attendance status",
    model: AttendanceStatus,
    sort: { name: 1 },
    build(payload) {
      const name = clean(payload.name);
      if (!name) throw httpError(400, "Attendance status name is required");
      return { name };
    },
    dupFilter(payload) {
      const name = normalizeKey(payload.name);
      return name ? { key: name } : null;
    },
    seeds: () => ATTENDANCE_STATUS_SEEDS.map((name) => ({ name })),
  },
};

const controller = createMasterController({
  kinds: MASTERS,
  readPermission: "exams:read",
  writePermission: "exams:write",
});

// Cross-service referential integrity endpoint. Student/staff/fee forward the
// caller's Bearer token + X-School-Id, so this re-uses the same identity and
// tenant. Returns 400 with the offending values when a provided value does not
// resolve to an active master (see utils/masterRefs.js for the empty-catalog
// compatibility leniency).
const validateRefs = async (req, res) => {
  try {
    const missing = await findMissingMasterRefs({
      schoolId: req.tenantId,
      class: req.body.class,
      section: req.body.section,
      subject: req.body.subject,
      room: req.body.room,
      feeType: req.body.feeType,
    });
    if (missing.length) {
      return res.status(400).json({ success: false, message: missingMessage(missing), missing });
    }
    res.json({ success: true, missing: [] });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

module.exports = {
  list: controller.list,
  getById: controller.getById,
  create: controller.create,
  deactivate: controller.deactivate,
  validateRefs,
  MASTERS,
  timeSlotLabel,
};