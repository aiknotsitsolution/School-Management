const Book = require("../models/Book");

const addBook = async (req, res) => {
  try {
    const { totalCopies = 1 } = req.body;
    const book = await Book.create({ ...req.body, schoolId: req.tenantId, availableCopies: totalCopies });
    res.status(201).json({ success: true, data: book });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getBooks = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = { schoolId: req.tenantId };
    if (category) filter.category = category;
    if (search) filter.title = { $regex: search, $options: "i" };
    const data = await Book.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBook = async (req, res) => {
  try {
    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.tenantId },
      req.body,
      { new: true },
    );
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    res.json({ success: true, data: book });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const deleteBook = async (req, res) => {
  try {
    const book = await Book.findOneAndDelete({ _id: req.params.id, schoolId: req.tenantId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    res.json({ success: true, message: "Book removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { addBook, getBooks, updateBook, deleteBook };
