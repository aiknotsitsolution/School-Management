const Timetable = require("../models/Timetable");

// Mass-assignment guard: only these fields may be set from the request body.
const TIMETABLE_FIELDS = ["class", "section", "day", "periods"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const upsertTimetable = async (req, res) => {
  try {
    const { class: cls, section, day } = req.body;
    const timetable = await Timetable.findOneAndUpdate(
      { schoolId: req.tenantId, class: cls, section, day },
      { ...pick(req.body, TIMETABLE_FIELDS), schoolId: req.tenantId },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(201).json({ success: true, data: timetable });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getTimetable = async (req, res) => {
  try {
    const { class: cls, section } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (section) filter.section = section;
    const data = await Timetable.find(filter);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteTimetable = async (req, res) => {
  try {
    const slot = await Timetable.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!slot) return res.status(404).json({ success: false, message: "Timetable slot not found" });
    res.json({ success: true, message: "Timetable slot removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { upsertTimetable, getTimetable, deleteTimetable };
