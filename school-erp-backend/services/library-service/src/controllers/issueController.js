const Book = require("../models/Book");
const IssueRecord = require("../models/IssueRecord");
const { paginate, pageInfo } = require("../utils/pagination");

const issueBook = async (req, res) => {
  try {
    const { bookId, borrowerId, borrowerType, dueDate } = req.body;
    const book = await Book.findOne({ _id: bookId, schoolId: req.tenantId });
    if (!book) return res.status(404).json({ success: false, message: "Book not found" });
    if (book.availableCopies < 1) return res.status(400).json({ success: false, message: "No copies available" });

    book.availableCopies -= 1;
    await book.save();

    const record = await IssueRecord.create({ bookId, borrowerId, borrowerType, dueDate, schoolId: req.tenantId });
    res.status(201).json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const returnBook = async (req, res) => {
  try {
    const record = await IssueRecord.findOne({ _id: req.params.id, schoolId: req.tenantId });
    if (!record) return res.status(404).json({ success: false, message: "Issue record not found" });
    if (record.status === "Returned") return res.status(400).json({ success: false, message: "Already returned" });

    record.returnDate = new Date();
    record.status = "Returned";
    if (record.returnDate > record.dueDate) {
      const daysLate = Math.ceil((record.returnDate - record.dueDate) / (1000 * 60 * 60 * 24));
      record.fine = daysLate * 5;
    }
    await record.save();

    const book = await Book.findOne({ _id: record.bookId, schoolId: req.tenantId });
    if (book) {
      book.availableCopies += 1;
      await book.save();
    }

    res.json({ success: true, data: record });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const getIssues = async (req, res) => {
  try {
    const { borrowerId, status } = req.query;
    const filter = { schoolId: req.tenantId };
    if (borrowerId) filter.borrowerId = borrowerId;
    if (status) filter.status = status;
    const { page, limit, skip } = paginate(req.query);
    const [data, total] = await Promise.all([
      IssueRecord.find(filter).populate("bookId").sort({ issueDate: -1 }).skip(skip).limit(limit),
      IssueRecord.countDocuments(filter),
    ]);
    res.json({ success: true, count: data.length, total, ...pageInfo(total, page, limit), data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { issueBook, returnBook, getIssues };
