// Frontend mirror of the backend RBAC map (services/*/utils/permissions.js).
// The backend is the source of truth and now returns `permissions[]` with the
// login/me payload; this fallback only covers pre-existing localStorage
// sessions that have no permissions field yet.

import { useSelector } from "react-redux";
import { selectUser } from "../store/selectors";

export const legacyRole = (role) => (role === "admin" ? "school_admin" : role);

// Kept in sync with the backend TEACHING_PERMISSIONS bundle.
const TEACHING_PERMISSIONS = [
  "dashboard:view", "staff:read", "students:read", "attendance:read",
  "attendance:mark",
  "timetable:read", "timetable:write", "homework:read", "homework:write",
  "exams:read", "marks:read", "notices:read", "notices:publish",
  "leaves:apply", "payroll:view",
  "library:read", "sessions:read",
  "promotion:read", "transfer:read", "rollover:read",
  "health:read", "health:write", "conduct:read", "conduct:write",
  "achievements:read", "achievements:write",
];

// Kept in sync with the backend STAFF_PERMISSIONS bundle: four of the five
// staff designations carry library:read so the persona Library entry isn't a
// dead redirect (writes stay with librarian/admin+teacher). Transport has no
// library responsibility, so it gets neither the permission nor the nav entry.
const STAFF_PERMISSIONS = {
  admission_counsellor: [
    "dashboard:view", "staff:read", "students:read", "students:write",
    "admissions:read", "admissions:write", "enquiries:read", "enquiries:write",
    "notices:read", "notices:publish", "attendance:read", "attendance:mark",
    "leaves:apply", "payroll:view",
    "library:read",
  ],
  accountant: [
    "dashboard:view", "staff:read", "students:read", "fees:read", "fees:collect",
    "fees:structure", "fees:reports", "reports:view", "attendance:read",
    "accounting:read", "accounting:journal",
    "notices:read", "notices:publish",
    "leaves:apply", "payroll:view",
    "library:read",
  ],
  librarian: [
    "dashboard:view", "staff:read", "students:read", "library:read",
    "library:manage", "library:notify",
    "notices:read", "notices:publish",
    "leaves:apply", "payroll:view",
  ],
  receptionist: [
    "dashboard:view", "staff:read", "students:read", "admissions:read",
    "admissions:write", "enquiries:read", "enquiries:write",
    "notices:read", "notices:publish",
    "leaves:apply", "payroll:view",
    "library:read",
  ],
  transport: [
    "dashboard:view", "staff:read", "students:read", "transport:read",
    "transport:update",
    "notices:read", "notices:publish",
    "leaves:apply", "payroll:view",
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
    "accounting:read", "accounting:journal",
    "library:notify",
    "notices:read", "notices:publish", "events:read", "events:publish",
    "transport:read", "transport:update", "inventory:read", "inventory:write",
    "payroll:view", "payroll:admin", "leaves:apply", "leaves:approve",
    "hostel:read", "hostel:manage", "users:manage", "school:settings",
    "branches:read", "branches:write",
    "payments:settings", "sessions:read", "sessions:write",
    "promotion:read", "promotion:write", "transfer:read", "transfer:write",
    "rollover:read", "rollover:write",
    "health:read", "health:write", "conduct:read", "conduct:write",
    "achievements:read", "achievements:write",
  ],
  teacher: [...TEACHING_PERMISSIONS],
  staff: [
    "dashboard:view",
    "staff:read", "attendance:read", "attendance:mark",
    "notices:read", "notices:publish",
    "leaves:apply", "payroll:view",
    "library:read",
  ],
  student: [
    "dashboard:view", "attendance:read", "homework:read",
    "exams:read", "marks:read", "fees:read", "library:read", "notices:read",
    "events:read", "transport:read", "hostel:read", "timetable:read",
    "profile:read", "profile:update",
    "conduct:read", "achievements:read",
    "leaves:apply",
  ],
  // Parent portal account — read-only view over linked children (mirrors the
  // backend ROLE_PERMISSIONS.parent bundle).
  parent: [
    "dashboard:view", "attendance:read", "homework:read", "exams:read",
    "marks:read", "fees:read", "library:read", "notices:read", "events:read",
    "transport:read", "timetable:read",
  ],
};

export function permissionsFor(user) {
  if (!user) return [];
  const perms = user.permissions;
  if (Array.isArray(perms)) return perms;
  const role = legacyRole(user.role);
  if (role === "staff") return STAFF_PERMISSIONS[user.designation] || ROLE_PERMISSIONS["staff"];
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

// True when the user holds ANY of the listed permissions — the client mirror of
// the backend's requireAnyPermission. Used by the Library's study-material
// shelf, writable by teachers/admins (homework:write) and the librarian
// (library:manage).
export function useAnyPermission(...permissions) {
  const user = useSelector(selectUser);
  const perms = permissionsFor(user);
  if (perms.includes("*")) return true;
  return permissions.some((p) => perms.includes(p));
}

export function PermissionGate({ permission, children }) {
  const allowed = usePermission(permission);
  if (!allowed) return null;
  return children;
}