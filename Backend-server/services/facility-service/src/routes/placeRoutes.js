// Feature-neutral place search.
//
// The geocoder itself (services/geocoder.js) is a general service, not a
// transport feature — but it was only ever reachable under /api/transport, which
// made every other consumer depend on transport permissions it had no business
// needing. The branch form is the second consumer: a school admin locating a
// campus holds branches:write, and should not need transport:read to type an
// address.
//
// Both paths stay: /api/transport/places/* is unchanged (BusRoutes depends on
// it), and these aliases serve the same controller so there is one geocoder
// config, one throttle and one cache regardless of which feature asked.

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/transportController");
const {
  verifyToken,
  resolveTenant,
  requireTenant,
  requireAnyPermission,
  authorizeRoles,
} = require("../middleware/auth");

router.use(verifyToken, resolveTenant, requireTenant);

// Place search is only ever a form-filling convenience: it reveals nothing about
// the school beyond what the caller could already type. It is still held to
// staff-only so a student or parent cannot use the deployment as a free
// geocoding proxy, which is the same reason the transport copy is staff-gated.
const staffOnly = authorizeRoles("school_admin", "super_admin", "staff");

// Any one of these permissions means "the caller is allowed to look up a place".
// Branch writes and transport reads are unrelated feature sets, so requiring
// both would lock out legitimate users of either.
const maySearch = requireAnyPermission("branches:write", "branches:read", "transport:read");

router.get("/search", maySearch, staffOnly, ctrl.searchPlacesFor);
router.get("/reverse", maySearch, staffOnly, ctrl.reversePlaceFor);

module.exports = router;