const { scopeQuery } = require("@school-erp/shared/src/middleware/branchScope");
const DigitalBook = require("../models/DigitalBook");
const ReadingProgress = require("../models/ReadingProgress");

// Central HTTP helpers keep outbound timeouts and retries uniform, and the
// tiny TTL caches stop us from hammering free public APIs (Open Library and
// Gutendex are occasionally slow) while keeping school UI snappy.
const cache = new Map();

function cachedURL(url, ttlMs, fetcher, maxAge = ttlMs) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < maxAge) return Promise.resolve(hit.value);
  const p = fetcher()
    .then((v) => {
      cache.set(url, { value: v, at: Date.now() });
      return v;
    })
    .catch((err) => {
      if (hit) return hit.value; // stale-but-valid fallback
      throw err;
    });
  return p;
}

async function fetchJSON(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "school-erp-library/1.0" },
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Reading-band heuristics (Nursery … Class 12) ───────────────────────────

const BAND_RULES = [
  {
    band: "nursery-2",
    rx: /\b(alphabet|abc|primer|kindergarten|nursery rhymes|counting|baby|toddler|picture book|easy reader|first words|nursery)\b/i,
  },
  {
    band: "3-5",
    rx: /\b(fairy tale|fairy-tale|fable|folktale|folk tale|children's stories|story book|nursery tale|picture-book|picture book|short stories for children)\b/i,
  },
  {
    band: "6-8",
    rx: /\b(juvenile fiction|juvenile|young readers|mystery|adventure stories|school stories|junior|children's literature|boys|girls)\b/i,
  },
  {
    band: "9-12",
    rx: /\b(young adult|science fiction|novel|biography|autobiography|history|literature|poetry|drama|essay|study guide|textbook)\b/i,
  },
];

function inferBand(meta) {
  const hay = [meta.title, meta.author, meta.subjects].filter(Boolean).join(" | ");
  let best = "general";
  for (const rule of BAND_RULES) {
    if (rule.rx.test(hay)) { best = rule.band; break; }
  }
  // Open Library supplies explicit educationLevel ("Nursery", "P-5", …).
  const lvl = (meta.educationLevel || "").toLowerCase();
  if (lvl.includes("nursery")) return "nursery-2";
  if (/k\s*-?\s*[2-5]|primary/.test(lvl)) return "3-5";
  if (/middle|elementary|junior/.test(lvl)) return "6-8";
  if (/secondary|high school|college/.test(lvl)) return "9-12";
  return best;
}

const COVER_PROXY = "/api/library/digital/cover";

// ── Open Library search ─────────────────────────────────────────────────────

async function searchOpenLibrary(q, limit = 24) {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=key,title,author_name,first_publish_year,cover_i,subject,language,ebook_access,ia,number_of_pages_median`;
  const json = await cachedURL(`ol-search:${q}:${limit}`, 15 * 60 * 1000, () => fetchJSON(url));
  return (json.docs || []).map(mapOLDoc);
}

function mapOLDoc(d) {
  const key = d.key || "";
  const subject = Array.isArray(d.subject) ? d.subject : [d.subject].filter(Boolean);
  const readable = d.ebook_access === "public";
  const borrowable = d.ebook_access === "borrowable";
  const ia = d.ia && d.ia[0];
  const author = Array.isArray(d.author_name) ? d.author_name[0] : d.author_name || "";
  return {
    provider: "openlibrary",
    providerKey: key,
    title: d.title || "Untitled",
    author,
    coverId: d.cover_i,
    coverUrl: d.cover_i ? `${COVER_PROXY}/openlibrary/${d.cover_i}` : "",
    description: "",
    language: Array.isArray(d.language) ? d.language[0] : "en",
    pageCount: d.number_of_pages_median,
    readable,
    borrowable,
    band: inferBand({ title: d.title, author, subjects: subject }),
    subjects: subject,
    readUrl: (readable || borrowable)
      ? (ia ? `https://archive.org/details/${ia}` : `https://openlibrary.org${key}`)
      : "",
  };
}

// ── Project Gutenberg classics shelf (via Gutendex) ────────────────────────

const GUTENDEX = "https://gutendex.com/books";

function bandTopic(band) {
  switch (band) {
    case "nursery-2": return "children";
    case "3-5": return "children,picture";
    case "6-8": return "juvenile";
    case "9-12": return "young-adult";
    default: return "children,juvenile";
  }
}

function mapGutenberg(d) {
  const id = String(d.id);
  const subject = Array.isArray(d.subjects) ? d.subjects : [];
  const epub = d.formats && d.formats["application/epub+zip"];
  return {
    provider: "gutenberg",
    providerKey: id,
    title: d.title || "Untitled",
    author: d.authors && d.authors[0] ? d.authors[0].name : "",
    coverId: d.id,
    coverUrl: `${COVER_PROXY}/gutenberg/${id}`,
    description: "",
    language: Array.isArray(d.languages) ? d.languages[0] : "en",
    pageCount: null,
    readable: Boolean(epub),
    borrowable: false,
    band: inferBand({ title: d.title, author: d.authors?.[0]?.name, subjects: subject }),
    subjects: subject,
    readUrl: "",
  };
}

async function searchGutenberg(q, limit = 24) {
  const url = `${GUTENDEX}?search=${encodeURIComponent(q)}&languages=en&sort=popular&page_size=${limit}`;
  const json = await cachedURL(`gut-search:${q}:${limit}`, 24 * 60 * 60 * 1000, () => fetchJSON(url));
  return (json.results || []).map(mapGutenberg);
}

async function getClassics(band = "", q = "") {
  // Restrict to the free classics shelf; a query narrows it client-style.
  const topic = bandTopic(band || "general");
  const cacheKey = `classics:${topic}:${q}`;
  // Cache the SETTLED result (Gutenberg or the Open Library fallback) so a
  // flaky Gutendex never makes repeated slow requests.
  return cachedURL(cacheKey, 24 * 60 * 60 * 1000, async () => {
    try {
      const url = q
        ? `${GUTENDEX}?search=${encodeURIComponent(q)}&languages=en&sort=popular&page_size=30`
        : `${GUTENDEX}?topic=${topic}&languages=en&sort=popular&page_size=30`;
      const json = await fetchJSON(url, 7000);
      return (json.results || []).map(mapGutenberg);
    } catch {
      // Gutendex is flaky; fall back to Open Library children's search so the
      // shelf never hard-fails.
      try {
        return await searchOpenLibrary(q || "children's stories", 30);
      } catch {
        return [];
      }
    }
  });
}

// ── Shelf CRUD ─────────────────────────────────────────────────────────────

// Allowlist guard: only metadata we trust may be set from the request body.
const SHELF_FIELDS = ["title", "author", "coverId", "coverUrl", "description",
  "language", "pageCount", "educationLevel", "band", "readUrl", "epubUrl",
  "readable", "provider", "providerKey"];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

const importBook = async (req, res) => {
  try {
    const { provider, providerKey } = req.body;
    if (!provider || !providerKey) {
      return res.status(400).json({ success: false, message: "provider and providerKey are required" });
    }
    if (!["openlibrary", "gutenberg"].includes(provider)) {
      return res.status(400).json({ success: false, message: "Unknown provider" });
    }
    const existing = await DigitalBook.findOne(scopeQuery(DigitalBook, req, {
      schoolId: req.tenantId, provider, providerKey,
    }));
    if (existing) {
      return res.status(409).json({ success: false, message: "This book is already on the shelf" });
    }
    const doc = await DigitalBook.create({
      ...pick({ ...req.body, provider, providerKey }, SHELF_FIELDS),
      schoolId: req.tenantId,
      importedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "This book is already on the shelf" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

const getShelf = async (req, res) => {
  try {
    const { band } = req.query;
    const filter = scopeQuery(DigitalBook, req, { schoolId: req.tenantId })
    if (band && band !== "general" && band !== "all") filter.band = band;
    const data = await DigitalBook.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateShelf = async (req, res) => {
  try {
    const doc = await DigitalBook.findOneAndUpdate(scopeQuery(DigitalBook, req, 
      { _id: req.params.id, schoolId: req.tenantId }),
      pick(req.body, SHELF_FIELDS),
      { new: true },
    );
    if (!doc) return res.status(404).json({ success: false, message: "Book not on shelf" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const removeShelf = async (req, res) => {
  try {
    const doc = await DigitalBook.findOneAndDelete(scopeQuery(DigitalBook, req, { _id: req.params.id, schoolId: req.tenantId }));
    if (!doc) return res.status(404).json({ success: false, message: "Book not on shelf" });
    await ReadingProgress.deleteMany(scopeQuery(ReadingProgress, req, {
      schoolId: req.tenantId,
      bookRef: `${doc.provider}:${doc.providerKey}`,
    }));
    res.json({ success: true, message: "Book removed from shelf" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Reading progress (self-scoped) ─────────────────────────────────────────

const bookRef = (b) => `${b.provider}:${b.providerKey}`;

const getProgress = async (req, res) => {
  try {
    const doc = await ReadingProgress.findOne(scopeQuery(ReadingProgress, req, {
      schoolId: req.tenantId, userId: req.user.id, bookRef: req.params.ref,
    }));
    res.json({
      success: true,
      data: doc ? { cfi: doc.cfi, percentage: doc.percentage, lastReadAt: doc.lastReadAt } : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const saveProgress = async (req, res) => {
  try {
    const { cfi = "", percentage = 0 } = req.body;
    const pct = Math.min(100, Math.max(0, Number(percentage) || 0));
    const doc = await ReadingProgress.findOneAndUpdate(scopeQuery(ReadingProgress, req, 
      { schoolId: req.tenantId, userId: req.user.id, bookRef: req.params.ref }),
      { cfi, percentage: pct, lastReadAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ success: true, data: { cfi: doc.cfi, percentage: doc.percentage } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Content proxies (covers + epub files) ──────────────────────────────────
// Serve public-domain book covers and Gutenberg EPUBs through our own origin so
// <img> tags and the epub.js reader never hit upstream CORS or rate limits.
// These two handlers are deliberately mounted BEFORE the auth middleware so
// the browser can load them without a Bearer header.

const coverCache = new Map();

async function pipeBuffer(res, url, contentType, cacheStore = null, ttlMs = 24 * 60 * 60 * 1000) {
  if (cacheStore) {
    const hit = cacheStore.get(url);
    if (hit && Date.now() - hit.at < ttlMs) {
      res.set("Content-Type", contentType).set("Content-Length", hit.buf.length);
      return res.send(hit.buf);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "school-erp-library/1.0" },
    });
    if (!upstream.ok) return res.status(502).json({ success: false, message: "Upstream unavailable" });
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (cacheStore) cacheStore.set(url, { buf, at: Date.now() });
    res.set("Content-Type", contentType).set("Content-Length", buf.length);
    res.send(buf);
  } catch {
    res.status(502).json({ success: false, message: "Upstream unavailable" });
  } finally {
    clearTimeout(timer);
  }
}

const proxyCover = (req, res) => {
  const { provider, id } = req.params;
  if (/^[a-zA-Z0-9-]+$/.test(id) === false) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }
  let url;
  let type = "image/jpeg";
  if (provider === "openlibrary") {
    url = `https://covers.openlibrary.org/b/id/${id}-L.jpg`;
  } else if (provider === "gutenberg") {
    url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
  } else {
    return res.status(400).json({ success: false, message: "Unknown provider" });
  }
  return pipeBuffer(res, url, type, coverCache);
};

const proxyEpub = (req, res) => {
  const id = String(req.params.id);
  if (/^\d+$/.test(id) === false) {
    return res.status(400).json({ success: false, message: "Invalid Gutenberg id" });
  }
  const url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}-images.epub`;
  return pipeBuffer(res, url, "application/epub+zip");
};

module.exports = {
  searchOpenLibrary,
  searchGutenberg,
  getClassics,
  proxyCover,
  proxyEpub,
  importBook,
  getShelf,
  updateShelf,
  removeShelf,
  getProgress,
  saveProgress,
  bookRef,
};