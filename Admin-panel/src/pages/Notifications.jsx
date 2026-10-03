import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  FileClock,
  Wallet,
  Megaphone,
  UserRound,
  Briefcase,
  BookOpen,
  GraduationCap,
  BadgeCheck,
  CalendarDays,
} from "lucide-react";
import { PageIntro, Card, Button, Pill, toast } from "../components/UI";
import PageArtwork from "../components/PageArtwork";
import { api } from "../lib/api";

const KIND_META = {
  notice: { icon: Megaphone, tone: "info", label: "Notice" },
  leave: { icon: FileClock, tone: "primary", label: "Leave" },
  payroll: { icon: Wallet, tone: "success", label: "Payroll" },
  student: { icon: UserRound, tone: "info", label: "Student" },
  staff: { icon: Briefcase, tone: "primary", label: "Staff" },
  homework: { icon: BookOpen, tone: "info", label: "Homework" },
  exam: { icon: GraduationCap, tone: "primary", label: "Exam" },
  profile: { icon: BadgeCheck, tone: "success", label: "Profile" },
  event: { icon: CalendarDays, tone: "info", label: "Event" },
  fee_reminder: { icon: Wallet, tone: "alert", label: "Fee Reminder" },
  emergency: { icon: Bell, tone: "alert", label: "Emergency" },
  diary: { icon: BookOpen, tone: "info", label: "Class Diary" },
  message: { icon: CalendarDays, tone: "primary", label: "Message" },
  sms: { icon: Megaphone, tone: "primary", label: "SMS" },
  system: { icon: Bell, tone: "neutral", label: "System" },
};

const fmtFull = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export default function Notifications() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const refresh = () => {
    setLoading(true);
    api.notifications
      .list("limit=100")
      .then(({ data }) => setRecords(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const unsubscribe = api.notifications.subscribe({ onData: () => refresh() });
    return unsubscribe;
  }, []);

  const unreadCount = useMemo(() => records.filter((n) => !n.read).length, [records]);
  const visible = useMemo(
    () => (filter === "unread" ? records.filter((n) => !n.read) : records),
    [records, filter],
  );

  const open = async (item) => {
    if (!item.read) {
      api.notifications
        .markRead(item._id)
        .then(() => setRecords((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n))))
        .catch(() => {});
    }
    if (item.link) navigate(item.link);
  };

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setRecords((prev) => prev.map((n) => ({ ...n, read: true })));
      toast("All notifications marked as read", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Inbox"
        title="Notifications" art="notices"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
            : "Everything that needs your attention, in one place."
        }
        action={
          unreadCount > 0 ? (
            <Button variant="ghost" onClick={markAllRead}>
              <CheckCheck size={15} /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <Card title={`Inbox (${records.length})`}>
        <div className="flex items-center gap-2 mb-4">
          {["all", "unread"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors capitalize ${
                filter === f
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-text border-slate-300 hover:bg-paper"
              }`}
            >
              {f === "unread" ? `Unread${unreadCount ? ` (${unreadCount})` : ""}` : "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="py-14 text-center">
            <PageArtwork name="notices" size={64} className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-ink">No notifications</p>
            <p className="text-[13px] text-slate-text/70 mt-1">
              {filter === "unread" ? "You're all caught up." : "New updates will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((item) => {
              const meta = KIND_META[item.kind] || KIND_META.system;
              const Icon = meta.icon;
              return (
                <button
                  key={item._id}
                  onClick={() => open(item)}
                  className={`w-full text-left flex items-start gap-3 px-1 py-3 hover:bg-paper/60 rounded-lg transition-colors ${item.read ? "opacity-60" : ""} ${
                    item.kind === "emergency" ? "bg-alert/5 ring-1 ring-alert/25" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-paper border border-slate-200 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-ink" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>}
                      <p className="text-[13px] font-semibold text-ink truncate">{item.title}</p>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                    {item.message && (
                      <p className="text-[12px] text-slate-text/70 mt-0.5 line-clamp-2">{item.message}</p>
                    )}
                    {item.link && (
                      <p className="text-[11px] text-primary/80 mt-0.5 truncate">{item.link}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-text/50 mt-0.5">
                    {fmtFull(item.createdAt)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}