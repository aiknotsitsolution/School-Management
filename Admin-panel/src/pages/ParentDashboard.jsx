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
  ShieldAlert,
  Megaphone,
  Phone,
  Heart,
  Sparkles,
  Trophy,
  Zap,
  MessageSquare,
} from "lucide-react";
import { api } from "../lib/api";
import { StatCard, Avatar } from "../components/UI";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  Panel,
  ViewLink,
  EmptyPanel,
  ListRow,
  Badge,
  DashboardSkeleton,
  ACCENTS,
  greeting,
} from "../components/dashboard/DashKit";

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
}

const CHILD_ACTIONS = [
  { label: "Attendance", icon: CalendarCheck, tone: ACCENTS.success.icon },
  { label: "Results", icon: Trophy, tone: ACCENTS.warn.icon },
  { label: "Homework", icon: BookOpenCheck, tone: ACCENTS.violet.icon },
  { label: "Notices", icon: Megaphone, tone: ACCENTS.alert.icon },
  { label: "Diary", icon: BookOpen, tone: ACCENTS.teal.icon },
];

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

  const pinnedNotices = useMemo(
    () =>
      [...(notices || [])]
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, 4),
    [notices],
  );

  const emergencyCount = useMemo(
    () => (notices || []).filter((n) => n.priority === "emergency").length,
    [notices],
  );

  const quickLinks = children.length === 0
    ? [
        { to: "/notice-board", icon: ClipboardList, label: "Notices", tone: ACCENTS.alert.icon },
        { to: "/events", icon: PartyPopper, label: "Events", tone: ACCENTS.violet.icon },
        { to: "/online-payment", icon: Wallet, label: "Fees & Payments", tone: ACCENTS.success.icon },
        { to: "/messages", icon: CalendarDays, label: "Message Teacher", tone: ACCENTS.info.icon },
      ]
    : [
        { to: "/attendance", icon: CalendarCheck, label: "Attendance", tone: ACCENTS.success.icon },
        { to: "/report-card", icon: BookOpenCheck, label: "Results & Report Card", tone: ACCENTS.warn.icon },
        { to: "/notice-board", icon: ClipboardList, label: "Notices", tone: ACCENTS.alert.icon },
        { to: "/diary", icon: BookOpen, label: "Class Diary", tone: ACCENTS.teal.icon },
        { to: "/events", icon: PartyPopper, label: "Events", tone: ACCENTS.violet.icon },
        { to: "/online-payment", icon: Wallet, label: "Fees & Payments", tone: ACCENTS.success.icon },
        { to: "/messages", icon: CalendarDays, label: "Message Teacher", tone: ACCENTS.info.icon },
        { to: "/notifications", icon: Bell, label: "Notifications", tone: ACCENTS.info.icon },
      ];

  const heroTitle = children.length
    ? children.length === 1
      ? children[0].name.split(" ")[0]
      : `${children.length} Children`
    : "Parent Portal";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <HeroBanner
        gradient="plum"
        eyebrow={greeting()}
        name="Parent"
        title={heroTitle}
        meta={
          children.length
            ? children
                .map(
                  (c) =>
                    `${c.name.split(" ")[0]} · Class ${c.class}${c.section ? `-${c.section}` : ""}`,
                )
                .join("  •  ")
            : "Ask the school admin to link your children's Admission IDs"
        }
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        quote="Education is the most powerful weapon which you can use to change the world."
        quoteTitle="Parent portal"
        right={
          <>
            <GlassStat value={children.length} label="Children" />
            <GlassStat value={unread} label="Unread alerts" />
            <GlassStat value={notices.length} label="Notices" />
          </>
        }
      />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600"
        >
          {error}
        </div>
      )}

      <QuickActions
        title="Quick Actions"
        icon={Zap}
        action={
          <Link
            to="/messages"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50"
          >
            <MessageSquare size={14} /> Message a Teacher
          </Link>
        }
        items={quickLinks}
        columns={8}
      />

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* ── Metric strip ───────────────────────────────────────── */}
          <MetricGrid columns={4}>
            <StatCard
              icon={GraduationCap}
              label="Children"
              value={String(children.length)}
              sub={children.length ? "linked children" : "no linked children"}
              accent="primary"
            />
            <StatCard
              icon={ClipboardList}
              label="Notices"
              value={String(notices.length)}
              sub={
                emergencyCount ? (
                  <span className="font-semibold text-rose-500">
                    {emergencyCount} emergency
                  </span>
                ) : (
                  "available to you"
                )
              }
              accent="info"
            />
            <StatCard
              icon={BookOpen}
              label="Diary Entries"
              value={String(diary.length)}
              sub="recent class diary"
              accent="success"
            />
            <StatCard
              icon={Bell}
              label="Unread"
              value={String(unread)}
              sub={
                unread ? (
                  <span className="font-semibold text-rose-500">new notifications</span>
                ) : (
                  "all caught up"
                )
              }
              accent="alert"
            />
          </MetricGrid>

          {/* ── Children ───────────────────────────────────────────── */}
          <Panel
            title="My Children"
            icon={GraduationCap}
            iconTone={ACCENTS.primary.icon}
            subtitle={
              children.length
                ? `${children.length} child${children.length === 1 ? "" : "ren"} linked to this account`
                : "No children linked yet"
            }
          >
            {children.length === 0 ? (
              <EmptyPanel
                icon={Heart}
                iconTone={ACCENTS.alert.icon}
                title="No children linked yet"
                text="Ask the school admin to link your children's Admission IDs to your login."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {children.map((child) => (
                  <div
                    key={child._id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_14px_30px_-20px_rgba(124,58,237,0.55)]"
                  >
                    <span
                      className="pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full bg-violet-50"
                      aria-hidden="true"
                    />
                    <div className="relative flex items-start gap-3">
                      <Avatar src={child.photoUrl} name={child.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[15px] font-bold text-ink">
                          {child.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-text/70">
                          Class {child.class}
                          {child.section ? `-${child.section}` : ""}
                          {child.rollNo ? ` · Roll ${child.rollNo}` : ""}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-600">
                          {child.admissionNo}
                        </span>
                      </div>
                    </div>
                    <div className="relative mt-3.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                      {CHILD_ACTIONS.map((action) => (
                        <span
                          key={action.label}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-text transition-colors hover:bg-slate-100"
                        >
                          <action.icon size={12} className="text-slate-400" aria-hidden="true" />
                          {action.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ── Diary + notices ───────────────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Latest Class Diary"
              icon={BookOpen}
              iconTone={ACCENTS.teal.icon}
              subtitle="What happened in class recently"
              action={<ViewLink to="/diary">View all</ViewLink>}
            >
              {diary.length === 0 ? (
                <EmptyPanel
                  icon={BookOpen}
                  iconTone={ACCENTS.teal.icon}
                  title="No diary entries yet"
                  text="Class teachers' daily diary entries will appear here."
                />
              ) : (
                <div className="space-y-2.5">
                  {diary.slice(0, 5).map((d) => (
                    <ListRow
                      key={d._id}
                      icon={BookOpen}
                      iconTone={ACCENTS.teal.icon}
                      title={d.title}
                      description={d.body}
                      meta={`${fmtDate(d.date)} · Class ${d.class}-${d.section}`}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Recent Notices"
              icon={Megaphone}
              iconTone={ACCENTS.alert.icon}
              subtitle={
                emergencyCount
                  ? `${emergencyCount} emergency notice${emergencyCount === 1 ? "" : "s"}`
                  : "Circulars and announcements"
              }
              action={<ViewLink to="/notice-board">View all</ViewLink>}
            >
              {notices.length === 0 ? (
                <EmptyPanel
                  icon={Megaphone}
                  iconTone={ACCENTS.alert.icon}
                  title="No notices yet"
                  text="School announcements and circulars will appear here."
                />
              ) : (
                <div className="space-y-2.5">
                  {pinnedNotices.map((n) => (
                    <ListRow
                      key={n._id}
                      icon={n.priority === "emergency" ? ShieldAlert : Megaphone}
                      iconTone={
                        n.priority === "emergency" ? ACCENTS.alert.icon : ACCENTS.neutral.icon
                      }
                      title={n.title}
                      description={n.description}
                      meta={fmtDate(n.createdAt)}
                      trailing={
                        n.priority === "emergency" ? (
                          <Badge tone="alert">Emergency</Badge>
                        ) : n.pinned ? (
                          <Badge tone="info">Pinned</Badge>
                        ) : null
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* ── Notifications ──────────────────────────────────────── */}
          <Panel
            title="Recent Notifications"
            icon={Bell}
            iconTone={ACCENTS.info.icon}
            subtitle="Updates pushed to you by the school"
            action={<ViewLink to="/notifications">All notifications</ViewLink>}
          >
            {notifications.length === 0 ? (
              <EmptyPanel
                icon={Sparkles}
                iconTone={ACCENTS.success.icon}
                title="You're all caught up"
                text="New notifications from teachers and the office will show up here."
              />
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2">
                {notifications.slice(0, 6).map((n) => (
                  <ListRow
                    key={n._id}
                    icon={Bell}
                    iconTone={n.read ? ACCENTS.neutral.icon : ACCENTS.info.icon}
                    title={n.title || n.message || "Notification"}
                    description={n.body || n.message || ""}
                    meta={fmtDate(n.createdAt)}
                    trailing={!n.read ? <Badge tone="info">New</Badge> : null}
                    className={n.read ? "opacity-70" : ""}
                  />
                ))}
              </div>
            )}
          </Panel>

          {/* ── Help strip ─────────────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Phone,
                title: "Reach the office",
                text: "Call the school office for urgent queries about fees or admissions.",
                tone: ACCENTS.info.icon,
              },
              {
                icon: MessageSquare,
                title: "Message a teacher",
                text: "Send a message about your child's progress directly to the class teacher.",
                tone: ACCENTS.violet.icon,
              },
              {
                icon: CalendarDays,
                title: "Track the calendar",
                text: "See events, PTM schedules and holidays in one place.",
                tone: ACCENTS.warn.icon,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                  aria-hidden="true"
                >
                  <item.icon size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink">{item.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-text/70">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
