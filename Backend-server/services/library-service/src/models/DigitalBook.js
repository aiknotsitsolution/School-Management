const mongoose = require("mongoose");

// Digital books imported from free public catalogues (Open Library / Project
// Gutenberg) onto a school's curated digital shelf. Unlike "Book" (physical
// copies with circulation), these are metadata records pointing at freely
// readable or externally-borrowable titles.
const digitalBookSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true, index: true },
    provider: { type: String, enum: ["openlibrary", "gutenberg"], default: "openlibrary" },
    // Stable id inside the provider: OL key ("/works/OL138052W") or numeric
    // Gutenberg id.
    providerKey: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, default: "" },
    coverId: { type: Number },
    coverUrl: { type: String, default: "" },
    description: { type: String, default: "" },
    language: { type: String, default: "en" },
    pageCount: { type: Number },
    educationLevel: { type: String, default: "" },
    // Reading-band tag (nursery-2 | 3-5 | 6-8 | 9-12 | general) — assigned by
    // heuristic at import, overridable by the librarian.
    band: {
      type: String,
      enum: ["nursery-2", "3-5", "6-8", "9-12", "general"],
      default: "general",
      index: true,
    },
    // Where the free full text lives:
    //  - readUrl: external reader (e.g. Open Library "public"/"borrowable").
    //  - epubUrl: stable proxied file for in-app reading (Gutenberg id based).
    readUrl: { type: String, default: "" },
    epubUrl: { type: String, default: "" },
    readable: { type: Boolean, default: false }, // full text available in-app
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

digitalBookSchema.index(
  { schoolId: 1, provider: 1, providerKey: 1 },
  { unique: true, name: "school_provider_key_unique" }
);

module.exports = mongoose.model("DigitalBook", digitalBookSchema);