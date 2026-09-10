const FeeStructure = require("../models/FeeStructure");
const { assertAcademicRefs } = require("@school-erp/shared/src/master-data");

const STRUCTURE_FIELDS = ["class", "session", "feeType", "amount", "frequency", "dueDate"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const createStructure = async (req, res) => {
  try {
    await assertAcademicRefs({ req, values: { class: req.body.class } });
    const structure = await FeeStructure.create({ ...pick(req.body, STRUCTURE_FIELDS), schoolId: req.tenantId });
    res.status(201).json({ success: true, data: structure });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A fee structure with this class, session, and fee type already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const getStructures = async (req, res) => {
  try {
    const { class: cls, session, feeType, active } = req.query;
    const filter = { schoolId: req.tenantId };
    if (cls) filter.class = cls;
    if (session) filter.session = session;
    if (feeType) filter.feeType = feeType;
    if (active !== undefined) filter.active = active === "true";
    const data = await FeeStructure.find(filter).sort({ session: -1, class: 1, feeType: 1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateStructure = async (req, res) => {
  try {
    const struct = await FeeStructure.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!struct) return res.status(404).json({ success: false, message: "Fee structure not found" });

    const updates = pick(req.body, STRUCTURE_FIELDS);
    if (updates.class && updates.class !== struct.class) {
      await assertAcademicRefs({ req, values: { class: updates.class } });
    }

    Object.assign(struct, updates);
    await struct.save();
    res.json({ success: true, data: struct });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A fee structure with this class, session, and fee type already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const toggleActive = async (req, res) => {
  try {
    const struct = await FeeStructure.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!struct) return res.status(404).json({ success: false, message: "Fee structure not found" });
    struct.active = req.body.active !== undefined ? Boolean(req.body.active) : !struct.active;
    await struct.save();
    res.json({ success: true, data: struct });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
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

module.exports = { createStructure, getStructures, updateStructure, toggleActive, deleteStructure };
