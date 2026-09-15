import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

// Persist the auth slice back to the legacy localStorage keys so existing
// components, the api layer, and a full page reload all stay in sync.
// Tokens are stored as raw strings (legacy format); user/school as JSON.
store.subscribe(() => {
  const { auth } = store.getState();
  const raw = (key, value) => {
    if (!value) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  };
  const json = (key, value) => {
    if (!value) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  };

  raw("erp_access_token", auth.accessToken);
  raw("erp_refresh_token", auth.refreshToken);
  json("erp_user", auth.user);
  json("erp_school", auth.school);
  raw("erp_active_school", auth.activeSchoolId);
});

export default store;