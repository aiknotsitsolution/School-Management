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
    },
    logout() {
      return {
        accessToken: null,
        refreshToken: null,
        user: null,
        school: null,
        activeSchoolId: null,
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
  logout,
} = authSlice.actions;

export default authSlice.reducer;