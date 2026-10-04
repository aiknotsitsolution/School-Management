// Persona-restricted navigation for the staff workspaces.
// These users get a compact, role-appropriate sidebar instead of the full
// permission-driven administration navigation. Each item still points at a
// route protected by RequirePersona (frontend) and role+permission+tenant
// checks (backend).

// Navigation icons: MUI Material Design *Filled* set (no extra dependency).
// Vectors only, so they stay crisp at the 84px rail size.
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import Assignment from "@mui/icons-material/Assignment";
import AssignmentTurnedIn from "@mui/icons-material/AssignmentTurnedIn";
import AutoStories from "@mui/icons-material/AutoStories";
import Campaign from "@mui/icons-material/Campaign";
import DirectionsBus from "@mui/icons-material/DirectionsBus";
import Download from "@mui/icons-material/Download";
import EventAvailable from "@mui/icons-material/EventAvailable";
import FactCheck from "@mui/icons-material/FactCheck";
import Group from "@mui/icons-material/Group";
import InsertChart from "@mui/icons-material/InsertChart";
import PersonAdd from "@mui/icons-material/PersonAdd";
import PersonSearch from "@mui/icons-material/PersonSearch";
import SpaceDashboard from "@mui/icons-material/SpaceDashboard";
import Speed from "@mui/icons-material/Speed";
import TrendingUp from "@mui/icons-material/TrendingUp";

const attendance = {
  to: "/staff/my-attendance",
  icon: FactCheck,
  label: "My Attendance",
};
// Any persona can be handed a task, so their workspace needs the same
// "My Work" surface the generic Staff Tools group offers — otherwise the
// notification that task raises points at a route they have no way to reach.
const myWork = {
  to: "/my-work",
  icon: AssignmentTurnedIn,
  label: "My Work",
};
const leave = {
  to: "/leave",
  icon: InsertChart,
  label: "Leave",
};
const notifications = {
  to: "/notifications",
  icon: Campaign,
  label: "Notifications",
};
const notices = {
  to: "/notice-board",
  icon: Campaign,
  label: "Notices",
};

function group(label, items) {
  return { label, items };
}

export const PERSONA_NAV = {
  // Admission counsellor: the enrolment desk. Every route below is one the
  // counsellor bundle already authorizes (students:read/write, admissions:read,
  // attendance:read, notices:read, leaves:apply) and links to a route with a
  // real guard — see App.jsx. Deliberately excludes the academic, finance,
  // library, transport and administration trees a counsellor cannot use.
  counsellor: [
    group("Counsellor Workspace", [
      { to: "/admission-counsellor", icon: SpaceDashboard, label: "Dashboard", end: true },
      { to: "/admission-enquiry", icon: Assignment, label: "Admission Pipeline" },
      { to: "/students", icon: Group, label: "All Students" },
      { to: "/addstudent", icon: PersonAdd, label: "New Admission" },
    ]),
    group("Staff Tools", [
      { to: "/attendance", icon: EventAvailable, label: "Attendance" },
      myWork,
      attendance,
      leave,
      notices,
      notifications,
    ]),
  ],
  accountant: [
    group("Accountant Workspace", [
      { to: "/accountant", icon: SpaceDashboard, label: "Dashboard", end: true },
      { to: "/accountant/fees", icon: AccountBalanceWallet, label: "Manage Fees" },
    ]),
    group("Staff Tools", [myWork, attendance, leave, notices, notifications]),
  ],
  librarian: [
    group("Librarian Workspace", [
      { to: "/librarian", icon: SpaceDashboard, label: "Dashboard", end: true },
      { to: "/librarian/books", icon: AutoStories, label: "Books" },
      { to: "/librarian/circulation", icon: Download, label: "Circulation" },
    ]),
    group("Staff Tools", [myWork, attendance, leave, notices, notifications]),
  ],
  transport: [
    group("Transport Workspace", [
      { to: "/transport", icon: SpaceDashboard, label: "Dashboard", end: true },
      { to: "/bus-tracking", icon: TrendingUp, label: "Fleet Tracking" },
      { to: "/transport/routes", icon: DirectionsBus, label: "Bus Routes" },
      { to: "/transport/allocations", icon: Speed, label: "Allocations" },
    ]),
    group("Staff Tools", [myWork, attendance, leave, notices, notifications]),
  ],
  receptionist: [
    group("Reception Workspace", [
      { to: "/reception", icon: SpaceDashboard, label: "Dashboard", end: true },
      { to: "/reception/enquiries", icon: Assignment, label: "Enquiries" },
      { to: "/reception/student-lookup", icon: PersonSearch, label: "Student Lookup" },
    ]),
    group("Staff Tools", [myWork, attendance, leave, notices, notifications]),
  ],
};