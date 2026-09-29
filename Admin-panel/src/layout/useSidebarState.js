// Collapse / expand state for the MUI sidebar.
//
// Responsibilities kept out of the view layer:
//   * rail (short) vs panel (detailed) mode, persisted across reloads
//   * which nested groups are open, also persisted
//   * mobile drawer visibility
//   * auto-revealing the group that owns the current route
//
// A host app can lift any of this with the returned setters, or ignore the
// persistence entirely by passing `{ persist: false }`.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

export const COLLAPSE_STORAGE_KEY = "erp.sidebar.collapsed";
export const GROUPS_STORAGE_KEY = "erp.sidebar.openGroups";

function readCollapsed(fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function readOpenGroups(fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Strips query + hash so `/classes?view=list` and `/classes` match. */
export function routePath(to) {
  if (!to) return "";
  const s = String(to);
  const q = s.search(/[?#]/);
  return (q === -1 ? s : s.slice(0, q)).replace(/\/+$/, "") || "/";
}

/**
 * A leaf is active when the current pathname equals its path, or is nested
 * beneath it — but only on a segment boundary, so `/student` never lights up
 * for `/students`. `end: true` forces an exact match (used by dashboards).
 */
export function isRouteActive(to, pathname, end = false) {
  const target = routePath(to);
  const current = routePath(pathname);
  if (target === current) return true;
  if (end) return false;
  return current.startsWith(`${target}/`);
}

function collectGroupIds(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach((n) => collectGroupIds(n, acc));
    return acc;
  }
  if (node.id && Array.isArray(node.items)) acc.push(node.id);
  return acc;
}

/** Walks the nav tree and returns the id of the top-level group containing `pathname`. */
export function findOwningGroupId(nav, pathname) {
  for (const group of nav || []) {
    if (!group?.items) continue;
    for (const item of group.items) {
      const paths = [item.to, ...(item.children || []).map((c) => c.to)];
      if (paths.some((p) => p && isRouteActive(p, pathname))) return group.id;
    }
  }
  return null;
}

export default function useSidebarState({
  nav = [],
  defaultCollapsed = false,
  persist = true,
  isMobile = false,
} = {}) {
  const [collapsed, setCollapsed] = useState(() =>
    isMobile ? false : readCollapsed(defaultCollapsed),
  );
  const [openGroupIds, setOpenGroupIds] = useState(() =>
    readOpenGroups(collectGroupIds(nav)),
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const validGroupIds = useMemo(() => new Set(collectGroupIds(nav)), [nav]);

  // Derived rather than synced: if the nav tree changes (e.g. permissions
  // change on role switch) we simply ignore ids that no longer exist.
  const validOpenGroupIds = useMemo(
    () => openGroupIds.filter((id) => validGroupIds.has(id)),
    [openGroupIds, validGroupIds],
  );

  // The rail is a desktop affordance only — on mobile the drawer is always
  // the full panel, so this is derived instead of pushed through an effect.
  const railCollapsed = !isMobile && collapsed;

  useEffect(() => {
    if (!persist || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage full or blocked — collapse state stays in memory */
    }
  }, [collapsed, persist]);

  useEffect(() => {
    if (!persist || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        GROUPS_STORAGE_KEY,
        JSON.stringify(validOpenGroupIds),
      );
    } catch {
      /* ignore */
    }
  }, [validOpenGroupIds, persist]);

  const toggleCollapsed = useCallback(() => {
    if (isMobile) return;
    setCollapsed((c) => !c);
  }, [isMobile]);
  const expand = useCallback(() => setCollapsed(false), []);
  const collapse = useCallback(() => setCollapsed(true), []);

  const isGroupOpen = useCallback(
    (id) => validOpenGroupIds.includes(id),
    [validOpenGroupIds],
  );

  const toggleGroup = useCallback((id) => {
    setOpenGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }, []);

  const openGroup = useCallback((id) => {
    setOpenGroupIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const closeGroup = useCallback((id) => {
    setOpenGroupIds((prev) => prev.filter((g) => g !== id));
  }, []);

  const openAllGroups = useCallback(() => {
    setOpenGroupIds([...validGroupIds]);
  }, [validGroupIds]);

  const closeAllGroups = useCallback(() => setOpenGroupIds([]), []);

  const reset = useCallback(() => {
    setCollapsed(defaultCollapsed);
    setOpenGroupIds(collectGroupIds(nav));
  }, [defaultCollapsed, nav]);

  const activeGroupId = useMemo(
    () => findOwningGroupId(nav, location.pathname),
    [nav, location.pathname],
  );

  return {
    collapsed: railCollapsed,
    isCollapsed: railCollapsed,
    isMobile,
    mobileOpen,
    activeGroupId,
    openGroupIds: validOpenGroupIds,
    isGroupOpen,
    toggleGroup,
    openGroup,
    closeGroup,
    openAllGroups,
    closeAllGroups,
    setCollapsed,
    toggleCollapsed,
    expand,
    collapse,
    setMobileOpen,
    closeMobile: useCallback(() => setMobileOpen(false), []),
    reset,
  };
}
