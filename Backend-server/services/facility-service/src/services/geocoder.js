// Place search (geocoding) for the route planner.
//
// Geocoding answers "where is this street/landmark" — a completely different job
// from OSRM (shared/src/utils/osrm.js), which answers "how do I drive between
// two known points". Stop picking on the map needs the former, so it lives here.
//
// Everything is server-side on purpose: the browser never talks to the geocoder
// directly, so provider credentials stay in the backend env and the provider's
// usage policy is enforced in one place (per-IP rate limit + cache) instead of
// once per open tab.
//
// Provider is abstracted via GEOCODER_PROVIDER so a self-hosted Photon/other
// instance can be swapped in without touching callers.

const PROVIDER = (process.env.GEOCODER_PROVIDER || "nominatim").toLowerCase();

const TIMEOUT_MS = Number(process.env.GEOCODER_TIMEOUT_MS || 8000);
const MAX_RESULTS = Number(process.env.GEOCODER_MAX_RESULTS || 8);

// Nominatim's public instance allows at most 1 request/second per app and
// requires a real identifying User-Agent. Both are enforced here so a burst of
// keystrokes from the planner can never trip the policy.
//
// Google is not rate-limited per-second the same way — it bills against a
// per-minute quota and its own SDK guidance is to debounce, not to serialise at
// 1.1s. Holding every lookup behind that gate made typing feel broken, so Google
// gets no inter-call delay and relies on the caller's debounce instead.
const MIN_INTERVAL_MS =
  PROVIDER === "nominatim"
    ? Number(process.env.GEOCODER_MIN_INTERVAL_MS || 1100)
    : 0;
const CACHE_TTL_MS = Number(process.env.GEOCODER_CACHE_TTL_MS || 15 * 60 * 1000);
const CACHE_MAX = 500;

// Nominatim needs an identifying UA; browsers cannot set one, which is another
// reason the search is proxied through the backend.
const USER_AGENT =
  process.env.GEOCODER_USER_AGENT ||
  "ZipschoolOS/1.0 (school transport route planner; contact: admin@school.example)";

const NOMINATIM_URL = (process.env.GEOCODER_NOMINATIM_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
const PHOTON_URL = (process.env.GEOCODER_PHOTON_URL || "https://photon.komoot.io").replace(/\/+$/, "");
const GOOGLE_PLACES_URL = (process.env.GOOGLE_PLACES_URL || "https://places.googleapis.com/v1").replace(/\/+$/, "");
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// addressdetails=1 so Nominatim/Photon rows carry the structured parts the branch
// form needs to fill City/State/PIN. Without it the caller only gets a label and
// would have to re-derive the address it was trying to avoid typing.
const NOMINATIM_ADDRESS_DETAILS = process.env.GEOCODER_ADDRESS_DETAILS === "off" ? 0 : 1;

const PROVIDERS = {
  nominatim: {
    attribution: "© OpenStreetMap contributors (Nominatim)",
    searchUrl: (q) =>
      `${NOMINATIM_URL}/search?format=jsonv2&addressdetails=${NOMINATIM_ADDRESS_DETAILS}&limit=${MAX_RESULTS}&q=${encodeURIComponent(q)}`,
    reverseUrl: (lat, lng) =>
      `${NOMINATIM_URL}/reverse?format=jsonv2&zoom=18&addressdetails=${NOMINATIM_ADDRESS_DETAILS}&lat=${lat}&lon=${lng}`,
  },
  photon: {
    attribution: "© OpenStreetMap contributors (Photon)",
    searchUrl: (q) => `${PHOTON_URL}/api/?limit=${MAX_RESULTS}&q=${encodeURIComponent(q)}`,
    reverseUrl: (lat, lng) => `${PHOTON_URL}/reverse?lat=${lat}&lon=${lng}`,
  },
  // Google Places (New). Chosen when OpenStreetMap's data is too thin for the
  // job — OSM has no entry for plenty of individual schools, so a search for a
  // specific campus returns nothing. Google's business/place coverage is the
  // reason this provider exists; see normalizeGoogle for the shape mapping.
  google: {
    attribution: "Powered by Google",
    searchUrl: (q) =>
      `${GOOGLE_PLACES_URL}/places:searchText?textQuery=${encodeURIComponent(q)}&language=${encodeURIComponent(process.env.GEOCODER_LANGUAGE || "en")}`,
    reverseUrl: (lat, lng) =>
      `${GOOGLE_PLACES_URL}/places:geocode?lat=${lat}&lng=${lng}`,
    headers: () => ({
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.types",
    }),
  },
};

const provider = () => PROVIDERS[PROVIDER] || PROVIDERS.nominatim;

// ---------------------------------------------------------------------------
// Cache + throttle
// ---------------------------------------------------------------------------

const cache = new Map();
let chain = Promise.resolve();
let lastCallAt = 0;

const cacheKey = (q) => `${PROVIDER}:${q.trim().toLowerCase()}`;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU recency.
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Serialise every outbound geocoder call and keep at least MIN_INTERVAL_MS
 * between them. Concurrent planner keystrokes therefore queue instead of
 * firing in parallel and tripping the provider's rate limit.
 */
function throttle(task) {
  const run = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return task();
  });
  // Keep the chain alive even when one lookup rejects.
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Every row carries the same `address` block so a caller can fill a form's
// City/State/PIN without parsing the human label itself. Missing parts stay ""
// rather than null so the client can bind them straight into inputs.
const emptyAddress = () => ({ street: "", city: "", state: "", pincode: "" });

// ---------------------------------------------------------------------------
// Normalisation — every provider collapses to the same shape so the planner UI
// never branches on which provider is configured.
// ---------------------------------------------------------------------------

function normalizeNominatim(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const lat = num(r.lat);
      const lng = num(r.lon);
      if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      const a = r.address || {};
      return {
        id: r.osm_id ? `osm:${r.osm_type}:${r.osm_id}` : `n:${r.place_id ?? r.display_name}`,
        label: r.display_name || r.name || "",
        lat,
        lng,
        kind: r.type || r.category || r.addresstype || "place",
        address: {
          ...emptyAddress(),
          street: [a.house_number, a.road].filter(Boolean).join(" ") || a.road || a.suburb || "",
          city: a.city || a.town || a.village || a.county || "",
          state: a.state || "",
          pincode: a.postcode || "",
        },
      };
    })
    .filter((r) => r && r.label);
}

function normalizePhoton(rows) {
  const list = Array.isArray(rows?.features) ? rows.features : [];
  return list
    .map((f) => {
      const lat = num(f?.geometry?.coordinates?.[1]);
      const lng = num(f?.geometry?.coordinates?.[0]);
      if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      const props = f.properties || {};
      const label =
        [props.name, props.street, props.housenumber, props.city, props.postcode]
          .filter(Boolean)
          .join(", ") || f.properties?.name || "";
      return {
        id: `photon:${f.properties?.osm_type ?? ""}:${f.properties?.osm_id ?? label}`,
        label,
        lat,
        lng,
        kind: props.type || props.osm_key || "place",
        address: {
          ...emptyAddress(),
          street: [props.housenumber, props.street].filter(Boolean).join(" ") || "",
          city: props.city || props.district || props.county || "",
          state: props.state || "",
          pincode: props.postcode || "",
        },
      };
    })
    .filter((r) => r && r.label);
}

// Places API (New) `addressComponents` is an array of typed parts rather than a
// keyed object, so each field is found by type. `longText` is preferred over
// `shortText` because a form should show "Madhya Pradesh", not "MP".
function googleComponent(components, type) {
  const hit = (Array.isArray(components) ? components : []).find(
    (c) => Array.isArray(c?.types) && c.types.includes(type),
  );
  if (!hit) return "";
  return hit.longText || hit.shortText || "";
}

function normalizeGoogle(payload) {
  const list = Array.isArray(payload?.places) ? payload.places : [];
  return list
    .map((p) => {
      const lat = num(p?.location?.latitude);
      const lng = num(p?.location?.longitude);
      if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      const comps = p.addressComponents;
      const name = p.displayName?.text || "";
      const formatted = p.formattedAddress || "";
      // Prefer the business/school name, fall back to the full address so a
      // result is never reduced to an empty label.
      const label = formatted ? `${name}, ${formatted}` : name;
      if (!label) return null;
      const streetNumber = googleComponent(comps, "street_number");
      const route = googleComponent(comps, "route");
      return {
        id: p.id ? `g:${p.id}` : `g:${label}`,
        label,
        lat,
        lng,
        kind: Array.isArray(p.types) && p.types.length ? p.types[0] : "place",
        address: {
          ...emptyAddress(),
          street: [streetNumber, route].filter(Boolean).join(" ") || route || formatted,
          // Some localities come back as postal_town / sublocality rather than
          // locality, so all three are candidates for "City".
          city:
            googleComponent(comps, "locality") ||
            googleComponent(comps, "postal_town") ||
            googleComponent(comps, "sublocality") ||
            googleComponent(comps, "administrative_area_level_2"),
          state: googleComponent(comps, "administrative_area_level_1"),
          pincode: googleComponent(comps, "postal_code"),
        },
      };
    })
    .filter(Boolean);
}

// One dispatch point instead of a ternary chain in each caller, so adding a
// provider means touching this map and nothing else.
const NORMALIZERS = {
  nominatim: normalizeNominatim,
  photon: normalizePhoton,
  google: (payload) => normalizeGoogle(payload),
};

const normalize = (payload) => {
  const fn = NORMALIZERS[PROVIDER] || NORMALIZERS.nominatim;
  return fn(payload);
};

async function fetchJson(url, { headers = {} } = {}) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...headers },
  });
  if (!res.ok) throw new Error(`geocoder http ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Opt-in, same as the GPS provider: a deployment that has not chosen a geocoder
// must not quietly push its traffic to somebody else's public instance.
const ENABLED = () => process.env.GEOCODER_ENABLED === "true";

// Nominatim's usage policy requires an identifying User-Agent carrying a real
// contact address. The shipped placeholder is fine for local development but
// must not reach the public service, so a public instance is only used once a
// real contact has been configured.
const PUBLIC_NOMINATIM = /^https:\/\/(nominatim\.openstreetmap\.org|nominatim\.openstreetmap\.de)/i;
const PLACEHOLDER_CONTACT = /example|changeme|your[-_ ]?(email|contact)|admin@/i;
const hasRealContact = () => /@/.test(USER_AGENT) && !PLACEHOLDER_CONTACT.test(USER_AGENT);
const onPublicInstance = () => PUBLIC_NOMINATIM.test(NOMINATIM_URL);
const hasGoogleKey = () => GOOGLE_API_KEY.trim().length >= 20;

// A provider is only usable when it is switched on *and* it has everything it
// needs to answer. Google needs no contact policy but does need a key, and
// without one every call would 403 — the same silently-empty outcome as an
// unconfigured deployment, so it is gated the same way.
const usable = () => {
  if (!ENABLED()) return false;
  if (PROVIDER === "google") return hasGoogleKey();
  return !onPublicInstance() || hasRealContact();
};

/** Why the provider is unusable — surfaced through geocoderStatus() so a
 *  deployment can tell "switched off" apart from "switched on but unconfigured". */
const unusableReason = () => {
  if (!ENABLED()) return "disabled";
  if (PROVIDER === "google") return hasGoogleKey() ? null : "missing GOOGLE_PLACES_API_KEY";
  if (onPublicInstance() && !hasRealContact()) return "missing real GEOCODER_USER_AGENT contact";
  return null;
};

/**
 * Free-text place search. Resolves { results, attribution } — `results` is
 * empty (never throws) when the provider is unreachable, so the planner can
 * still accept manually-placed stops.
 */
async function searchPlaces(query) {
  const q = String(query || "").trim();
  if (q.length < 3) return { results: [], attribution: provider().attribution };
  if (!usable()) {
    return {
      results: [],
      attribution: provider().attribution,
      disabled: true,
      reason: unusableReason(),
    };
  }

  const key = cacheKey(q);
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  try {
    const body = await throttle(() =>
      fetchJson(provider().searchUrl(q), { headers: provider().headers?.() }),
    );
    const deduped = [];
    for (const r of normalize(body)) {
      if (!deduped.some((o) => o.label === r.label && o.lat === r.lat && o.lng === r.lng)) {
        deduped.push(r);
      }
    }
    const results = deduped.slice(0, MAX_RESULTS);
    const value = { results, attribution: provider().attribution };
    cacheSet(key, value);
    return value;
  } catch {
    return { results: [], attribution: provider().attribution };
  }
}

/** Reverse-geocode a dropped map pin into a human label (best effort). */
async function reversePlace(lat, lng) {
  if (!usable()) return null;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) return null;
  try {
    const body = await throttle(() =>
      fetchJson(provider().reverseUrl(Number(lat), Number(lng)), {
        headers: provider().headers?.(),
      }),
    );
    // Nominatim's /reverse returns one object; searchText/geocode return a list.
    const rows = PROVIDER === "nominatim" ? normalizeNominatim([body]) : normalize(body);
    return rows[0] || null;
  } catch {
    return null;
  }
}

function geocoderStatus() {
  return {
    provider: PROVIDER,
    enabled: usable(),
    configured: ENABLED(),
    // A deployment that switched the provider on but left it unconfigured gets
    // a reason instead of a silent empty dropdown.
    unusableReason: unusableReason(),
    publicInstance: onPublicInstance(),
    contactConfigured: hasRealContact(),
    apiKeyConfigured: PROVIDER === "google" ? hasGoogleKey() : undefined,
    attribution: provider().attribution,
    cachedEntries: cache.size,
    minIntervalMs: MIN_INTERVAL_MS,
  };
}

module.exports = { searchPlaces, reversePlace, geocoderStatus, GEOCODER_PROVIDER: PROVIDER };