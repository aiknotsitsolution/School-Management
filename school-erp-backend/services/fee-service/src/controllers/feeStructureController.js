const FeeStructure = require("../models/FeeStructure");

// Mass-assignment guard: only these fields may be set from the request body.
const STRUCTURE_FIELDS = ["class", "session", "feeType", "amount", "frequency", "dueDate"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createStructure = async (req, res) => {
  try {
    const structure = await FeeStructure.create({ ...pick(req.body, STRUCTURE_FIELDS), schoolId: req.tenantId });
    res.status(201).json({ success: true, data: structure });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getStructures = async (req, res) => {
  try {
    const { class: cls, session } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (session) filter.session = session;
    const data = await FeeStructure.find(filter);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteStructure = async (req, res) => {
  try {
    const struct = await FeeStructure.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!struct) return res.status(404).json({ success: false, message: "Fee structure not found" });
    res.json({ success: true, message: "Fee structure removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createStructure, getStructures, deleteStructure };
