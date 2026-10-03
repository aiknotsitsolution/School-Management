// Theme + design tokens for the MUI sidebar.
//
// Kept separate from the component so the palette, rail metrics and easing
// curves can be tweaked in one place, and so a host app can spread it into
// its own theme instead of re-declaring values.

import { createTheme } from "@mui/material/styles";

export const BRAND = {
  main: "#0C47CF",
  dark: "#2B4180",
  light: "#E8EFFC",
  slate950: "#0B1220",
  slate900: "#0F172A",
  slate800: "#1E293B",
  slate700: "#334155",
  slate500: "#64748B",
  slate300: "#CBD5E1",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  slate50: "#F8FAFC",
};

export const SIDEBAR_TOKENS = {
  expandedWidth: 292,
  collapsedWidth: 78,
  // NOTE: these are raw PIXELS, not MUI theme-spacing units. Call sites render
  // them as `${n}px` - passing them bare into `sx` would multiply by the theme
  // spacing (8px per unit) and blow the spacing up 8x.
  itemHeight: 48,
  nestedItemHeight: 40,
  // Group heading block: vertical padding + minimum height.
  groupHeaderPadY: 3,
  groupHeaderHeight: 20,
  // Breathing room between a group heading and the first item under it.
  groupHeaderGap: 1,
  groupGap: 2,
  // Space above the first item / under the final item, before the footer.
  listTopPad: 4,
  listBottomPad: 4,
  railIcon: 48,
  radius: 11,
  // Nav filter row above the scrolling list.
  searchPadY: 7,
  searchHeight: 38,
};

/** Nav label / icon scale, so tab size lives in one place. */
export const SIDEBAR_TYPE = {
  label: 15,
  labelNested: 14,
  groupHeader: 10.5,
  // MUI SvgIcons default to 1em (24px) - these are explicit so a dense rail and
  // a roomy rail stay in step from one place.
  icon: 25,
  iconNested: 21,
  groupHeaderIcon: 18,
};

export const EASING = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  decel: "cubic-bezier(0, 0, 0.2, 1)",
};

export const DURATION = {
  fastest: 120,
  fast: 180,
  normal: 240,
  slow: 320,
  rail: 260,
};

/* The rail is wired to the app's `data-theme` remap, so it inverts with the
   rest of the UI instead of staying a fixed light slab. Each entry resolves to
   the same CSS custom property Tailwind already emits, which means one edit in
   `index.css` retunes the whole rail and there is no second palette to keep in
   sync. The slate ramp is inverted (low numbers dark, high numbers light), so
   `slate900` stays the readable text colour in both themes.

   Values that must stay CONSTANT across themes (brand blue for focus rings and
   selection glows, pure-white overlays on artwork) deliberately keep using
   BRAND rather than a token. */
export const SB = {
  // Accent. `var()` rather than BRAND.main so the selected-row label follows the
  // app's primary remap (#0C47CF light → #7BA6F5 dark). A literal brand blue is
  // only 2.38:1 on the dark shell, which fails the label it has to carry.
  primary: "var(--color-primary)",
  // Text ramp — high numbers are text, so they stay light on dark surfaces.
  slate950: "var(--color-slate-900)",
  slate900: "var(--color-slate-900)",
  slate800: "var(--color-slate-800)",
  slate700: "var(--color-slate-700)",
  // Secondary text uses the semantic token, not a raw slate step: the inverted
  // ramp puts slate-500 at 3.73:1 on the dark shell, while slate-text holds
  // >=4.5:1 in both themes because it was authored for exactly this role.
  slate500: "var(--color-slate-text)",
  // Chrome ramp — low numbers are surfaces, so they go dark in dark mode.
  slate300: "var(--color-slate-300)",
  slate200: "var(--color-slate-200)",
  slate100: "var(--color-slate-100)",
  slate50: "var(--color-slate-50)",
  paper: "var(--color-white)",
  // Drawer surface + footer wash. `--color-white` is remapped to #111827 in dark
  // mode and `--color-paper` to #0B1220, so the gradient stays a subtle wash in
  // both themes instead of collapsing to a flat fill.
  shell: "var(--color-white)",
  shellEdge: "var(--color-paper)",
};

export const sidebarTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: "light",
    primary: {
      main: BRAND.main,
      dark: BRAND.dark,
      light: BRAND.light,
    },
    background: {
      default: "var(--color-slate-50)",
      paper: "var(--color-white)",
    },
    divider: "var(--color-slate-200)",
    text: {
      // Token-driven, so the rail's own MUI defaults invert with `data-theme`.
      primary: "var(--color-slate-900)",
      secondary: "var(--color-slate-text)",
      disabled: "var(--color-slate-300)",
    },
  },
  shape: { borderRadius: SIDEBAR_TOKENS.radius },
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: "none", fontWeight: 650, letterSpacing: "-0.01em" },
  },
  transitions: {
    duration: {
      shortest: DURATION.fastest,
      shorter: DURATION.fast,
      short: DURATION.normal,
      standard: DURATION.normal,
      complex: DURATION.slow,
      enteringScreen: DURATION.normal,
      leavingScreen: DURATION.fast,
    },
    easing: {
      easeInOut: EASING.standard,
      easeOut: EASING.decel,
      easeIn: EASING.emphasized,
      sharp: EASING.emphasized,
    },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        // The rail is a permanent MUI Drawer, and its paper ships with
        // `theme.zIndex.drawer` (1200) — far above the app's Tailwind overlay
        // stack (z-40/z-50/z-60/z-90). Every modal therefore opened *behind*
        // the rail: the backdrop could not dim it and the dialog's leading edge
        // slid underneath it, so the sidebar alone stayed lit while the rest of
        // the screen dimmed. Park the paper under that overlay stack (but still
        // above unlayered page content) so a modal dims the rail with everything
        // else. The temporary mobile drawer is unaffected: its paper sits inside
        // the Modal root, which keeps its own drawer-level z-index above page
        // content — only the backdrop-relative order inside that root changes.
        paper: { zIndex: 10 },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 220, leaveDelay: 60 },
      styleOverrides: {
        tooltip: {
          backgroundColor: "#0F172A",
          color: "#F8FAFC",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          padding: "8px 10px",
          borderRadius: 10,
          boxShadow: "0 18px 40px -18px rgba(11,18,32,0.65)",
        },
        arrow: { color: "#0F172A" },
      },
    },
    MuiButtonBase: {
      defaultProps: { disableRipple: false },
    },
  },
});

/* Tint of the brand colour for selected / hovered rows. Built with color-mix()
   against the live primary token so it retints with the theme; MUI's alpha()
   cannot take a `var()` and would throw at module scope. */
export const softPrimary = (strength = 0.1) =>
  `color-mix(in srgb, ${SB.primary} ${Math.round(strength * 100)}%, transparent)`;

export default sidebarTheme;
