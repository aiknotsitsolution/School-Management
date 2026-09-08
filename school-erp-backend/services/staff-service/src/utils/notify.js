// Pushes inbox notifications to the communication service using the acting
// admin's JWT. Failure is non-fatal: the originating admin action still
// completes if the notification push fails.
const COMM_URL = `http://localhost:${process.env.COMMUNICATION_SERVICE_PORT || 5006}`;

async function pushNotifications({ token, schoolId, userIds, title, message, kind = "system", link = null }) {
  const targets = [...new Set((userIds || []).map((u) => String(u)).filter(Boolean))];
  if (!token || targets.length === 0) return null;
  try {
    const res = await fetch(`${COMM_URL}/api/notifications/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-School-Id": String(schoolId || ""),
      },
      body: JSON.stringify({ userIds: targets, title, message, kind, link }),
    });
    if (!res.ok) throw new Error(`[notify] ${res.status} ${await res.text()}`);
    return await res.json();
  } catch (err) {
    console.error("[notification push skipped]", err.message);
    return null;
  }
}

module.exports = { pushNotifications };