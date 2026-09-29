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
  expandedWidth: 292,
  collapsedWidth: 76,
  // NOTE: these are raw PIXELS, not MUI theme-spacing units. Call sites render
  // them as `${n}px` — passing them bare into `sx` would multiply by the theme
  // spacing (8px per unit) and blow the spacing up 8x.
  itemHeight: 40,
  nestedItemHeight: 36,
  // Group heading block: vertical padding + minimum height.
  groupHeaderPadY: 4,
  groupHeaderHeight: 24,
  // Breathing room between a group heading and the first item under it.
  groupHeaderGap: 2,
  groupGap: 4,
  // Space above the first item / under the final item, before the footer.
  listTopPad: 4,
  listBottomPad: 4,
  railIcon: 40,
  radius: 10,
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
      default: BRAND.slate50,
      paper: "#FFFFFF",
    },
    divider: BRAND.slate200,
    text: {
      primary: BRAND.slate900,
      secondary: BRAND.slate500,
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
          backgroundColor: BRAND.slate900,
          color: "#F8FAFC",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          padding: "8px 10px",
          borderRadius: 10,
          boxShadow: "0 18px 40px -18px rgba(11,18,32,0.65)",
        },
        arrow: { color: BRAND.slate900 },
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
