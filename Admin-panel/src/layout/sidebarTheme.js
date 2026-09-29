// Theme + design tokens for the MUI sidebar.
//
// Kept separate from the component so the palette, rail metrics and easing
// curves can be tweaked in one place, and so a host app can spread it into
// its own theme instead of re-declaring values.

import { alpha, createTheme } from "@mui/material/styles";

export const BRAND = {
  main: "#4F46E5",
  dark: "#3730A3",
  light: "#EEF2FF",
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
  expandedWidth: 312,
  collapsedWidth: 84,
  // NOTE: these are raw PIXELS, not MUI theme-spacing units. Call sites render
  // them as `${n}px` — passing them bare into `sx` would multiply by the theme
  // spacing (8px per unit) and blow the spacing up 8x.
  itemHeight: 50,
  nestedItemHeight: 46,
  // Group heading block: vertical padding + minimum height.
  groupHeaderPadY: 5,
  groupHeaderHeight: 28,
  // Breathing room between a group heading and the first item under it.
  groupHeaderGap: 2,
  groupGap: 6,
  // Space above the first item / under the final item, before the footer.
  listTopPad: 6,
  listBottomPad: 6,
  railIcon: 52,
  radius: 12,
};

/** Nav label / icon scale, so tab size lives in one place. */
export const SIDEBAR_TYPE = {
  label: 15,
  labelNested: 14,
  groupHeader: 11.5,
  icon: 32,
  iconNested: 28,
  groupHeaderIcon: 21,
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

/* The rail is hand-styled with literal hex values, so it does not inherit the
   Tailwind dark remap. These are CSS-variable references instead — MUI writes
   them straight into `style`, the browser resolves them against whatever
   `[data-theme]` currently says, and every surface flips for free. */
export const SB = {
  slate950: "var(--color-slate-950)",
  slate900: "var(--color-ink)",
  slate800: "var(--color-slate-800)",
  slate700: "var(--color-slate-700)",
  slate500: "var(--color-slate-500)",
  slate300: "var(--color-slate-300)",
  slate200: "var(--color-slate-200)",
  slate100: "var(--color-slate-100)",
  slate50: "var(--color-paper)",
  paper: "var(--color-white)",
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
      default: "var(--color-paper)",
      paper: "var(--color-white)",
    },
    divider: "var(--color-slate-200)",
    text: {
      primary: "var(--color-ink)",
      secondary: "var(--color-slate-text)",
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

export const softPrimary = (strength = 0.1) =>
  alpha(sidebarTheme.palette.primary.main, strength);

export default sidebarTheme;
