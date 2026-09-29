// Isolated preview for the MUI sidebar — NOT wired into the app shell.
//
// Mount it at its own route (e.g. `/sidebar-preview`) to review the rail in
// isolation, without the live Tailwind sidebar getting in the way. Delete the
// route once the design is signed off.

import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { useLocation } from "react-router-dom";

import SidebarMui from "./SidebarMui";
import MOCK_NAV from "./sidebarNav.config";
import { sidebarTheme } from "./sidebarTheme";

const DEMO_USER = {
  name: "Aarav Sharma",
  role: "Principal",
};

const DEMO_BRAND = {
  name: "Sunrise Public School",
  code: "Academic Session 2025-26",
};

export default function SidebarMuiPreview() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <ThemeProvider theme={sidebarTheme}>
      <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
        <SidebarMui
          nav={MOCK_NAV}
          brand={DEMO_BRAND}
          user={DEMO_USER}
          canSee={() => true}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 4 } }}>
          <Paper
            variant="outlined"
            sx={{ p: 3, borderRadius: 3, maxWidth: 720, mx: "auto" }}
          >
            <Stack spacing={2} alignItems="flex-start">
              <Typography variant="h5" sx={{ fontWeight: 750, letterSpacing: "-0.02em" }}>
                MUI Sidebar Preview
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Standalone component — the live app shell is untouched. Use the
                footer chevron (or <kbd>Ctrl</kbd> + <kbd>B</kbd>) to switch
                between the detailed panel and the collapsed rail, then hover a
                rail icon to see the interactive sub-item tooltip.
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`route: ${location.pathname}`} />
                <Chip size="small" variant="outlined" label="persisted in localStorage" />
              </Stack>

              <Button
                variant="contained"
                onClick={() => setMobileOpen(true)}
                sx={{ display: { md: "none" } }}
              >
                Open mobile drawer
              </Button>

              <Dividerless />

              <Box sx={{ width: "100%" }}>
                <Typography variant="overline" color="text.secondary">
                  Active route
                </Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>
                  {location.pathname}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Sample links point at the mock nav tree, so unknown paths fall
                  through to the catch-all redirect in <code>App.jsx</code>.
                </Typography>
              </Box>

              <Button component={RouterLink} to="/student-dashboard" variant="outlined">
                Go to a real app route
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

function Dividerless() {
  return <Box sx={{ height: 1, width: "100%", bgcolor: "divider" }} />;
}
