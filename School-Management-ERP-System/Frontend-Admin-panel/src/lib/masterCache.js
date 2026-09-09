// Module-level cache for master dropdown lists (keyed by master kind), shared
// across MasterSelect instances so opening the same form repeatedly does not
// re-fetch. Exposed invalidation lets callers refresh after creating a custom
// value so it appears on the next open.
const cache = new Map();

export function getMasterCache(kind) {
  return cache.get(kind);
}

export function setMasterCache(kind, rows) {
  cache.set(kind, rows);
}

export function invalidateMasterCache(kind) {
  if (kind) cache.delete(kind);
  else cache.clear();
}
