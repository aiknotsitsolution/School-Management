// Navigation scope model.
//
// The ERP is a multi-tenant SaaS. A user belongs to a scope:
//   - "platform": SaaS-level (super_admin / Platform Owner)
//   - "school":   operates inside one tenant school
//
// Authorization (what a user MAY do) is separate from navigation visibility
// (which modules the UI shows).
//
// super_admin keeps full wildcard authorization in permissions.js, but it is not
// bound to a tenant, so school-level modules stay hidden until it *picks* a
// school to operate on. That is the impersonation path the backend already
// supports via X-School-Id (shared/src/middleware/tenant.js): with a school
// selected, school navigation appears; without one, it must not — the requests
// would have no tenant context and fail.
//
// While impersonating, writes are off by default (readOnly). Only permissions
// ending in ":read" survive, so a support session cannot edit payroll, fees or
// student records by accident. Turning readOnly off is an explicit opt-in.

import { hasPermission } from "./permissions";

export const PLATFORM_SCOPE = "platform";
export const SCHOOL_SCOPE = "school";

const ROLE_SCOPE = {
  super_admin: PLATFORM_SCOPE,
  school_admin: SCHOOL_SCOPE,
  admin: SCHOOL_SCOPE,
  teacher: SCHOOL_SCOPE,
  staff: SCHOOL_SCOPE,
  student: SCHOOL_SCOPE,
  parent: SCHOOL_SCOPE,
};

// A super_admin outside an impersonation session has no tenant, so it cannot
// be shown school modules at all.
const canReachSchoolScope = (role, impersonating) =>
  ROLE_SCOPE[role] === SCHOOL_SCOPE || impersonating;

export const canSeeNavigation = (
  item,
  user,
  role,
  { impersonating = false, readOnly = false } = {},
) => {
  const scope = ROLE_SCOPE[role] || SCHOOL_SCOPE;

  if (item.scope === PLATFORM_SCOPE) {
    return scope === PLATFORM_SCOPE && (!item.roles || item.roles.includes(role));
  }

  if (!canReachSchoolScope(role, impersonating)) return false;

  // Read-only impersonation: an item gated on a write permission stays hidden.
  // The wildcard list means hasPermission is always true for super_admin, so
  // the action suffix — not the permission check — is what has to be inspected.
  if (readOnly && impersonating && item.perm && !item.perm.endsWith(":read")) {
    return false;
  }
  if (item.perm && !hasPermission(user, item.perm)) return false;
  if (item.roles && !item.roles.includes(role)) return false;
  // Optional staff-designation filter (e.g. Admission Counsellor workspace).
  if (item.designation && String(user?.designation || "") !== item.designation)
    return false;
  return true;
};