import { useSelector } from "react-redux";

export const selectAuth = (state) => state.auth;
export const selectIsAuthenticated = (state) =>
  Boolean(state.auth.isAuthenticated || state.auth.accessToken);
export const selectUser = (state) => state.auth.user;
export const selectRole = (state) => state.auth.user?.role || null;
export const selectSchool = (state) => state.auth.school || null;
export const selectActiveSchoolId = (state) =>
  state.auth.activeSchoolId || (state.auth.school ? state.auth.school.id : null);

export const useRole = () => useSelector(selectRole);