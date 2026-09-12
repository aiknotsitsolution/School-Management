const AcademicSession = require("../models/AcademicSession");
const School = require("../models/School");
const { httpError } = require("@school-erp/shared/src/master-data");

const PICK_FIELDS = ["name", "startDate", "endDate", "metadata"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

function toDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Half-open interval [start, end): a session ends the moment the next begins,
// so back-to-back sessions like 2026-04-01..2027-03-31 and
// 2027-04-01..2028-03-31 are NOT considered overlapping.
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

async function assertUniqueName(schoolId, name, excludeId) {
  const query = { schoolId, name };
  if (excludeId) query._id = { $ne: excludeId };
  const clash = await AcademicSession.findOne(query).lean();
  if (clash) throw httpError(409, `Academic session "${name}" already exists for this school`);
}

async function assertNoOverlap(schoolId, startDate, endDate, excludeId) {
  const query = { schoolId };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await AcademicSession.find(query).lean();
  const clash = existing.find((s) =>
    rangesOverlap(startDate, endDate, s.startDate, s.endDate),
  );
  if (clash) {
    throw httpError(
      409,
      `Academic session "${clash.name}" (${clash.startDate.toISOString().slice(0, 10)} to ${clash.endDate.toISOString().slice(0, 10)}) overlaps with the requested dates`,
    );
  }
}

const listSessions = async (req, res) => {
  try {
    const data = await AcademicSession.find({ schoolId: req.tenantId })
      .sort({ startDate: 1 })
      .lean();
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getSessionById = async (req, res) => {
  try {
    const session = await AcademicSession.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    }).lean();
    if (!session) return res.status(404).json({ success: false, message: "Academic session not found" });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Sessions are never hard-deleted once activated/ended or once their start
// date has passed - historical records (fee structures, teacher assignments,
// marks, report cards) reference them. Only future, never-activated sessions
// may be removed.
const deleteSession = async (req, res) => {
  try {
    const session = await AcademicSession.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!session) return res.status(404).json({ success: false, message: "Academic session not found" });

    if (session.isCurrent || session.status !== "planned") {
      throw httpError(
        409,
        "This session is protected: activated or ended sessions cannot be deleted because historical records may reference them",
      );
    }
    const today = startOfToday().getTime();
    if (session.startDate && session.startDate.getTime() <= today) {
      throw httpError(
        409,
        "This session has already started and cannot be deleted; it remains queryable as part of the academic history",
      );
    }

    await AcademicSession.deleteOne({ _id: session._id });
    res.json({ success: true, message: "Academic session deleted" });
  } catch (err) {
    res.status(err.status || 403).json({ success: false, message: err.message });
  }
};

const createSession = async (req, res) => {
  try {
    const body = pick(req.body, PICK_FIELDS);
    const name = String(body.name || "").trim();
    const startDate = toDate(body.startDate);
    const endDate = toDate(body.endDate);

    if (!name) throw httpError(400, "Session name is required (e.g. 2026-27)");
    if (!startDate || !endDate) throw httpError(400, "startDate and endDate are required");
    if (endDate.getTime() <= startDate.getTime()) {
      throw httpError(400, "endDate must be after startDate");
    }

    await assertUniqueName(req.tenantId, name);
    await assertNoOverlap(req.tenantId, startDate, endDate);

    const existingCount = await AcademicSession.countDocuments({ schoolId: req.tenantId });
    // First session for a school becomes the current session automatically
    // (matches the legacy School.session bootstrap when it exists and is live).
    const isFirst = existingCount === 0;
    const isLive = endDate.getTime() >= startOfToday().getTime();

    const metadata =
      body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const session = await AcademicSession.create({
      schoolId: req.tenantId,
      name,
      startDate,
      endDate,
      metadata,
      status: isFirst && isLive ? "active" : "planned",
      isCurrent: isFirst && isLive,
    });

    if (session.isCurrent) {
      await School.updateOne({ _id: req.tenantId }, { $set: { session: session.name } });
    }

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const updateSession = async (req, res) => {
  try {
    const session = await AcademicSession.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!session) return res.status(404).json({ success: false, message: "Academic session not found" });

    // Only never-activated (planned) sessions are editable; live/historical
    // sessions keep their identity so snapshots and references stay stable.
    if (session.status !== "planned") {
      throw httpError(400, "Only planned (upcoming) sessions can be edited");
    }

    const body = pick(req.body, PICK_FIELDS);
    const name =
      body.name !== undefined ? String(body.name || "").trim() : session.name;
    const rawStart = body.startDate !== undefined ? body.startDate : session.startDate;
    const rawEnd = body.endDate !== undefined ? body.endDate : session.endDate;
    const startDate = toDate(rawStart);
    const endDate = toDate(rawEnd);

    if (!name) throw httpError(400, "Session name is required");
    if (!startDate || !endDate) throw httpError(400, "startDate and endDate are required");
    if (endDate.getTime() <= startDate.getTime()) {
      throw httpError(400, "endDate must be after startDate");
    }

    await assertUniqueName(req.tenantId, name, session._id);
    await assertNoOverlap(req.tenantId, startDate, endDate, session._id);

    session.name = name;
    session.startDate = startDate;
    session.endDate = endDate;
    if (body.metadata !== undefined) {
      session.metadata = typeof body.metadata === "object" ? body.metadata : session.metadata;
    }
    await session.save();
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

// Controlled current-session transition. The session being activated must be
// live (end date not yet passed). The previously current session is moved to
// "ended" so there is always exactly one current session per school. Keeps the
// legacy School.session string in sync so the existing fee/assignment/login
// surfaces keep showing the same value.
const activateSession = async (req, res) => {
  try {
    const session = await AcademicSession.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!session) return res.status(404).json({ success: false, message: "Academic session not found" });

    if (session.status === "ended") {
      throw httpError(400, "An ended session cannot be made current again");
    }
    if (!session.endDate || session.endDate.getTime() < startOfToday().getTime()) {
      throw httpError(400, "This session has already ended and cannot be made the current session");
    }

    await AcademicSession.updateMany(
      { schoolId: req.tenantId, _id: { $ne: session._id }, isCurrent: true },
      { $set: { isCurrent: false, status: "ended" } },
    );

    session.isCurrent = true;
    session.status = "active";
    await session.save();
    await School.updateOne({ _id: req.tenantId }, { $set: { session: session.name } });

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

const endSession = async (req, res) => {
  try {
    const session = await AcademicSession.findOne({
      _id: req.params.id,
      schoolId: req.tenantId,
    });
    if (!session) return res.status(404).json({ success: false, message: "Academic session not found" });

    if (session.status === "ended") {
      throw httpError(400, "This session is already ended");
    }

    session.status = "ended";
    session.isCurrent = false;
    await session.save();
    // School.session is intentionally left as the last-known current session so
    // the legacy display value stays meaningful; admins can activate another
    // session to move the school forward.
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
};

module.exports = {
  listSessions,
  getSessionById,
  createSession,
  updateSession,
  activateSession,
  endSession,
  deleteSession,
};