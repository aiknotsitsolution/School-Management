const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    isbn: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, required: true },
    category: { type: String },
    totalCopies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
    addedOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

bookSchema.index({ schoolId: 1, isbn: 1 }, { unique: true });

module.exports = mongoose.model("Book", bookSchema);
