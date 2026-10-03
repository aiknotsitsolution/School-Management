import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  CalendarCheck,
  BookOpenCheck,
  Wallet,
  Bell,
  ClipboardList,
  PartyPopper,
  CalendarDays,
  ShieldAlert,
  Megaphone,
  Phone,
  Heart,
  Sparkles,
  Trophy,
  Zap,
  MessageSquare,
  Bus,
  MapPin,
  Navigation,
  Clock,
} from "lucide-react";
import { api } from "../lib/api";
import { StatCard, Avatar } from "../components/UI";
import FleetMap, { hasFix } from "../components/FleetMap";
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

// Matches the fleet view's poll cadence in BusTracking.jsx.
const BUS_REFRESH_MS = 30000;

const CHILD_ACTIONS = [
  { label: "Attendance", icon: CalendarCheck },
  { label: "Results", icon: Trophy },
  { label: "Homework", icon: BookOpenCheck },
  { label: "Notices", icon: Megaphone },
];

export default function ParentDashboard() {
  const [data, setData] = useState({ children: [], notices: [], notifications: [], busRoutes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The bus panel is a live view, so it refreshes on its own timer; the rest of
  // the dashboard is a one-shot load. Only the scoped /transport/me endpoint is
  // re-read, so a parent polling this page costs one small request.
  const loadBus = useCallback((silent = false) => {
    if (silent && document.visibilityState !== "visible") return;
    if (silent && typeof navigator.onLine !== "undefined" && !navigator.onLine) return;
    return api.transport
      .mine()
      .then(({ data: routes }) => {
        setData((prev) => ({ ...prev, busRoutes: routes || [] }));
      })
      .catch(() => {
        /* keep the last known position rather than blanking the panel */
      });
  }, []);

  useEffect(() => {
    Promise.allSettled([
      api.students.list(),
      api.notices.list(),
      api.notifications.list("limit=5"),
      // Scoped server-side from the parent's token (linked children only), so
      // this cannot be widened into the whole fleet.
      api.transport.mine(),
    ]).then((results) => {
      const value = (i) => (results[i].status === "fulfilled" ? results[i].value.data : []);
      const children = value(0) || [];
      const notices = value(1) || [];
      const notifications = value(2) || [];
      const busRoutes = value(3) || [];
      setData({ children, notices, notifications, busRoutes });
      if (results.some((r) => r.status === "rejected" && results.indexOf(r) === 0)) {
        setError("Some data could not be loaded. Please try again.");
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => loadBus(true), BUS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadBus]);

  const { children, notices, notifications, busRoutes } = data;
  const busRoute = busRoutes[0] || null;
  const busLive = busRoute?.live || {};
  const busLocated = hasFix(busRoute);
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
        { to: "/notice-board", icon: ClipboardList, label: "Notices", accent: "alert" },
        { to: "/events", icon: PartyPopper, label: "Events", accent: "violet" },
        { to: "/online-payment", icon: Wallet, label: "Fees & Payments", accent: "success" },
        { to: "/messages", icon: CalendarDays, label: "Message Teacher", accent: "info" },
      ]
    : [
        { to: "/attendance", icon: CalendarCheck, label: "Attendance", accent: "success" },
        { to: "/report-card", icon: BookOpenCheck, label: "Results & Report Card", accent: "warn" },
        { to: "/notice-board", icon: ClipboardList, label: "Notices", accent: "alert" },
        { to: "/events", icon: PartyPopper, label: "Events", accent: "violet" },
        { to: "/online-payment", icon: Wallet, label: "Fees & Payments", accent: "success" },
        { to: "/messages", icon: CalendarDays, label: "Message Teacher", accent: "info" },
        { to: "/notifications", icon: Bell, label: "Notifications", accent: "info" },
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
        stats={
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
            decor="people"
            decorTone={ACCENTS.teal.text}
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

          {/* ── School Bus ─────────────────────────────────────── */}
          <Panel
            title="School Bus"
            icon={Bus}
            iconTone={ACCENTS.teal.icon}
            subtitle={
              busRoute
                ? `Route ${busRoute.routeNo}${busRoute.vehicleNo ? ` · ${busRoute.vehicleNo}` : ""}`
                : "No route assigned"
            }
            decor="bus"
            decorTone={ACCENTS.teal.text}
          >
            {!busRoute ? (
              <EmptyPanel
                icon={Bus}
                iconTone={ACCENTS.teal.icon}
                title="No bus route assigned"
                text="If your child uses school transport, contact the transport department."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <FleetMap
                    className="min-h-[300px]"
                    routes={busLocated ? [busRoute] : []}
                    stops={busRoute.stops || []}
                    activeStopIndex={busLive.nextStopIndex ?? -1}
                  />
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-text/60">
                        <Navigation size={11} /> Status
                      </p>
                      <p className="mt-0.5 font-display text-[14px] font-bold text-ink">
                        {!busLocated ? "No signal" : busLive.stale ? "Last known" : "On the way"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-text/60">
                        <Clock size={11} /> ETA next stop
                      </p>
                      <p className="mt-0.5 font-display text-[14px] font-bold text-ink">
                        {busLive.etaMinutes != null ? `${busLive.etaMinutes} min` : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-slate-text/60">Next stop</p>
                    <p className="mt-0.5 text-[13.5px] font-bold text-ink">
                      {busLive.nextStop || "Not published"}
                    </p>
                    {busLive.distanceKm != null ? (
                      <p className="mt-0.5 text-[12px] text-slate-text/70">
                        {busLive.distanceKm} km away
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-slate-text/60">Driver</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[13.5px] font-bold text-ink">
                        {busRoute.driverName || "Not assigned"}
                      </span>
                      {busRoute.driverContact ? (
                        <a
                          href={`tel:${busRoute.driverContact.replace(/\s/g, "")}`}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11.5px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100"
                        >
                          <Phone size={11} /> Call
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {busRoute.stops?.length ? (
                    <ol className="space-y-1.5">
                      {busRoute.stops.map((stop, i) => (
                        <li
                          key={`${stop.sequence ?? i}-${stop.name}-${i}`}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${
                            busLive.nextStopIndex === i ? "bg-violet-50" : "bg-slate-50"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 shrink-0 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${
                              busLive.nextStopIndex === i ? "bg-violet-500" : "bg-slate-400"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate text-[12.5px] font-semibold text-ink">
                            {stop.name}
                          </span>
                          {stop.time ? (
                            <span className="shrink-0 text-[11px] text-slate-text/60">
                              {stop.time}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="flex items-center gap-2 text-[12px] text-slate-text/70">
                      <MapPin size={12} /> Stops have not been published for this route.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Panel>

          {/* ── Notices ──────────────────────────────────────────── */}
          <div>
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
              decor="broadcast"
              decorTone={ACCENTS.alert.text}
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
            decor="envelope"
            decorTone={ACCENTS.info.text}
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
