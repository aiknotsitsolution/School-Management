// Persona-restricted navigation for the four new staff workspaces.
// These users get a compact, role-appropriate sidebar instead of the full
// permission-driven administration navigation. Each item still points at a
// route protected by RequirePersona (frontend) and role+permission+tenant
// checks (backend).

import {
  LayoutDashboard,
  Wallet,
  Receipt,
  BookOpen,
  ArrowDownToLine,
  Bus,
  MapPin,
  Gauge,
  UserPlus,
  UserSearch,
  Bell,
  ClipboardList,
  CalendarCheck,
  FileBarChart2,
  UserRound,
} from "lucide-react";

const attendance = {
  to: "/staff/my-attendance",
  icon: CalendarCheck,
  label: "My Attendance",
};
const leave = {
  to: "/leave",
  icon: FileBarChart2,
  label: "Leave",
};
const notifications = {
  to: "/notifications",
  icon: Bell,
  label: "Notifications",
};
const profile = {
  to: "/staff/profile",
  icon: UserRound,
  label: "My Profile",
};

function group(label, items) {
  return { label, items };
}

export const PERSONA_NAV = {
  accountant: [
    group("Accountant Workspace", [
      { to: "/accountant", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/accountant/fees", icon: Wallet, label: "Manage Fees" },
    ]),
    group("Staff Tools", [attendance, leave, notifications, profile]),
  ],
  librarian: [
    group("Librarian Workspace", [
      { to: "/librarian", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/librarian/books", icon: BookOpen, label: "Books" },
      { to: "/librarian/circulation", icon: ArrowDownToLine, label: "Circulation" },
    ]),
    group("Staff Tools", [attendance, leave, notifications, profile]),
  ],
  transport: [
    group("Transport Workspace", [
      { to: "/transport", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/transport/routes", icon: MapPin, label: "Bus Routes" },
      { to: "/transport/allocations", icon: Gauge, label: "Allocations" },
    ]),
    group("Staff Tools", [attendance, leave]),
  ],
  receptionist: [
    group("Reception Workspace", [
      { to: "/reception", icon: LayoutDashboard, label: "Dashboard", end: true },
      { to: "/reception/enquiries", icon: ClipboardList, label: "Enquiries" },
      { to: "/reception/student-lookup", icon: UserSearch, label: "Student Lookup" },
      { to: "/reception/notices", icon: Bell, label: "Notices" },
    ]),
    group("Staff Tools", [attendance, leave, notifications, profile]),
  ],
};