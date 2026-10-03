import { createSlice } from "@reduxjs/toolkit";

function readLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialState = {
  accessToken: localStorage.getItem("erp_access_token") || null,
  refreshToken: localStorage.getItem("erp_refresh_token") || null,
  user: readLS("erp_user"),
  school: readLS("erp_school"),
  activeSchoolId: localStorage.getItem("erp_active_school") || null,
  // When the platform owner impersonates a school, writes are blocked by
  // default and must be opted into explicitly. Cross-tenant writes are the
  // expensive mistake: soft delete makes them recoverable, but a payroll edit
  // or a fee write is not something a support session should cause by accident.
  impersonateReadOnly: localStorage.getItem("erp_impersonate_readonly") !== "0",
  // Campus the user is currently looking at. Sent as X-Branch-Id on every API
  // call; "all" means the school-wide (unfiltered) admin view.
  activeBranchId: localStorage.getItem("erp_active_branch") || null,
  isAuthenticated: Boolean(localStorage.getItem("erp_access_token")),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { accessToken, refreshToken, user, school } = action.payload;
      state.accessToken = accessToken ?? state.accessToken;
      state.refreshToken = refreshToken ?? state.refreshToken;
      if (user) state.user = user;
      if (school !== undefined) state.school = school;
      state.isAuthenticated = Boolean(state.accessToken);
    },
    setTokens(state, action) {
      state.accessToken = action.payload.accessToken ?? state.accessToken;
      state.refreshToken = action.payload.refreshToken ?? state.refreshToken;
      state.isAuthenticated = Boolean(state.accessToken);
    },
    setUser(state, action) {
      state.user = action.payload;
    },
    setSchool(state, action) {
      state.school = action.payload;
    },
    // Platform (super_admin) impersonation: pick which school to operate on.
    setActiveSchoolId(state, action) {
      state.activeSchoolId = action.payload || null;
      // A branch belongs to one school, so switching school invalidates it.
      state.activeBranchId = null;
      // Re-arm the read-only guardrail for the newly selected school rather than
      // inheriting "editing enabled" from the previous one.
      state.impersonateReadOnly = true;
      try {
        localStorage.setItem("erp_impersonate_readonly", "1");
      } catch {
        // private mode / storage disabled: redux state still holds it
      }
    },
    setImpersonateReadOnly(state, action) {
      state.impersonateReadOnly = Boolean(action.payload);
      try {
        localStorage.setItem(
          "erp_impersonate_readonly",
          state.impersonateReadOnly ? "1" : "0",
        );
      } catch {
        // private mode / storage disabled: redux state still holds it
      }
    },
    // Campus switcher selection. Persisted so a reload keeps the same campus.
    setActiveBranchId(state, action) {
      state.activeBranchId = action.payload || null;
      try {
        if (action.payload) localStorage.setItem("erp_active_branch", action.payload);
        else localStorage.removeItem("erp_active_branch");
      } catch {
        // private mode / storage disabled: redux state still holds it
      }
    },
    logout() {
      return {
        accessToken: null,
        refreshToken: null,
        user: null,
        school: null,
        activeSchoolId: null,
        activeBranchId: null,
        impersonateReadOnly: true,
        isAuthenticated: false,
      };
    },
  },
});

export const {
  setCredentials,
  setTokens,
  setUser,
  setSchool,
  setActiveSchoolId,
  setActiveBranchId,
  setImpersonateReadOnly,
  logout,
} = authSlice.actions;

export default authSlice.reducer;