// Frontend mirror of the backend RBAC map (services/*/utils/permissions.js).
// The backend is the source of truth and now returns `permissions[]` with the
// login/me payload; this fallback only covers pre-existing localStorage
// sessions that have no permissions field yet.

import { useSelector } from "react-redux";
import { selectUser } from "../store/selectors";

const legacyRole = (role) => (role === "admin" ? "school_admin" : role);

// Kept in sync with the backend TEACHING_PERMISSIONS bundle.
const TEACHING_PERMISSIONS = [
  "dashboard:view", "staff:read", "students:read", "attendance:read",
  "attendance:mark",
  "timetable:read", "timetable:write", "homework:read", "homework:write",
  "exams:read", "marks:read", "notices:read", "leaves:apply", "payroll:view",
  "promotion:read", "transfer:read", "rollover:read",
];

const STAFF_PERMISSIONS = {
  admission_counsellor: [
    "dashboard:view", "staff:read", "students:read", "students:write",
    "admissions:read", "admissions:write", "enquiries:read", "enquiries:write",
    "notices:read", "leaves:apply", "payroll:view",
  ],
  accountant: [
    "dashboard:view", "staff:read", "students:read", "fees:read", "fees:collect",
    "fees:structure", "fees:reports", "reports:view", "leaves:apply", "payroll:view",
  ],
  librarian: [
    "dashboard:view", "staff:read", "students:read", "library:read",
    "library:manage", "library:notify", "leaves:apply", "payroll:view",
  ],
  receptionist: [
    "dashboard:view", "staff:read", "students:read", "admissions:read",
    "admissions:write", "enquiries:read", "enquiries:write", "notices:read",
    "leaves:apply", "payroll:view",
  ],
  transport: [
    "dashboard:view", "staff:read", "students:read", "transport:read",
    "transport:update", "leaves:apply", "payroll:view",
  ],
};

const ROLE_PERMISSIONS = {
  super_admin: ["*"],
  school_admin: [
    "dashboard:view", "students:read", "students:write", "staff:read",
    "staff:write", "admissions:read", "admissions:write", "enquiries:read",
    "enquiries:write", "attendance:read", "attendance:mark", "attendance:export",
    "timetable:read",
    "timetable:write", "homework:read", "homework:write", "exams:read",
    "exams:write", "marks:read", "marks:write", "fees:read", "fees:collect",
    "fees:structure", "fees:reports", "reports:view", "library:read", "library:manage",
    "library:notify",
    "notices:read", "notices:publish", "events:read", "events:publish",
    "transport:read", "transport:update", "inventory:read", "inventory:write",
    "payroll:view", "payroll:admin", "leaves:apply", "leaves:approve",
    "hostel:read", "hostel:manage", "users:manage", "school:settings",
    "payments:settings", "sessions:read", "sessions:write",
    "promotion:read", "promotion:write", "transfer:read", "transfer:write",
    "rollover:read", "rollover:write",
  ],
  teacher: [...TEACHING_PERMISSIONS],
  staff: ["staff:read", "leaves:apply", "payroll:view"],
  student: [
    "dashboard:view", "attendance:read", "homework:read",
    "exams:read", "marks:read", "fees:read", "library:read", "notices:read",
    "events:read", "transport:read", "hostel:read", "timetable:read",
    "profile:read", "profile:update",
  ],
};

export function permissionsFor(user) {
  if (!user) return [];
  const perms = user.permissions;
  if (Array.isArray(perms)) return perms;
  const role = legacyRole(user.role);
  if (role === "staff") return STAFF_PERMISSIONS[user.designation] || [];
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(user, permission) {
  const perms = permissionsFor(user);
  return perms.includes("*") || perms.includes(permission);
}

export function usePermissions() {
  const user = useSelector(selectUser);
  return permissionsFor(user);
}

export function usePermission(permission) {
  const user = useSelector(selectUser);
  return hasPermission(user, permission);
}

export function PermissionGate({ permission, children }) {
  const allowed = usePermission(permission);
  if (!allowed) return null;
  return children;
}