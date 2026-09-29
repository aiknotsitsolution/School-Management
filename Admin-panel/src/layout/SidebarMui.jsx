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
//     user={{ name: user?.name, role: user?.role, avatar: user?.photoUrl }}
//     canSee={(item) => hasPermission(user, item.permission)}
//     onSettings={() => setAccountOpen(true)}
//     onSignOut={handleSignOut}
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
import Avatar from "@mui/material/Avatar";
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

import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardDoubleArrowLeftRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowLeftRounded";
import KeyboardDoubleArrowRightRoundedIcon from "@mui/icons-material/KeyboardDoubleArrowRightRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";

import useSidebarState, { isRouteActive } from "./useSidebarState";
import { BRAND, DURATION, EASING, SIDEBAR_TOKENS, softPrimary } from "./sidebarTheme";
import MOCK_NAV from "./sidebarNav.config";

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
} = SIDEBAR_TOKENS;

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
  scrollbarColor: `${BRAND.slate300} transparent`,
  "&::-webkit-scrollbar": { width: 6 },
  "&::-webkit-scrollbar-track": { background: "transparent" },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: BRAND.slate300,
    borderRadius: 999,
  },
  "&::-webkit-scrollbar-thumb:hover": { backgroundColor: BRAND.slate500 },
};

const fadeTransition = {
  transition: { timeout: DURATION.fast, easing: EASING.standard },
  arrow: { sx: { color: BRAND.slate900 } },
};

/* ── Badge ───────────────────────────────────────────────────────────────── */

function BadgePill({ count, tone = "primary" }) {
  const paletteKey = TONE_PALETTE[tone] || "primary";
  return (
    <Box
      component="span"
      sx={{
        minWidth: 20,
        height: 20,
        px: 0.6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "999px",
        bgcolor: (t) => alpha(t.palette[paletteKey].main, 0.14),
        color: (t) => t.palette[paletteKey].main,
        fontSize: 11,
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

const activeRailSx = {
  "&::before": {
    content: '""',
    position: "absolute",
    left: 0,
    top: "50%",
    width: 3,
    height: 0,
    borderRadius: "0 3px 3px 0",
    bgcolor: "primary.main",
    transform: "translateY(-50%)",
    transition: (t) =>
      t.transitions.create("height", {
        duration: DURATION.normal,
        easing: EASING.emphasized,
      }),
  },
  "&.Mui-selected::before": { height: "62%" },
};

const itemRootSx = (selected) => ({
  position: "relative",
  minHeight: itemHeight,
  borderRadius: `${radius}px`,
  pl: 1.25,
  pr: 1.25,
  color: selected ? "primary.dark" : "text.secondary",
  bgcolor: selected ? softPrimary(0.09) : "transparent",
  overflow: "hidden",
  transition: (t) =>
    t.transitions.create(["background-color", "color", "box-shadow"], {
      duration: DURATION.fast,
      easing: EASING.standard,
    }),
  "&:hover": {
    bgcolor: selected ? softPrimary(0.13) : BRAND.slate100,
    color: selected ? "primary.dark" : BRAND.slate900,
    "& .nav-icon": { color: selected ? "primary.main" : BRAND.slate700 },
  },
  "&.Mui-focusVisible": {
    boxShadow: `0 0 0 3px ${alpha(BRAND.main, 0.28)}`,
  },
  ...activeRailSx,
});

const iconSx = (selected) => ({
  minWidth: 0,
  color: "inherit",
  // Width/height are set alongside `fontSize` so this works with MUI SvgIcons
  // and with lucide-react icons, which size via attributes instead of em.
  "& .nav-icon": {
    fontSize: 20,
    width: 20,
    height: 20,
    display: "block",
    flexShrink: 0,
    color: selected ? "primary.main" : "currentColor",
    filter: selected ? `drop-shadow(0 0 7px ${alpha(BRAND.main, 0.5)})` : "none",
    transition: (t) =>
      t.transitions.create(["color", "filter"], {
        duration: DURATION.normal,
        easing: EASING.standard,
      }),
  },
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
        fontSize: 12,
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
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "#F8FAFC" }}>
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
            "&::after": {
              content: '""',
              position: "absolute",
              left: 18,
              top: 0,
              bottom: 0,
              width: 1,
              bgcolor: BRAND.slate200,
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
                  width: 24,
                  height: 24,
                  color: "text.secondary",
                  transition: (t) =>
                    t.transitions.create("transform", {
                      duration: DURATION.normal,
                      easing: EASING.emphasized,
                    }),
                  transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                }}
              >
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            ) : null}
          </Box>
        )
      }
    >
      {Icon ? (
        <ListItemIcon
          sx={{
            ...iconSx(selected),
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
                fontSize: 13,
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
            border: `2px solid ${BRAND.slate900}`,
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
              bgcolor: BRAND.slate200,
            },
          }}
        >
          {GroupIcon ? (
            <Box
              component={GroupIcon}
              className="nav-icon"
              sx={{
                fontSize: 15,
                width: 15,
                height: 15,
                opacity: 0.5,
                color: BRAND.slate500,
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
        color: BRAND.slate500,
        fontSize: 10.5,
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
        width: 38,
        height: 38,
        flexShrink: 0,
        borderRadius: 2.5,
        display: "grid",
        placeItems: "center",
        background:
          "linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #DB2777 100%)",
        color: "#fff",
        fontWeight: 800,
        fontSize: 15,
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
            fontSize: 14,
            fontWeight: 750,
            lineHeight: 1.2,
            color: BRAND.slate900,
            letterSpacing: "-0.015em",
          }}
        >
          {brand?.name || "Your School"}
        </Typography>
        <Typography
          noWrap
          sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.25, fontWeight: 550 }}
        >
          {brand?.code || brand?.session || "School ERP"}
        </Typography>
      </Box>
    </Box>
  );
}

function UserBlock({ user, collapsed, onSettings, onSignOut }) {
  const avatar = (
    <Avatar
      src={user?.avatar}
      alt=""
      sx={{
        width: 34,
        height: 34,
        fontSize: 12.5,
        fontWeight: 750,
        bgcolor: softPrimary(0.16),
        color: "primary.dark",
      }}
    >
      {initialsOf(user?.name || "User")}
    </Avatar>
  );

  if (collapsed) {
    return (
      <Tooltip
        title={`${user?.name || "Account"}${user?.role ? ` · ${user.role}` : ""}`}
        placement="right"
        slotProps={fadeTransition}
      >
        <Box sx={{ display: "grid", placeItems: "center" }}>{avatar}</Box>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      {avatar}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          sx={{ fontSize: 12.5, fontWeight: 700, color: BRAND.slate900, lineHeight: 1.25 }}
        >
          {user?.name || "Account"}
        </Typography>
        <Typography noWrap sx={{ fontSize: 11, color: "text.secondary", mt: 0.15 }}>
          {user?.role || "Member"}
        </Typography>
      </Box>

      {onSettings || onSignOut ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {onSettings ? (
            <IconButton
              size="small"
              aria-label="Account settings"
              onClick={onSettings}
              sx={{
                color: "text.secondary",
                width: 30,
                height: 30,
                "&:hover": { bgcolor: BRAND.slate100, color: BRAND.slate900 },
              }}
            >
              <SettingsRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          ) : null}
          {onSignOut ? (
            <IconButton
              size="small"
              aria-label="Sign out"
              onClick={onSignOut}
              sx={{
                color: "text.secondary",
                width: 30,
                height: 30,
                "&:hover": { bgcolor: alpha("#E11D48", 0.1), color: "error.main" },
              }}
            >
              <LogoutRoundedIcon sx={{ fontSize: 17 }} />
            </IconButton>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */

export default function SidebarMui({
  nav = MOCK_NAV,
  brand = {},
  user = {},
  canSee = allowAll,
  open: openProp,
  onClose,
  onToggle,
  onSettings,
  onSignOut,
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

  return (
    <Drawer
      {...drawerProps}
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
          borderRight: `1px solid ${BRAND.slate200}`,
          backgroundImage: `linear-gradient(180deg, #FFFFFF 0%, ${BRAND.slate50} 100%)`,
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
            display: "flex",
            alignItems: "center",
            minHeight: 64,
            px: collapsed ? 0 : 2,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <BrandBlock brand={brand} collapsed={collapsed} />
        </Box>

        <Divider sx={{ borderColor: BRAND.slate200 }} />

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
          {filtered.map((group) => (
            <Box key={group.id} component="section" sx={{ mb: `${groupGap}px` }}>
              {group.header ? <GroupHeader group={group} collapsed={collapsed} /> : null}

              {group.extra ? (
                <Box sx={{ px: collapsed ? 0 : 1.5, pb: "4px" }}>{group.extra}</Box>
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

          {filtered.length === 0 ? (
            <Box sx={{ px: collapsed ? 0 : 2, py: 3, textAlign: "center" }}>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {collapsed ? "—" : "No navigation items available for your role."}
              </Typography>
            </Box>
          ) : null}
        </Box>

        {/* footer — user + collapse toggle */}
        <Box sx={{ borderTop: `1px solid ${BRAND.slate200}`, bgcolor: "#FFFFFFCC" }}>
          <Box sx={{ px: collapsed ? 0 : 2, py: 1.5 }}>
            <UserBlock
              user={user}
              collapsed={collapsed}
              onSettings={onSettings}
              onSignOut={onSignOut}
            />
          </Box>

          {showFooterToggle && !isMobile ? (
            <>
              <Divider sx={{ borderColor: BRAND.slate200 }} />
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
                      height: 36,
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: 1,
                      px: collapsed ? 0 : 1.25,
                      borderRadius: 2,
                      color: "text.secondary",
                      transition: (t) =>
                        t.transitions.create(["background-color", "color"], {
                          duration: DURATION.fast,
                        }),
                      "&:hover": { bgcolor: BRAND.slate100, color: BRAND.slate900 },
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
                        <KeyboardDoubleArrowRightRoundedIcon sx={{ fontSize: 18 }} />
                      ) : (
                        <KeyboardDoubleArrowLeftRoundedIcon sx={{ fontSize: 18 }} />
                      )}
                    </Box>

                    {collapsed ? null : (
                      <Typography
                        sx={{ fontSize: 12, fontWeight: 650, flex: 1, textAlign: "left" }}
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
