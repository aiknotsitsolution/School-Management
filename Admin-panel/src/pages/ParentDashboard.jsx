import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  CalendarCheck,
  BookOpenCheck,
  Wallet,
  Bell,
  ClipboardList,
  PartyPopper,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { api } from "../lib/api";
import {
  PageIntro,
  Card,
  StatCard,
  Button,
} from "../components/UI";

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
}

export default function ParentDashboard() {
  const [data, setData] = useState({ children: [], diary: [], notices: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      api.students.list(),
      api.diary.list("limit=5"),
      api.notices.list(),
      api.notifications.list("limit=5"),
    ]).then((results) => {
      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : []);
      const children = value(0) || [];
      const diary = value(1) || [];
      const notices = value(2) || [];
      const notifications = value(3) || [];
      setData({ children, diary, notices, notifications });
      if (results.some((r) => r.status === "rejected" && results.indexOf(r) === 0)) {
        setError("Some data could not be loaded. Please try again.");
      }
      setLoading(false);
    });
  }, []);

const { children, diary, notices, notifications } = data;
const unread = useMemo(
    () => (notifications || []).filter((n) => !n.read).length,
    [notifications],
  );

  const quickLinks = children.length === 0
    ? [
        { to: "/notice-board", icon: ClipboardList, label: "Notices" },
        { to: "/events", icon: PartyPopper, label: "Events" },
        { to: "/online-payment", icon: Wallet, label: "Fees & Payments" },
        { to: "/messages", icon: CalendarDays, label: "Message Teacher" },
      ]
    : [
        { to: "/attendance", icon: CalendarCheck, label: "Attendance" },
        { to: "/report-card", icon: BookOpenCheck, label: "Results & Report Card" },
        { to: "/notice-board", icon: ClipboardList, label: "Notices" },
        { to: "/diary", icon: BookOpen, label: "Class Diary" },
        { to: "/events", icon: PartyPopper, label: "Events" },
        { to: "/online-payment", icon: Wallet, label: "Fees & Payments" },
        { to: "/messages", icon: CalendarDays, label: "Message Teacher" },
        { to: "/notifications", icon: Bell, label: "Notifications" },
      ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Parent Portal"
        title="Your Children at a Glance"
        description={
          loading
            ? "Loading your children's updates..."
            : "Attendance, results, diary and circulars for your linked children."
        }
        right={
          <Link to="/messages">
            <Button variant="outline">
              <CalendarDays size={15} /> Message a Teacher
            </Button>
          </Link>
        }
      />

      {error && <Card><p className="text-sm text-alert">{error}</p></Card>}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Children" value={String(children.length)} sub={children.length ? "linked children" : "no linked children"} accent="primary" />
        <StatCard icon={ClipboardList} label="Notices" value={String(notices.length)} sub="available to you" accent="info" />
        <StatCard icon={BookOpen} label="Diary Entries" value={String(diary.length)} sub="recent class diary" accent="success" />
        <StatCard icon={Bell} label="Unread" value={String(unread)} sub={unread ? "new notifications" : "all caught up"} accent="alert" />
      </div>

      {/* Children */}
      <Card title="My Children" action={<GraduationCap size={16} className="text-slate-text/50" />}>
        {children.length === 0 ? (
          <p className="text-[13px] text-slate-text py-6 text-center">
            No children are linked to this account yet. Ask the school admin to link
            your children&apos;s Admission IDs to your login.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {children.map((child) => (
              <div key={child._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{child.name}</p>
                    <p className="text-[12px] text-slate-text/60 mt-0.5">
                      {child.admissionNo} · {child.class}
                      {child.section ? `-${child.section}` : ""} · {child.rollNo || "—"}
                    </p>
                  </div>
                  <GraduationCap size={18} className="text-primary shrink-0" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { to: `/attendance`, label: "Attendance" },
                    { to: `/report-card`, label: "Results" },
                    { to: `/homework`, label: "Homework" },
                    { to: `/notice-board`, label: "Notices" },
                    { to: `/diary`, label: "Diary" },
                  ].map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="text-[12px] font-semibold text-info hover:underline"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Recent diary */}
        <Card
          title="Latest Class Diary"
          action={
            <Link to="/diary" className="text-[12px] font-semibold text-info flex items-center gap-1">
              View all <ChevronRight size={13} />
            </Link>
          }
        >
          {diary.length === 0 ? (
            <p className="text-[13px] text-slate-text py-6 text-center">No diary entries yet.</p>
          ) : (
            <div className="space-y-2.5">
              {diary.slice(0, 5).map((d) => (
                <div key={d._id} className="py-2 border-b border-slate-200 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-semibold text-ink">{d.title}</p>
                    <p className="text-[11px] text-slate-text/60 shrink-0">
                      {fmtDate(d.date)} · {d.class}-{d.section}
                    </p>
                  </div>
                  <p className="text-[12.5px] text-slate-text mt-0.5 line-clamp-2">{d.body}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent notices */}
        <Card
          title="Recent Notices"
          action={
            <Link to="/notice-board" className="text-[12px] font-semibold text-info flex items-center gap-1">
              View all <ChevronRight size={13} />
            </Link>
          }
        >
          {notices.length === 0 ? (
            <p className="text-[13px] text-slate-text py-6 text-center">No notices yet.</p>
          ) : (
            <div className="space-y-2.5">
              {notices.slice(0, 5).map((n) => (
                <div key={n._id} className="py-2 border-b border-slate-200 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    {n.priority === "emergency" && (
                      <ShieldAlert size={14} className="text-alert shrink-0" />
                    )}
                    <p className="text-[13px] font-semibold text-ink">{n.title}</p>
                  </div>
                  <p className="text-[12.5px] text-slate-text mt-0.5 line-clamp-2">{n.description}</p>
                  <p className="text-[11px] text-slate-text/60 mt-1">{fmtDate(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick links */}
      <Card title="Quick Actions">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-primary/5 transition-colors border border-slate-200"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/12 text-primary-dark flex items-center justify-center shrink-0">
                <item.icon size={15} />
              </div>
              <span className="text-[13px] font-semibold text-ink">{item.label}</span>
              <ChevronRight size={14} className="ml-auto text-slate-text/40" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}