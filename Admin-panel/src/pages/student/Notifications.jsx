import { useEffect, useState } from "react";
import { Bell, Inbox, CheckCheck } from "lucide-react";
import { PageIntro, Card, Button } from "../../components/UI";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StudentNotifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    api.notifications.list("limit=50")
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    await api.notifications.markAllRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const openItem = async (item) => {
    if (!item.read) {
      await api.notifications.markRead(item._id).catch(() => {});
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
    }
    navigate(item.link || "/student/notices");
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="School Services"
        title="Notifications"
        description="Stay updated with school announcements and alerts."
        right={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck size={15} /> Mark all read
            </Button>
          ) : null
        }
      />

      <Card title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}>
        {loading ? (
          <div className="py-14 text-center text-[13px] text-slate-text/60">Loading...</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center">
            <Inbox size={30} className="mx-auto text-slate-text/30 mb-2" />
            <p className="text-[13px] text-slate-text/60">No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 hover:bg-paper transition-colors ${n.read ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-amber shrink-0" />}
                  <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0">
                    <Bell size={16} className="text-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{n.title}</p>
                    {n.message && <p className="text-[12px] text-slate-text/70 line-clamp-2 mt-0.5">{n.message}</p>}
                  </div>
                  <span className="text-[10px] text-slate-text/50 shrink-0">{relativeTime(n.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
