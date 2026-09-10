// Fixed RBAC permission map. Single source of truth in @school-erp/shared
// (previously copied per service; reconciled into this canonical version).
// "teacher" role added; facility-service historical swap of student
// transport:read -> hostel:read is intentionally resolved to transport:read.
//
// Permission format: "module:action"
// "*" = full access (super_admin / platform owner)

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
    "enquiries:write", "attendance:read", "attendance:mark", "attendance:export", "timetable:read",
    "timetable:write", "homework:read", "homework:write", "exams:read",
    "exams:write", "marks:read", "marks:write", "fees:read", "fees:collect",
    "fees:structure", "fees:reports", "reports:view", "library:read", "library:manage",
    "library:notify", "notices:read", "notices:publish", "events:read", "events:publish",
    "transport:read", "transport:update", "inventory:read", "inventory:write",
    "payroll:view", "payroll:admin", "leaves:apply", "leaves:approve",
    "hostel:read", "hostel:manage", "users:manage", "school:settings",
    "sessions:read", "sessions:write",
    "promotion:read", "promotion:write", "transfer:read", "transfer:write",
    "rollover:read", "rollover:write",
  ],
  class_teacher: [
    "dashboard:view", "staff:read", "students:read", "attendance:read",
    "attendance:mark",
    "timetable:read", "timetable:write", "homework:read", "homework:write",
    "exams:read", "marks:read", "notices:read", "leaves:apply", "payroll:view",
    "promotion:read", "transfer:read", "rollover:read",
  ],
  // Plain teaching role — same teaching permissions as a Class Teacher. The
  // Class Teacher is a *responsibility* layered on top of a teacher account.
  teacher: [
    "dashboard:view", "staff:read", "students:read", "attendance:read",
    "attendance:mark",
    "timetable:read", "timetable:write", "homework:read", "homework:write",
    "exams:read", "marks:read", "notices:read", "leaves:apply", "payroll:view",
    "promotion:read", "transfer:read", "rollover:read",
  ],
  staff: ["staff:read", "leaves:apply", "payroll:view"],
  student: [
    "dashboard:view", "attendance:read", "homework:read", "exams:read",
    "marks:read", "fees:read", "library:read", "notices:read", "events:read",
    "transport:read", "timetable:read", "profile:read", "profile:update",
  ],
};

function hasPermission(user, permission) {
  if (!user) return false;
  const perms = getPermissionsFor(user);
  return perms.includes("*") || perms.includes(permission);
}

// Resolve the concrete permission list for a user token payload.
function getPermissionsFor(user) {
  if (!user || !user.role) return [];
  if (user.role === "staff") return STAFF_PERMISSIONS[user.designation] || ROLE_PERMISSIONS["staff"];
  return ROLE_PERMISSIONS[user.role] || [];
}

module.exports = { ROLE_PERMISSIONS, STAFF_PERMISSIONS, getPermissionsFor, hasPermission };