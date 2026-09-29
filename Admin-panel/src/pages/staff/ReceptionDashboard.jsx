import { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  Users,
  Megaphone,
  ArrowRight,
  ClipboardList,
  UserSearch,
  Sparkles,
  ShieldAlert,
  Bell,
  PhoneCall,
  MapPin,
  UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtDate } from "./useStaffContext";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  MetricCard,
  Panel,
  BarList,
  Badge,
  ListRow,
  EmptyPanel,
  DashboardSkeleton,
  ACCENTS,
  greeting,
} from "../../components/dashboard/DashKit";

const STATUS_TONE = {
  New: "info",
  Admitted: "success",
  Rejected: "alert",
  "Campus Visit Scheduled": "violet",
  "Follow Up": "warning",
};

const DESK_LINKS = [
  { to: "/reception/enquiries", icon: ClipboardList, label: "Admission enquiries", tone: ACCENTS.primary.icon },
  { to: "/reception/student-lookup", icon: UserSearch, label: "Student lookup", tone: ACCENTS.success.icon },
  { to: "/reception/notices", icon: Megaphone, label: "Notice board", tone: ACCENTS.info.icon },
  { to: "/reception/enquiries", icon: UserPlus, label: "Log a walk-in", tone: ACCENTS.violet.icon },
  { to: "/reception/notices", icon: Bell, label: "Publish notice", tone: ACCENTS.warn.icon },
];

export default function ReceptionDashboard() {
  const { school } = useStaffContext();
  const navigate = useNavigate();
  const [enquiries, setEnquiries] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([api.admissions.list(), api.notices.list()])
      .then(([e, n]) => {
        setEnquiries(e.status === "fulfilled" ? e.value.data || [] : []);
        setNotices(n.status === "fulfilled" ? n.value.data || [] : []);
        if (e.status === "rejected") toast(e.value?.message, "error");
        if (n.status === "rejected") toast(n.value?.message, "error");
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const byStatus = {};
    enquiries.forEach((q) => {
      byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    });
    const sources = {};
    enquiries.forEach((q) => {
      sources[q.source] = (sources[q.source] || 0) + 1;
    });
    return {
      total: enquiries.length,
      byStatus,
      new: byStatus["New"] || 0,
      admitted: byStatus["Admitted"] || 0,
      sources,
    };
  }, [enquiries]);

  const conversionRate =
    stats.total > 0 ? Math.round((stats.admitted / stats.total) * 100) : 0;
  const emergencyNotices = notices.filter((n) => n.priority === "emergency");
  const sourceItems = Object.entries(stats.sources)
    .filter(([source]) => source && source !== "undefined")
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        gradient="sky"
        eyebrow={`${greeting()} · Reception Workspace`}
        name="Front Desk"
        title={school?.name || "Reception"}
        meta="The first voice of the school — greet visitors, log every walk-in enquiry and keep parents informed."
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        quote="Welcome everyone who walks through our gate — that is the whole job."
        quoteTitle="Front office"
        right={
          <>
            <GlassStat value={stats.total} label="Enquiries" />
            <GlassStat value={stats.new} label="To follow up" />
            <GlassStat value={notices.length} label="Notices" />
          </>
        }
      />

      <QuickActions
        title="Front Desk Shortcuts"
        icon={Sparkles}
        columns={5}
        action={
          <button
            type="button"
            onClick={() => navigate("/reception/enquiries")}
            className="inline-flex items-center gap-2 rounded-xl bg-info px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
          >
            Manage Enquiries <ArrowRight size={14} />
          </button>
        }
        items={DESK_LINKS}
      />

      {loading ? (
        <DashboardSkeleton metricCols={4} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <MetricCard
              icon={Inbox}
              label="Total enquiries"
              value={stats.total}
              sub="all admission leads"
              accent="info"
            />
            <MetricCard
              icon={PhoneCall}
              label="New to follow up"
              value={stats.new}
              sub={stats.new ? "uncontacted leads" : "all contacted"}
              accent={stats.new > 0 ? "warn" : "success"}
            />
            <MetricCard
              icon={Users}
              label="Admitted"
              value={stats.admitted}
              sub={`${conversionRate}% conversion rate`}
              accent="success"
              progress={conversionRate}
            />
            <MetricCard
              icon={Megaphone}
              label="Active notices"
              value={notices.length}
              sub={
                emergencyNotices.length ? (
                  <span className="font-semibold text-rose-500">
                    {emergencyNotices.length} emergency
                  </span>
                ) : (
                  "currently published"
                )
              }
              accent={emergencyNotices.length ? "alert" : "violet"}
            />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Recent enquiries"
              icon={Inbox}
              iconTone={ACCENTS.primary.icon}
              subtitle="Latest walk-ins and phone leads"
              className="lg:col-span-2"
              action={
                <button
                  type="button"
                  onClick={() => navigate("/reception/enquiries")}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-info transition-colors hover:text-blue-700"
                >
                  View all <ArrowRight size={14} />
                </button>
              }
            >
              {enquiries.length === 0 ? (
                <EmptyPanel
                  icon={Inbox}
                  iconTone={ACCENTS.neutral.icon}
                  title="No enquiries yet"
                  text="Log walk-ins and phone leads so the admissions team can follow up."
                  action={
                    <button
                      type="button"
                      onClick={() => navigate("/reception/enquiries")}
                      className="rounded-xl bg-info px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      Log an enquiry
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {enquiries.slice(0, 6).map((q) => (
                    <ListRow
                      key={q._id}
                      icon={UserPlus}
                      iconTone={
                        q.status === "New" ? ACCENTS.warn.icon : ACCENTS.primary.icon
                      }
                      title={q.childName || "—"}
                      meta={`Class ${q.classApplied || "—"} · ${q.contact || "—"} · ${fmtDate(q.createdAt)}`}
                      trailing={<Badge tone={STATUS_TONE[q.status] || "neutral"}>{q.status}</Badge>}
                    />
                  ))}
                </div>
              )}
            </Panel>

            <div className="space-y-5">
              <Panel
                title="Enquiry sources"
                icon={MapPin}
                iconTone={ACCENTS.violet.icon}
                subtitle="Where families hear about us"
              >
                {sourceItems.length === 0 ? (
                  <EmptyPanel
                    icon={MapPin}
                    iconTone={ACCENTS.neutral.icon}
                    title="No source data"
                    text="Sources will be summarised once enquiries carry a source."
                  />
                ) : (
                  <BarList
                    accent="violet"
                    showPct={false}
                    items={sourceItems.map(([source, count]) => ({
                      label: source,
                      value: count,
                    }))}
                  />
                )}
              </Panel>

              <Panel
                title="Notice board"
                icon={Megaphone}
                iconTone={ACCENTS.info.icon}
                subtitle={`${notices.length} published`}
                action={
                  <button
                    type="button"
                    onClick={() => navigate("/reception/notices")}
                    className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-info transition-colors hover:text-blue-700"
                  >
                    Open <ArrowRight size={14} />
                  </button>
                }
              >
                {notices.length === 0 ? (
                  <EmptyPanel
                    icon={Megaphone}
                    iconTone={ACCENTS.neutral.icon}
                    title="No notices published"
                    text="Notices you publish will be visible to every parent instantly."
                  />
                ) : (
                  <div className="space-y-2.5">
                    {notices.slice(0, 4).map((n) => (
                      <ListRow
                        key={n._id}
                        icon={n.priority === "emergency" ? ShieldAlert : Megaphone}
                        iconTone={
                          n.priority === "emergency" ? ACCENTS.alert.icon : ACCENTS.info.icon
                        }
                        title={n.title}
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
          </div>
        </>
      )}
    </div>
  );
}
