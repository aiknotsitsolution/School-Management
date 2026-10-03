const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/digitalController");
const { verifyToken, resolveTenant, requireTenant, requirePermission } = require("../middleware/auth");

// Public content proxies — mounted before auth so the browser can load covers
// (<img src>) and EPUBs (reader fetch) without a Bearer token. They only serve
// public-domain book files by numeric id, never tenant data.
router.get("/cover/:provider/:id", ctrl.proxyCover);
router.get("/epub/:id", ctrl.proxyEpub);

router.use(verifyToken, resolveTenant, requireTenant);

router.get("/search", requirePermission("library:read"), async (req, res) => {
  try {
    const q = String(req.query.q || "").slice(0, 120);
    if (!q) return res.json({ success: true, data: [] });
    const [ol, gut] = await Promise.allSettled([
      ctrl.searchOpenLibrary(q),
      ctrl.searchGutenberg(q),
    ]);
    // Merge: Gutenberg items first (in-app readable), then Open Library.
    const data = [
      ...(gut.status === "fulfilled" ? gut.value : []),
      ...(ol.status === "fulfilled" ? ol.value : []),
    ];
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/classics", requirePermission("library:read"), async (req, res) => {
  try {
    const band = String(req.query.band || "general");
    const q = String(req.query.q || "");
    const data = await ctrl.getClassics(band, q);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/shelf", requirePermission("library:read"), ctrl.getShelf);
router.post("/import", requirePermission("library:manage"), ctrl.importBook);
router.patch("/shelf/:id", requirePermission("library:manage"), ctrl.updateShelf);
router.delete("/shelf/:id", requirePermission("library:manage"), ctrl.removeShelf);

router.get("/progress/:ref", requirePermission("library:read"), ctrl.getProgress);
router.put("/progress/:ref", requirePermission("library:read"), ctrl.saveProgress);

module.exports = router;