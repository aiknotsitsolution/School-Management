const ExamType = require("../models/ExamType");
const SchoolClass = require("../models/SchoolClass");
const SchoolSection = require("../models/SchoolSection");
const SchoolSubject = require("../models/SchoolSubject");
const TimeSlot = require("../models/TimeSlot");
const Room = require("../models/Room");
const { getPermissionsFor } = require("../utils/permissions");

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

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

const clean = (value) => String(value || "").trim();

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

// ------------------------------------------------------------- kind registry
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
      const name = clean(payload.name);
      return name ? { key: name.toLowerCase().replace(/\s+/g, " ").trim() } : null;
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
      const name = clean(payload.name);
      return name ? { key: name.toLowerCase().replace(/\s+/g, " ").trim() } : null;
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
      const name = clean(payload.name);
      return name ? { className: clean(payload.className), key: name.toLowerCase().replace(/\s+/g, " ").trim() } : null;
    },
    seeds: () =>
      CLASS_SEEDS.flatMap((className) =>
        SECTION_SEEDS.map((name) => ({ className, name })),
      ),
  },
  subjects: {
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
    dupFilter(payload) {
      const name = clean(payload.name);
      return name ? { className: clean(payload.className), normalizedName: name.toLowerCase().replace(/\s+/g, " ").trim() } : null;
    },
    seeds: () => SUBJECT_SEEDS.map((name) => ({ name, className: "" })),
  },
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
      const name = clean(payload.name);
      return name ? { key: name.toLowerCase().replace(/\s+/g, " ").trim() } : null;
    },
    seeds: () => ROOM_SEEDS.map((name) => ({ name })),
  },
};

async function seedDefaults(ctx, schoolId) {
  const docs = await ctx.model.countDocuments({ schoolId });
  if (docs > 0) return false;
  const rows = ctx.seeds().map((row) => ({ ...row, schoolId }));
  if (rows.length) {
    await ctx.model.insertMany(rows);
  }
  return true;
}

// Seed the platform-level global subject library once (idempotent). Configures a
// fresh environment so the Subject dropdown never starts empty.
async function seedGlobalSubjects() {
  const count = await SchoolSubject.countDocuments({ scope: "global" });
  if (count > 0) return false;
  const rows = GLOBAL_SUBJECT_SEEDS.map((name) => ({
    scope: "global",
    name,
    normalizedName: name.toLowerCase().replace(/\s+/g, " ").trim(),
  }));
  if (rows.length) {
    await SchoolSubject.insertMany(rows);
  }
  return true;
}

// Subjects merge the global library + this school's tenant-scoped subjects.
async function listSubjects(req) {
  await seedGlobalSubjects().catch(() => {});
  const tenantCount = await SchoolSubject.countDocuments({
    scope: "tenant",
    schoolId: req.tenantId,
  });
  if (tenantCount === 0) {
    const canWrite = getPermissionsFor(req.user).includes("exams:write");
    if (canWrite) {
      const rows = SUBJECT_SEEDS.map((name) => ({
        scope: "tenant",
        schoolId: req.tenantId,
        tenantId: req.tenantId,
        name,
        className: "",
      }));
      await SchoolSubject.insertMany(rows).catch(() => {});
    }
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
}

async function list(req, res, next) {
  try {
    const ctx = MASTERS[req.params.kind];
    if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });

    if (ctx.dualScope) {
      const rows = await listSubjects(req);
      return res.json({ success: true, count: rows.length, data: rows });
    }

    let docs = await ctx.model.find({ schoolId: req.tenantId, active: true }).sort(ctx.sort).lean();

    if (docs.length === 0) {
      // Fresh school: provision the demo defaults so the Schedule Exam flow is
      // usable immediately. Only admins trigger seeding; everyone else sees an
      // honest "nothing configured" list. Idempotent per school+kind.
      const canWrite = getPermissionsFor(req.user).includes("exams:write");
      if (canWrite && (await seedDefaults(ctx, req.tenantId))) {
        docs = await ctx.model.find({ schoolId: req.tenantId, active: true }).sort(ctx.sort).lean();
      }
    }

    res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const ctx = MASTERS[req.params.kind];
    if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });

    const filter = { _id: req.params.id };
    if (ctx.dualScope) {
      filter.$or = [{ scope: "global" }, { scope: "tenant", schoolId: req.tenantId }];
    } else {
      filter.schoolId = req.tenantId;
    }
    const doc = await ctx.model.findOne(filter).lean();
    if (!doc) return res.status(404).json({ success: false, message: `${ctx.label} not found` });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const ctx = MASTERS[req.params.kind];
    if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });

    const payload = ctx.build(req.body || {});

    // For dual-scope (subjects): check both global + tenant for duplicates.
    // Always create as tenant-scoped.
    if (ctx.dualScope) {
      const normalizedName = payload.name
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const existing = await ctx.model.findOne({
        $or: [
          { scope: "global", normalizedName },
          { scope: "tenant", schoolId: req.tenantId, normalizedName },
        ],
      }).lean();
      if (existing) {
        const label = existing.scope === "global" ? "Global subject" : "Subject";
        return res.status(409).json({
          success: false,
          message: `${label} "${existing.name}" already exists`,
          data: { existingId: existing._id, name: existing.name, scope: existing.scope },
        });
      }
      const doc = await ctx.model.create({
        ...payload,
        scope: "tenant",
        schoolId: req.tenantId,
        tenantId: req.tenantId,
        createdBy: req.user?._id || req.user?.id || null,
      });
      return res.status(201).json({ success: true, data: doc });
    }

    const dupFilter = ctx.dupFilter(payload);
    if (dupFilter) {
      const existing = await ctx.model.findOne({ schoolId: req.tenantId, ...dupFilter }).lean();
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `${ctx.label} "${payload.name || payload.label}" already exists for this school`,
        });
      }
    }

    const doc = await ctx.model.create({ ...payload, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: `This value already exists for this school` });
    }
    if (err && err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const ctx = MASTERS[req.params.kind];
    if (!ctx) return res.status(404).json({ success: false, message: "Unknown master type" });
    // Only tenant-scoped masters can be deactivated; global subjects are
    // immutable by tenants.
    const filter = { _id: req.params.id };
    if (ctx.dualScope) {
      filter.scope = "tenant";
      filter.schoolId = req.tenantId;
    } else {
      filter.schoolId = req.tenantId;
    }
    // Subjects use status:"inactive"; other masters use active:false.
    const update = ctx.dualScope ? { status: "inactive" } : { active: false };
    const doc = await ctx.model.findOneAndUpdate(filter, update, { new: true }).lean();
    if (!doc) return res.status(404).json({ success: false, message: `${ctx.label} not found` });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, deactivate, MASTERS, timeSlotLabel };