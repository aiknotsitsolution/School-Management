// Navigation scope model.
//
// The ERP is a multi-tenant SaaS. A user belongs to a scope:
//   - "platform": SaaS-level (super_admin / Platform Owner)
//   - "school":   operates inside one tenant school
//
// Authorization (what a user MAY do) is separate from navigation visibility
// (which modules the UI shows). super_admin keeps full wildcard authorization
// in permissions.js, but navigation is filtered by scope so school-level ERP
// modules are never surfaced to the Platform Owner.

import { hasPermission } from "./permissions";

export const PLATFORM_SCOPE = "platform";
export const SCHOOL_SCOPE = "school";

const ROLE_SCOPE = {
  super_admin: PLATFORM_SCOPE,
  school_admin: SCHOOL_SCOPE,
  admin: SCHOOL_SCOPE,
  class_teacher: SCHOOL_SCOPE,
  teacher: SCHOOL_SCOPE,
  staff: SCHOOL_SCOPE,
  student: SCHOOL_SCOPE,
  parent: SCHOOL_SCOPE,
};

export const canSeeNavigation = (item, user, role) => {
  const scope = ROLE_SCOPE[role] || SCHOOL_SCOPE;

  if (item.scope === PLATFORM_SCOPE) {
    return scope === PLATFORM_SCOPE && (!item.roles || item.roles.includes(role));
  }

  if (scope !== SCHOOL_SCOPE) return false;
  if (item.perm && !hasPermission(user, item.perm)) return false;
  if (item.roles && !item.roles.includes(role)) return false;
  return true;
};