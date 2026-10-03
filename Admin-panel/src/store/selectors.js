import { useSelector } from "react-redux";

export const selectAuth = (state) => state.auth;
export const selectIsAuthenticated = (state) =>
  Boolean(state.auth.isAuthenticated || state.auth.accessToken);
export const selectUser = (state) => state.auth.user;
export const selectRole = (state) => state.auth.user?.role || null;
export const selectSchool = (state) => state.auth.school || null;
export const selectActiveSchoolId = (state) =>
  state.auth.activeSchoolId || (state.auth.school ? state.auth.school.id : null);

// Deliberately NOT the same shape as selectActiveSchoolId above: impersonation
// must mirror exactly what lib/api reads, which is the raw activeSchoolId with no
// fallback to the signed-in user's own school. If the nav believed a school was
// selected while the X-School-Id header was not being sent, the platform owner
// would see school modules whose requests 400 for want of tenant context.
export const selectImpersonating = (state) =>
  state.auth.user?.role === "super_admin" && Boolean(state.auth.activeSchoolId);
export const selectImpersonateReadOnly = (state) =>
  state.auth.impersonateReadOnly !== false;

export const useRole = () => useSelector(selectRole);