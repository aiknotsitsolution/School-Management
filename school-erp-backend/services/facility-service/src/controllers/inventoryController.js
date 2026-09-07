const InventoryItem = require("../models/InventoryItem");

const addItem = async (req, res) => {
  try {
    const item = await InventoryItem.create({ ...req.body, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getItems = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { schoolId: req.tenantId };
    if (category) filter.category = category;
    const data = await InventoryItem.find(filter);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const item = await InventoryItem.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      req.body,
      { new: true },
    );
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await InventoryItem.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });
    res.json({ success: true, message: "Item removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { addItem, getItems, updateItem, deleteItem };
