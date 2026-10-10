const { scopeQuery } = require("@school-erp/shared/src/middleware/branchScope");
const Event = require("../models/Event");
const { paginate, pageInfo } = require("@school-erp/shared/src/utils/pagination");
const { assertAllowedUpload } = require("@school-erp/shared/src/utils/uploads");

const INDIA_HOLIDAYS_ICAL_URL =
  "https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics";
const INDIA_HOLIDAYS_CACHE_MS = 6 * 60 * 60 * 1000;
let indiaHolidaysCache = { data: null, expiresAt: 0 };

// Mass-assignment guard: only these fields may be set from the request body
// (schoolId / createdBy / timestamps stay server-owned).
const EVENT_FIELDS = [
  "title", "description", "category", "time", "image", "date", "venue", "audience",
];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const unescapeIcalText = (value) =>
  value.replace(/\\([nN,;\\])/g, (_match, escaped) => {
    if (escaped.toLowerCase() === "n") return " ";
    return escaped;
  });

const parseIndiaHolidayCalendar = (calendarText) => {
  const lines = calendarText.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const holidays = [];
  let event = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      event = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (event?.date && event.title) {
        holidays.push({
          _id: `google-india:${event.date}:${holidays.length}`,
          title: event.title,
          category: "Holiday",
          date: `${event.date.slice(0, 4)}-${event.date.slice(4, 6)}-${event.date.slice(6, 8)}`,
          source: "google-india-holidays",
        });
      }
      event = null;
      continue;
    }
    if (!event) continue;

    const dateMatch = /^DTSTART(?:;[^:]*)?:(\d{8})$/.exec(line);
    if (dateMatch) event.date = dateMatch[1];
    const summaryMatch = /^SUMMARY(?:;[^:]*)?:(.*)$/.exec(line);
    if (summaryMatch) event.title = unescapeIcalText(summaryMatch[1]);
  }

  return holidays;
};

const getIndiaHolidays = async (_req, res) => {
  if (indiaHolidaysCache.data && indiaHolidaysCache.expiresAt > Date.now()) {
    return res.json({ success: true, data: indiaHolidaysCache.data });
  }

  try {
    const response = await fetch(INDIA_HOLIDAYS_ICAL_URL, {
      headers: { Accept: "text/calendar" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Google Calendar responded with ${response.status}`);

    const calendarText = await response.text();
    if (calendarText.length > 1_000_000) throw new Error("Google Calendar feed exceeded the size limit");
    const holidays = parseIndiaHolidayCalendar(calendarText);
    if (holidays.length === 0) throw new Error("Google Calendar feed contained no holidays");

    indiaHolidaysCache = { data: holidays, expiresAt: Date.now() + INDIA_HOLIDAYS_CACHE_MS };
    return res.json({ success: true, data: holidays });
  } catch (error) {
    console.error("[events] Could not load India holidays from Google Calendar:", error);
    return res.status(502).json({
      success: false,
      message: "India holidays could not be loaded from Google Calendar. Please try again later.",
    });
  }
};

const createEvent = async (req, res) => {
  try {
    const event = await Event.create({ ...pick(req.body, EVENT_FIELDS), schoolId: req.tenantId, createdBy: req.user.name });
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A record with these details already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const getEvents = async (req, res) => {
  try {
    const filter = scopeQuery(Event, req, { schoolId: req.tenantId, $or: [{ audience: req.user.role }, { audience: "all" }] })
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      Event.find(filter).sort({ date: 1, _id: 1 }).skip(skip).limit(limit),
      Event.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(scopeQuery(Event, req, 
      { _id: req.params.id, schoolId: req.tenantId }),
      pick(req.body, EVENT_FIELDS),
      { new: true, runValidators: true },
    );
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    res.json({ success: true, data: event });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A record with these details already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findOneAndDelete(scopeQuery(Event, req, { _id: req.params.id, schoolId: req.tenantId }));
    if (!event) return res.status(404).json({ success: false, message: "Event not found" });
    res.json({ success: true, message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const uploadEventImage = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "Image file is required" });
    const uploadErr = assertAllowedUpload(req.file);
    if (uploadErr) {
      return res.status(400).json({ success: false, message: uploadErr });
    }
    const imagekit = require("@school-erp/shared/src/config/imagekit");
    if (!imagekit) {
      return res
        .status(503)
        .json({ success: false, message: "Image provider is not configured" });
    }
    const uploaded = await imagekit.upload({
      file: req.file.buffer.toString("base64"),
      fileName: `event-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
      folder: "/school-erp/events",
      useUniqueFileName: true,
    });
    res
      .status(201)
      .json({
        success: true,
        data: { url: uploaded.url, fileId: uploaded.fileId },
      });
  } catch (err) {
    res.status(502).json({ success: false, message: err?.message || "Image upload failed" });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getIndiaHolidays,
  parseIndiaHolidayCalendar,
  updateEvent,
  deleteEvent,
  uploadEventImage,
};
