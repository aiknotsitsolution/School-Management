import { store } from "../store";
import { setTokens } from "../store/authSlice";

// Centralised access-token refresh.
//
// Lives in its own module rather than in api.js because both the REST client
// and the Socket.IO client need it, and api.js already imports the socket
// module — keeping it here means neither has to import the other.
//
// Render cold-starts can take 30-60 s. We retry with exponential back-off and
// coalesce concurrent callers so only ONE network request is in flight.

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "https://school-management-production-e239.up.railway.app/api";

let refreshPromise = null;
let refreshTimer = null;
let refreshRetries = 0;
const MAX_REFRESH_RETRIES = 6;

function doRefresh(refreshToken) {
  if (!refreshToken)
    return Promise.resolve({ ok: false, body: { success: false, message: "No refresh token" } });
  if (!refreshPromise) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    })
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .catch(() => ({ ok: false, body: { success: false, message: "Refresh timeout" } }))
      .finally(() => { clearTimeout(timeout); refreshPromise = null; });
  }
  return refreshPromise;
}

async function refreshAccessToken() {
  const rt = store.getState().auth.refreshToken || localStorage.getItem("erp_refresh_token");
  if (!rt) return false;
  try {
    const { ok, body } = await doRefresh(rt);
    if (ok && body.data?.accessToken) {
      store.dispatch(setTokens({
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
      }));
      refreshRetries = 0;
      scheduleRefresh();
      return true;
    }
  } catch {
    // network / timeout — fall through to retry
  }
  return false;
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  const { auth } = store.getState();
  const token = auth.accessToken;
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    const retryLater = () => {
      refreshRetries++;
      if (refreshRetries < MAX_REFRESH_RETRIES) {
        const delay = Math.min(5000 * Math.pow(1.5, refreshRetries - 1), 60_000);
        setTimeout(() => scheduleRefresh(), delay);
      }
    };
    if (msUntilExpiry <= 0) {
      refreshAccessToken().then((ok) => { if (!ok) retryLater(); });
      return;
    }
    const refreshIn = Math.max(msUntilExpiry - 5 * 60 * 1000, 10_000);
    refreshTimer = setTimeout(async () => {
      const ok = await refreshAccessToken();
      if (!ok) retryLater();
    }, refreshIn);
  } catch {
    // malformed token — will be caught by 401 handler
  }
}

scheduleRefresh();

export { refreshAccessToken, scheduleRefresh };
