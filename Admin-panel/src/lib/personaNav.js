// Persona-restricted navigation for the four new staff workspaces.
// These users get a compact, role-appropriate sidebar instead of the full
// permission-driven administration navigation. Each item still points at a
// route protected by RequirePersona (frontend) and role+permission+tenant
// checks (backend).

// Navigation icons: MUI Material Design *Filled* set (no extra dependency).
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import Assignment from "@mui/icons-material/Assignment";
import Dashboard from "@mui/icons-material/Dashboard";
import Download from "@mui/icons-material/Download";
import EventAvailable from "@mui/icons-material/EventAvailable";
import InsertChart from "@mui/icons-material/InsertChart";
import MenuBook from "@mui/icons-material/MenuBook";
import Notifications from "@mui/icons-material/Notifications";
import PersonSearch from "@mui/icons-material/PersonSearch";
import Place from "@mui/icons-material/Place";
import Speed from "@mui/icons-material/Speed";

const attendance = {
  to: "/staff/my-attendance",
  icon: EventAvailable,
  label: "My Attendance",
};
const leave = {
  to: "/leave",
  icon: InsertChart,
  label: "Leave",
};
const notifications = {
  to: "/notifications",
  icon: Notifications,
  label: "Notifications",
};
const notices = {
  to: "/notice-board",
  icon: Assignment,
  label: "Notices",
};

function group(label, items) {
  return { label, items };
}

export const PERSONA_NAV = {
  accountant: [
    group("Accountant Workspace", [
      { to: "/accountant", icon: Dashboard, label: "Dashboard", end: true },
      { to: "/accountant/fees", icon: AccountBalanceWallet, label: "Manage Fees" },
    ]),
    group("Staff Tools", [attendance, leave, notices, notifications]),
  ],
  librarian: [
    group("Librarian Workspace", [
      { to: "/librarian", icon: Dashboard, label: "Dashboard", end: true },
      { to: "/librarian/books", icon: MenuBook, label: "Books" },
      { to: "/librarian/circulation", icon: Download, label: "Circulation" },
    ]),
    group("Staff Tools", [attendance, leave, notices, notifications]),
  ],
  transport: [
    group("Transport Workspace", [
      { to: "/transport", icon: Dashboard, label: "Dashboard", end: true },
      { to: "/transport/routes", icon: Place, label: "Bus Routes" },
      { to: "/transport/allocations", icon: Speed, label: "Allocations" },
    ]),
    group("Staff Tools", [attendance, leave, notices, notifications]),
  ],
  receptionist: [
    group("Reception Workspace", [
      { to: "/reception", icon: Dashboard, label: "Dashboard", end: true },
      { to: "/reception/enquiries", icon: Assignment, label: "Enquiries" },
      { to: "/reception/student-lookup", icon: PersonSearch, label: "Student Lookup" },
    ]),
    group("Staff Tools", [attendance, leave, notices, notifications]),
  ],
};