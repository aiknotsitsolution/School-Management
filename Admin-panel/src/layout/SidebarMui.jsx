// Enterprise sidebar navigation (MUI v9).
//
// Dual-mode rail: the detailed panel shows grouped categories, labels, nested
// sub-menus and badges; the short rail collapses to an icon-only strip that
// previews labels and sub-items through interactive tooltips.
//
// Designed to drop in beside the existing Tailwind shell — the running app is
// untouched until you swap the import in `layout/Layout.jsx`:
//
//   <SidebarMui
//     nav={nav}
//     brand={{ name: school?.name, code: school?.code, logo: school?.logoUrl }}
//     schoolName={school?.name}
//     session={sessionLabel(school)}
//     canSee={(item) => hasPermission(user, item.permission)}
//     open={mobileOpen} onClose={() => setMobileOpen(false)}
//   />
//
// Wrap it in the matching theme so the rail keeps its palette:
//
//   <ThemeProvider theme={sidebarTheme}>…</ThemeProvider>
//
// The component is declarative: hand it a nav tree plus a `canSee` predicate
// and it renders, filters, persists and remembers everything else.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { alpha, useTheme } from "@mui/material/styles";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import useSidebarState, { isRouteActive } from "./useSidebarState";
import { prefetchRoute } from "../lib/routeLoaders";
import { BRAND, DURATION, EASING, SB, SIDEBAR_TOKENS, SIDEBAR_TYPE, softPrimary } from "./sidebarTheme";
import PageArtwork from "../components/PageArtwork";

const {
  expandedWidth,
  collapsedWidth,
  itemHeight,
  nestedItemHeight,
  groupHeaderPadY,
  groupHeaderHeight,
  groupHeaderGap,
  groupGap,
  listTopPad,
  listBottomPad,
  railIcon,
  radius,
  searchPadY,
  searchHeight,
} = SIDEBAR_TOKENS;

const { label: labelSize, labelNested, groupHeader, icon: iconSize, iconNested, groupHeaderIcon } = SIDEBAR_TYPE;

const allowAll = () => true;

const TONE_PALETTE = {
  primary: "primary",
  warning: "warning",
  alert: "error",
  success: "success",
  info: "info",
};

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const scrollbarSx = {
  scrollbarWidth: "thin",
  scrollbarColor: `${SB.slate300} transparent`,
  "&::-webkit-scrollbar": { width: 6 },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: SB.slate300,
    borderRadius: 999,
  },
  "&::-webkit-scrollbar-thumb:hover": { backgroundColor: SB.slate500 },
};

const fadeTransition = {
  transition: { timeout: DURATION.fast, easing: EASING.standard },
  arrow: { sx: { color: SB.slate900 } },
};

/* ── Badge ───────────────────────────────────────────────────────────────── */

function BadgePill({ count, tone = "primary" }) {
  const paletteKey = TONE_PALETTE[tone] || "primary";
  return (
    <Box
      component="span"
      sx={{
        minWidth: 22,
        height: 22,
        px: 0.6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        bgcolor: (t) => alpha(t.palette[paletteKey].main, 0.14),
        color: (t) => t.palette[paletteKey].main,
        fontSize: 12,
        fontWeight: 750,
        lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {count}
    </Box>
  );
}

function NavBadge({ badge }) {
  if (badge == null || badge === false) return null;
  if (typeof badge === "object" && "count" in badge) {
    if (!badge.count) return null;
    return <BadgePill count={badge.count} tone={badge.tone} />;
  }
  return <BadgePill count={badge} />;
}

/* ── Item styling ────────────────────────────────────────────────────────── */

/* Active indicator: a fixed-height pill pinned to the leading edge that scales
   up when selected. Fixed top/bottom offsets (rather than a centred translate)
   keep the bar the same length on every row regardless of item height, which is
   what makes it read as a rail rather than a per-item decoration. */
const activeRailSx = {
  "&::before": {
    content: '""',
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 4,
    borderRadius: "0 4px 4px 0",
bgcolor: SB.primary,
      opacity: 0,
    transform: "scaleY(0.35)",
    transformOrigin: "center",
    transition: (t) =>
      t.transitions.create(["opacity", "transform"], {
        duration: DURATION.normal,
        easing: EASING.emphasized,
      }),
  },
  "&.Mui-selected::before": { opacity: 1, transform: "scaleY(1)" },
};

const itemRootSx = (selected) => ({
  position: "relative",
  minHeight: itemHeight,
  borderRadius: `${radius}px`,
  pl: 1.5,
  pr: 1.5,
  color: selected ? SB.slate900 : SB.slate500,
  bgcolor: selected ? softPrimary(0.14) : "transparent",
  // A hairline keeps the active wash from bleeding into a white rail.
  boxShadow: selected ? `inset 0 0 0 1px ${alpha(BRAND.main, 0.16)}` : "none",
  overflow: "hidden",
  // Nudge + lift make the row feel pressable. The transition list is explicit
  // so the transform is not cut short when a row is also being selected.
  transition: (t) =>
    t.transitions.create(
      ["background-color", "color", "box-shadow", "transform"],
      { duration: DURATION.fast, easing: EASING.standard },
    ),
  "&:hover": {
    // Hover tints toward the brand rather than plain grey, so an unselected row
    // previews the colour the active state will take.
    bgcolor: selected ? softPrimary(0.2) : softPrimary(0.07),
    color: selected ? SB.slate900 : SB.slate900,
    "& .nav-icon": { color: selected ? SB.primary : SB.slate700 },
  },
  "&:active": {
    // Press feedback: the row settles back toward its resting position.
    transform: "translateX(3px) scale(0.985)",
    bgcolor: selected ? softPrimary(0.22) : softPrimary(0.11),
    transitionDuration: "60ms",
  },
  "&.Mui-focusVisible": {
    boxShadow: `0 0 0 3px ${alpha(BRAND.main, 0.28)}`,
  },
  ...activeRailSx,
});

const iconSx = (selected, nested = false) => ({
  minWidth: 0,
  color: "inherit",
  // Width/height are set alongside `fontSize` so this works with MUI SvgIcons
  // and with lucide-react icons, which size via attributes instead of em.
  "& .nav-icon": {
    fontSize: nested ? iconNested : iconSize,
    width: nested ? iconNested : iconSize,
    height: nested ? iconNested : iconSize,
    display: "block",
    flexShrink: 0,
color: selected ? SB.primary : "currentColor",
      filter: selected ? `drop-shadow(0 0 7px ${alpha(BRAND.main, 0.5)})` : "none",
    // A small lift on hover/press, so the icon leads the interaction instead of
    // only the row background changing.
    transform: "scale(1)",
    transition: (t) =>
      t.transitions.create(["color", "filter", "transform"], {
        duration: DURATION.normal,
        easing: EASING.standard,
      }),
  },
  "&:hover .nav-icon": { transform: "scale(1.12)" },
  "&:active .nav-icon": { transform: "scale(0.95)" },
});

/* ── Rail tooltip: label + sub-items ─────────────────────────────────────── */

function RailSubItem({ to, label, badge }) {
  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        textDecoration: "none",
        color: alpha("#E2E8F0", 0.88),
        fontSize: labelNested,
        fontWeight: 600,
        transition: (t) =>
          t.transitions.create(["background-color", "color"], {
            duration: DURATION.fastest,
          }),
        "&:hover": { bgcolor: alpha("#FFFFFF", 0.1), color: "#FFFFFF" },
      }}
    >
      <Box
        component="span"
        sx={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          bgcolor: alpha("#FFFFFF", 0.35),
          flexShrink: 0,
        }}
      />
      <Box component="span" sx={{ flex: 1 }}>
        {label}
      </Box>
      {badge != null ? <NavBadge badge={badge} /> : null}
    </Box>
  );
}

function RailTooltip({ label, badge, children, anchor }) {
  const [onAnchor, setOnAnchor] = useState(false);
  const [onTip, setOnTip] = useState(false);

  const title = (
    <Box sx={{ px: 1, py: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#F8FAFC" }}>
          {label}
        </Typography>
        <NavBadge badge={badge} />
      </Box>

      {children ? (
        <Box
          component="nav"
          aria-label={`${label} sub-items`}
          sx={{
            mt: 0.75,
            pt: 0.75,
            borderTop: `1px solid ${alpha("#FFFFFF", 0.14)}`,
            display: "flex",
            flexDirection: "column",
            gap: 0.25,
          }}
        >
          {children}
        </Box>
      ) : null}
    </Box>
  );

  return (
    <Tooltip
      title={title}
      open={onAnchor || onTip}
      onOpen={() => setOnAnchor(true)}
      onClose={() => setOnAnchor(false)}
      placement="right"
      enterDelay={120}
      leaveDelay={120}
      slotProps={{
        tooltip: {
          onMouseEnter: () => setOnTip(true),
          onMouseLeave: () => setOnTip(false),
          sx: { p: 0.75, maxWidth: 264 },
        },
        ...fadeTransition,
      }}
    >
      {anchor}
    </Tooltip>
  );
}

/* ── Navigation item ─────────────────────────────────────────────────────── */

function NavItem({
  item,
  pathname,
  depth = 0,
  collapsed,
  selected,
  expanded,
  onToggleExpand,
  onNavigate,
}) {
  const hasChildren = (item.children?.length || 0) > 0;
  const isNested = depth > 0;
  const Icon = item.icon;

  const itemProps = {
    selected,
    "aria-current": selected ? "page" : undefined,
    "data-active": selected ? "true" : undefined,
    sx: {
      ...itemRootSx(selected),
      ...(isNested
        ? {
            minHeight: nestedItemHeight,
            pl: 0.75,
            // Tree guide, aligned to the nested label's left edge (icon box
            // ends at ~35px with the roomy type scale) rather than the old
            // 20px, where it disappeared behind the larger icon it used to sit
            // under.
            "&::after": {
              content: '""',
              position: "absolute",
              left: 37,
              top: 0,
              bottom: 0,
              width: 1,
              bgcolor: SB.slate200,
            },
          }
        : null),
      ...(collapsed
        ? {
            width: railIcon,
            minHeight: railIcon,
            mx: "auto",
            pl: 0,
            pr: 0,
            justifyContent: "center",
          }
        : null),
    },
  };

  const button = (
    <ListItemButton
      component={RouterLink}
      to={item.to}
      {...itemProps}
      // Warm the route's chunk while the pointer is still travelling to it.
      // Navigation runs inside React Router's startTransition, which holds the
      // old page until the new one is ready; with the chunk already fetched the
      // swap lands in a frame instead of after the import. Duplicate calls are
      // free — the module cache absorbs them.
      onMouseEnter={() => prefetchRoute(item.to)}
      onFocus={() => prefetchRoute(item.to)}
      onClick={() => onNavigate?.(item)}
      aria-label={collapsed ? item.label : undefined}
      secondaryAction={
        collapsed || (!hasChildren && item.badge == null) ? null : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {item.badge != null ? <NavBadge badge={item.badge} /> : null}

            {hasChildren ? (
              <IconButton
                size="small"
                edge="end"
                tabIndex={-1}
                aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleExpand?.();
                }}
                sx={{
                  width: 28,
                  height: 28,
                  color: "text.secondary",
                  transition: (t) =>
                    t.transitions.create("transform", {
                      duration: DURATION.normal,
                      easing: EASING.emphasized,
                    }),
                  transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              >
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 20 }} />
              </IconButton>
            ) : null}
          </Box>
        )
      }
    >
      {Icon ? (
        <ListItemIcon
          sx={{
            ...iconSx(selected, isNested),
            pl: collapsed ? 0 : 0.5,
            pr: collapsed ? 0 : 0.75,
          }}
        >
          <Icon className="nav-icon" />
        </ListItemIcon>
      ) : null}

      {collapsed ? null : (
        <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              sx: {
                fontSize: isNested ? labelNested : labelSize,
                fontWeight: selected ? 700 : 550,
                lineHeight: 1.35,
                color: "inherit",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            },
          }}
        />
      )}

      {collapsed && item.badge != null ? (
        <Box
          sx={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "error.main",
            border: `2px solid ${SB.slate900}`,
            boxShadow: selected ? `0 0 0 2px ${alpha(BRAND.main, 0.35)}` : "none",
          }}
        />
      ) : null}

    </ListItemButton>
  );

  if (collapsed) {
    return (
      <RailTooltip label={item.label} badge={item.badge} anchor={button}>
        {hasChildren
          ? item.children.map((child) => (
              <RailSubItem
                key={`${child.to}-${child.label}`}
                to={child.to}
                label={child.label}
                badge={child.badge}
              />
            ))
          : null}
      </RailTooltip>
    );
  }

  return (
    <>
      {button}

      {hasChildren ? (
        <Collapse
          component="li"
          in={expanded}
          timeout={DURATION.normal}
          easing={EASING.standard}
          unmountOnExit
        >
          <List disablePadding dense>
            {item.children.map((child) => (
              <NavItem
                key={`${child.to}-${child.label}`}
                item={child}
                pathname={pathname}
                depth={depth + 1}
                collapsed={false}
                selected={isRouteActive(child.to, pathname, child.end)}
                expanded={false}
                onToggleExpand={() => {}}
                onNavigate={onNavigate}
              />
            ))}
          </List>
        </Collapse>
      ) : null}
    </>
  );
}

/* ── Group header ────────────────────────────────────────────────────────── */

function GroupHeader({ group, collapsed }) {
  const GroupIcon = group.icon;

  if (collapsed) {
    return (
      <Tooltip
        title={group.header}
        placement="right"
        slotProps={fadeTransition}
      >
        <Box
          sx={{
            px: 0,
            py: `${groupHeaderPadY}px`,
            mb: `${groupHeaderGap}px`,
            minHeight: groupHeaderHeight,
            display: "grid",
            placeItems: "center",
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              left: 14,
              right: 14,
              bottom: 5,
              height: 1,
              bgcolor: SB.slate200,
            },
          }}
        >
          {GroupIcon ? (
            <Box
              component={GroupIcon}
              className="nav-icon"
              sx={{
                fontSize: groupHeaderIcon,
                width: groupHeaderIcon,
                height: groupHeaderIcon,
                opacity: 0.5,
                color: SB.slate500,
              }}
            />
          ) : null}
        </Box>
      </Tooltip>
    );
  }

  // Rendered outside the <List>, so this is a plain Box rather than a
  // ListSubheader (an <li> would be orphaned outside its <ul>).
  return (
    <Box
      sx={{
        px: 2,
        py: `${groupHeaderPadY}px`,
        mb: `${groupHeaderGap}px`,
        minHeight: groupHeaderHeight,
        display: "flex",
        alignItems: "center",
        color: SB.slate500,
        fontSize: groupHeader,
        fontWeight: 800,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
      }}
    >
      {group.header}
    </Box>
  );
}

/* ── Brand + user blocks ─────────────────────────────────────────────────── */

function BrandMark({ brand }) {
  return (
    <Box
      sx={{
        width: 46,
        height: 46,
        flexShrink: 0,
        borderRadius: 2.5,
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(135deg, #0C47CF 0%, #7C3AED 55%, #DB2777 100%)",
        color: "#fff",
        fontWeight: 800,
        fontSize: 16,
        letterSpacing: "-0.02em",
        boxShadow: `0 10px 22px -12px ${alpha(BRAND.main, 0.9)}`,
        overflow: "hidden",
      }}
    >
      {brand?.logo ? (
        <Box
          component="img"
          src={brand.logo}
          alt=""
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initialsOf(brand?.name || "School")
      )}
    </Box>
  );
}

/** A page motif bled off the edge of a sidebar block. Purely decorative, so it
 *  is hidden from assistive tech and never intercepts clicks. */
function SidebarDecor({ name, opacity = 0.08, width = 190, top, bottom, right = -46, tone }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        top,
        bottom,
        right,
        width,
        height: "100%",
        opacity,
        pointerEvents: "none",
        overflow: "hidden",
        display: { xs: "none", md: "block" },
      }}
    >
      <PageArtwork name={name} className={`block h-full w-full ${tone || ""}`} />
    </Box>
  );
}

function BrandBlock({ brand, collapsed }) {
  if (collapsed) {
    return (
      <Tooltip title={brand?.name || "School"} placement="right" slotProps={fadeTransition}>
        <Box sx={{ display: "grid", placeItems: "center" }}>
          <BrandMark brand={brand} />
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
      <BrandMark brand={brand} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          sx={{
            fontSize: 15.5,
            fontWeight: 750,
            lineHeight: 1.2,
            color: SB.slate900,
            letterSpacing: "-0.015em",
          }}
        >
          {brand?.name || "Your School"}
        </Typography>
        <Typography
          noWrap
          sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25, fontWeight: 550 }}
        >
          {brand?.code || brand?.session || "School ERP"}
        </Typography>
      </Box>
    </Box>
  );
}

function SchoolSessionBlock({ schoolName, session, collapsed }) {
  const title = schoolName || "Your School";
  const sessionText = session || "No active session";

  if (collapsed) {
    return (
      <Tooltip
        title={`${title} - Session ${sessionText}`}
        placement="right"
        slotProps={fadeTransition}
      >
        <Box sx={{ display: "grid", placeItems: "center" }}>
          <SchoolRoundedIcon sx={{ fontSize: 21, color: "text.secondary" }} />
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        minWidth: 0,
        px: 1.25,
        py: 1.15,
        borderRadius: 2.5,
        overflow: "hidden",
        // Artwork instead of a border + fill: the motif bleeds off the right
        // edge and the text sits straight on the paper, so the block is
        // distinguished by the drawing rather than a box around it.
      }}
    >
      <PageArtwork
        name="people"
        className="pointer-events-none absolute right-0 top-0 h-full w-[58%] text-primary opacity-[0.18]"
      />

      <Box
        sx={{
          position: "relative",
          width: 34,
          height: 34,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          color: "primary.dark",
        }}
      >
        <SchoolRoundedIcon sx={{ fontSize: 21 }} />
      </Box>

      <Box sx={{ position: "relative", minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          sx={{ fontSize: 13, fontWeight: 700, color: SB.slate900, lineHeight: 1.25 }}
        >
          {title}
        </Typography>
        <Typography
          noWrap
          sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.2, fontWeight: 550 }}
        >
          Session {sessionText}
        </Typography>
      </Box>
    </Box>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

export default function SidebarMui({
  nav = [],
  brand = {},
  schoolName = "",
  session = "",
  // The school/session footer only means something for a school-bound user.
  // A platform owner has no tenant, so there is nothing honest to print — they
  // get the footer toggle only, rather than placeholder text.
  showSchoolSession = true,
  canSee = allowAll,
  open: openProp,
  onClose,
  onToggle,
  defaultCollapsed = false,
  persist = true,
  width = expandedWidth,
  railWidth = collapsedWidth,
  showFooterToggle = true,
  keyboardShortcut = true,
  mobileBreakpoint = "lg",
  ...drawerProps
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(mobileBreakpoint));
  const location = useLocation();
  const scrollRef = useRef(null);

  // Accepts either the MUI shape (`{ id, header, items }`) or the shape the
  // existing app nav already uses (`{ label, items }`).
  const normalized = useMemo(
    () =>
      nav.map((group, index) => ({
        ...group,
        id: group.id || group.header || group.label || `group-${index}`,
        header: group.header || group.label,
        items: group.items || [],
      })),
    [nav],
  );

  const state = useSidebarState({ nav: normalized, defaultCollapsed, persist, isMobile });
  const { collapsed, isGroupOpen, toggleGroup, setMobileOpen, toggleCollapsed } = state;

  const filtered = useMemo(
    () =>
      normalized
        .map((group) => ({ ...group, items: group.items.filter(canSee) }))
        .filter((group) => group.items.length > 0),
    [normalized, canSee],
  );

  // Client-side label filter. A parent whose own label misses but whose children
  // hit is kept with the matching children only, so a search never hides a
  // reachable route behind a collapsed parent.
  const [query, setQuery] = useState("");

  // Collapsing hides the input, so honouring a live query would silently filter
  // the icon rail with no visible control to clear it. Derived rather than reset
  // in an effect, so the typed text survives expand/collapse.
  const effectiveQuery = collapsed ? "" : query;

  const visible = useMemo(() => {
    const q = effectiveQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered
      .map((group) => ({
        ...group,
        items: group.items
          .map((item) => {
            if (item.label?.toLowerCase().includes(q)) return item;
            const kids = (item.children || []).filter((c) =>
              c.label?.toLowerCase().includes(q),
            );
            return kids.length ? { ...item, children: kids } : null;
          })
          .filter(Boolean),
      }))
      .filter((group) => group.items.length > 0);
  }, [filtered, effectiveQuery]);

  useEffect(() => {
    if (!state.activeGroupId) return undefined;
    const id = window.setTimeout(() => {
      scrollRef.current
        ?.querySelector("[data-active='true']")
        ?.scrollIntoView({ block: "nearest" });
    }, 140);
    return () => window.clearTimeout(id);
  }, [state.activeGroupId]);

  useEffect(() => {
    if (!keyboardShortcut) return undefined;
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
        onToggle?.(!collapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, keyboardShortcut, onToggle, toggleCollapsed]);

  const isControlled = openProp !== undefined;
  const mobileOpen = isControlled ? openProp : state.mobileOpen;
  const closeMobile = useCallback(() => {
    if (!isControlled) setMobileOpen(false);
    onClose?.();
  }, [isControlled, onClose, setMobileOpen]);

  const handleNavigate = useCallback(() => closeMobile(), [closeMobile]);

  // The rail never prints: a printed page is the document, not the shell.
  return (
    <Drawer
      {...drawerProps}
      className="no-print"
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? mobileOpen : true}
      onClose={closeMobile}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: { md: collapsed ? railWidth : width },
        flexShrink: 0,
        transition: (t) =>
          t.transitions.create("width", {
            duration: DURATION.rail,
            easing: EASING.emphasized,
          }),
        "& .MuiDrawer-paper": {
          width: isMobile ? Math.min(width, 320) : collapsed ? railWidth : width,
          boxSizing: "border-box",
          overflowX: "hidden",
          borderRight: `1px solid ${SB.slate200}`,
          backgroundImage: `linear-gradient(180deg, ${SB.shell} 0%, ${SB.shellEdge} 100%)`,
          transition: (t) =>
            t.transitions.create("width", {
              duration: DURATION.rail,
              easing: EASING.emphasized,
            }),
        },
      }}
    >
      <Box
        component="nav"
        aria-label="Main navigation"
        sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
      >
        {/* header — school branding */}
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            minHeight: 82,
            px: collapsed ? 0 : 2,
            justifyContent: collapsed ? "center" : "flex-start",
            overflow: "hidden",
          }}
        >
          <SidebarDecor name="waves" tone="text-primary" opacity={0.1} right={-54} />
          <BrandBlock brand={brand} collapsed={collapsed} />
        </Box>

        <Divider sx={{ borderColor: SB.slate200 }} />

        {/* nav filter — expanded mode only, the rail has no room for it */}
        {collapsed ? null : (
          <Box sx={{ px: 1.5, py: `${searchPadY}px` }}>
            <Box
              component="div"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                height: searchHeight,
                px: 1.1,
                borderRadius: 2,
                bgcolor: SB.slate100,
                border: `1px solid ${SB.slate200}`,
                transition: (t) =>
                  t.transitions.create(["border-color", "background-color"], {
                    duration: DURATION.fast,
                  }),
                "&:focus-within": {
                  bgcolor: SB.paper,
                  borderColor: alpha(BRAND.main, 0.45),
                },
              }}
            >
              <SearchRoundedIcon sx={{ fontSize: 17, color: SB.slate500, flexShrink: 0 }} />
              <Box
                component="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search navigation"
                aria-label="Search navigation"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  outline: 0,
                  bgcolor: "transparent",
                  font: "inherit",
                  fontSize: 13,
                  fontWeight: 550,
                  color: SB.slate900,
                  "&::placeholder": { color: SB.slate500, opacity: 1 },
                }}
              />
              {query ? (
                <IconButton
                  size="small"
                  onClick={() => setQuery("")}
                  aria-label="Clear navigation search"
                  sx={{ p: 0.25, color: SB.slate500 }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              ) : null}
            </Box>
          </Box>
        )}

        {/* scrollable navigation */}
        <Box
          ref={scrollRef}
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            pt: `${listTopPad}px`,
            pb: `${listBottomPad}px`,
            ...scrollbarSx,
          }}
        >
          {visible.map((group) => (
            <Box key={group.id} component="section" sx={{ mb: `${groupGap}px` }}>
              {group.header ? <GroupHeader group={group} collapsed={collapsed} /> : null}

              {group.extra ? (
                <Box sx={{ px: collapsed ? 0 : 1.5, pb: "5px" }}>{group.extra}</Box>
              ) : null}

              <List disablePadding dense>
                {group.items.map((item) => {
                  const selected = isRouteActive(item.to, location.pathname, item.end);
                  const hasChildren = (item.children?.length || 0) > 0;
                  const open = isGroupOpen(group.id) || (hasChildren && selected);

                  return (
                    <NavItem
                      key={item.to || item.label}
                      item={item}
                      pathname={location.pathname}
                      collapsed={collapsed}
                      selected={selected}
                      expanded={open}
                      onToggleExpand={() => toggleGroup(group.id)}
                      onNavigate={handleNavigate}
                    />
                  );
                })}
              </List>
            </Box>
          ))}

          {visible.length === 0 ? (
            <Box sx={{ px: collapsed ? 0 : 2, py: 3, textAlign: "center" }}>
              <Typography sx={{ fontSize: 12.5, color: SB.slate500 }}>
                {collapsed
                  ? "—"
                  : effectiveQuery.trim()
                    ? `Nothing matches “${effectiveQuery.trim()}”.`
                    : "No navigation items available for your role."}
              </Typography>
            </Box>
          ) : null}
        </Box>

        {/* footer — user + collapse toggle */}
        <Box
          sx={{
            position: "relative",
            borderTop: `1px solid ${SB.slate200}`,
            bgcolor: SB.paper,
            overflow: "hidden",
          }}
        >
          <SidebarDecor
            name="waves"
            tone="text-primary"
            opacity={0.14}
            right={-78}
            bottom={2}
            width={268}
          />
          <SidebarDecor
            name="stack"
            tone="text-slate-500"
            opacity={0.26}
            right={-46}
            bottom={-20}
            width={188}
          />
          {showSchoolSession ? (
            <Box sx={{ position: "relative", px: collapsed ? 0 : 2, py: 1.75 }}>
              <SchoolSessionBlock
                schoolName={schoolName}
                session={session}
                collapsed={collapsed}
              />
            </Box>
          ) : null}

          {showFooterToggle && !isMobile ? (
            <>
              <Divider sx={{ borderColor: SB.slate200 }} />
              <Box sx={{ p: 1 }}>
                <Tooltip
                  title={collapsed ? "Expand navigation" : "Collapse navigation"}
                  placement="right"
                  slotProps={fadeTransition}
                >
                  <IconButton
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
                    aria-expanded={!collapsed}
                    sx={{
                      width: "100%",
                      height: 46,
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: 1,
                      px: collapsed ? 0 : 1.25,
                      borderRadius: 2,
                      color: "text.secondary",
                      transition: (t) =>
                        t.transitions.create(["background-color", "color"], {
                          duration: DURATION.fast,
                        }),
                      "&:hover": { bgcolor: SB.slate100, color: SB.slate900 },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: "grid",
                        placeItems: "center",
                        transition: (t) =>
                          t.transitions.create("transform", {
                            duration: DURATION.rail,
                            easing: EASING.emphasized,
                          }),
                        transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      {collapsed ? (
                        <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 20 }} />
                      ) : (
                        <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 20 }} />
                      )}
                    </Box>

                    {collapsed ? null : (
                      <Typography
                        sx={{ fontSize: 13.5, fontWeight: 650, flex: 1, textAlign: "left" }}
                      >
                        Collapse
                      </Typography>
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            </>
          ) : null}
        </Box>
      </Box>
    </Drawer>
  );
}
