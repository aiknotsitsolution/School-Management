const mongoose = require("mongoose");

// Per-user reading position inside a digital book. Keyed by the user token id
// plus a stable book reference ("openlibrary:/works/OL138052W",
// "gutenberg:11") so progress survives catalogue refreshes.
const readingProgressSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    userId: { type: String, required: true, index: true },
    bookRef: { type: String, required: true },
    // epub.js CFI location inside the document.
    cfi: { type: String, default: "" },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    lastReadAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

readingProgressSchema.index(
  { schoolId: 1, userId: 1, bookRef: 1 },
  { unique: true, name: "school_user_book_unique" }
);

module.exports = mongoose.model("ReadingProgress", readingProgressSchema);