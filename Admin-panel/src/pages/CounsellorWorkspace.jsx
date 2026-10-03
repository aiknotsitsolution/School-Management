import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Users,
  ClipboardCheck,
  UserCheck,
  Plus,
  PhoneCall,
  CalendarClock,
  TrendingUp,
  Search,
  ArrowRight,
  Sparkles,
  UserPlus,
  BadgeCheck,
  TimerReset,
  MapPin,
  UserCog,
  Inbox,
} from "lucide-react";
import { api } from "../lib/api";
import { Input, toast } from "../components/UI";
import { selectUser } from "../store/selectors";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  MetricCard,
  Panel,
  Badge,
  ListRow,
  EmptyPanel,
  InlineLoader,
  ACCENTS,
  greeting,
} from "../components/dashboard/DashKit";

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const today = () => new Date().toISOString().slice(0, 10);

const isOpen = (enquiry) => !["Admitted", "Rejected"].includes(enquiry.status);

const QUICK_LINKS = [
  { to: "/addstudent", icon: UserPlus, label: "New admission", accent: "primary" },
  { to: "/students", icon: Users, label: "All students", accent: "info" },
  { to: "/students/complete", icon: BadgeCheck, label: "Complete profiles", accent: "success" },
  { to: "/admission-enquiry", icon: ClipboardCheck, label: "Admission pipeline", accent: "violet" },
  { to: "/attendance", icon: TrendingUp, label: "Track attendance", accent: "warn" },
];

export default function CounsellorWorkspace() {
  const user = useSelector(selectUser);
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState({
    totalEnquiries: 0,
    followUpsDue: 0,
    scheduledVisits: 0,
    conversionRate: 0,
    recentEnquiries: [],
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term), 350);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    api.students
      .counsellorStats()
      .then(({ data }) => setStats(data))
      .catch((err) => toast(err.message, "error"));
  }, []);

  useEffect(() => {
    api.admissions
      .list()
      .then(({ data }) => {
        const enquiries = Array.isArray(data) ? data : [];
        const followUpsDue = enquiries.filter(
          (e) => e.followUpDate && new Date(e.followUpDate).toISOString().slice(0, 10) <= today() && isOpen(e),
        ).length;
        const scheduledVisits = enquiries.filter(
          (e) => e.status === "Campus Visit Scheduled",
        ).length;
        const admitted = enquiries.filter((e) => e.status === "Admitted").length;
        const conversionRate =
          enquiries.length > 0 ? Math.round((admitted / enquiries.length) * 100) : 0;
        setPipeline({
          totalEnquiries: enquiries.length,
          followUpsDue,
          scheduledVisits,
          conversionRate,
          recentEnquiries: enquiries.slice(0, 5),
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedTerm.trim()) params.set("q", debouncedTerm.trim());
    params.set("limit", "50");
    api.students
      .list(params.toString())
      .then((result) => {
        setRows(result.data || []);
        setTotal(result.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [debouncedTerm]);

  const dueFollowUps = pipeline.recentEnquiries.filter(
    (e) => e.followUpDate && new Date(e.followUpDate).toISOString().slice(0, 10) <= today() && isOpen(e),
  );
  const campusVisits = pipeline.recentEnquiries.filter(
    (e) => e.status === "Campus Visit Scheduled",
  );
  const incomplete = rows.filter((r) => r.profileStatus !== "complete").length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        gradient="violet"
        eyebrow={`${greeting()} · ${user?.name || "Admission Counsellor"}`}
        name="Admissions"
        title="Counsellor Workspace"
        meta="Turn every enquiry into an admission — complete profiles, schedule campus visits and never miss a follow-up."
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        quote="A parent's first conversation with a school decides everything that follows."
        quoteTitle="Admissions desk"
        right={
          <>
            <GlassStat value={stats?.total ?? 0} label="Students" />
            <GlassStat value={stats?.incomplete ?? 0} label="Incomplete" />
            <GlassStat value={`${pipeline.conversionRate}%`} label="Conversion" />
          </>
        }
      />

      <QuickActions
        title="Admissions Shortcuts"
        icon={Sparkles}
          action={
            <Link
            to="/addstudent"
            className="inline-flex items-center gap-2 rounded-xl bg-info px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
          >
            <Plus size={14} /> New student
          </Link>
        }
        items={QUICK_LINKS}
      />

      <MetricGrid columns={4}>
            <MetricCard
              icon={Users}
              label="Total students"
              value={stats?.total ?? 0}
              sub="in this school"
              accent="primary"
              to="/students"
            />
            <MetricCard
              icon={ClipboardCheck}
              label="Incomplete profiles"
              value={stats?.incomplete ?? 0}
              sub={stats?.incomplete ? "need your attention" : "all caught up"}
              accent="info"
              progress={stats?.total ? (stats.complete / stats.total) * 100 : 0}
            />
            <MetricCard
              icon={UserCheck}
              label="Completed profiles"
              value={stats?.complete ?? 0}
              sub="ready to use"
              accent="success"
            />
            <MetricCard
              icon={TrendingUp}
              label="Total enquiries"
              value={pipeline.totalEnquiries}
              sub={`${pipeline.conversionRate}% converted to admission`}
              accent="violet"
            />
          </MetricGrid>

          <MetricGrid columns={4}>
            <MetricCard
              icon={PhoneCall}
              label="Follow-ups due"
              value={pipeline.followUpsDue}
              sub={pipeline.followUpsDue ? "call them today" : "none pending"}
              accent={pipeline.followUpsDue > 0 ? "alert" : "success"}
            />
            <MetricCard
              icon={CalendarClock}
              label="Campus visits"
              value={pipeline.scheduledVisits}
              sub="scheduled"
              accent="primary"
            />
            <MetricCard
              icon={UserCog}
              label="Profiles to finish"
              value={incomplete}
              sub="in the list below"
              accent="warn"
            />
            <MetricCard
              icon={BadgeCheck}
              label="Recently created"
              value={stats?.recent?.length ?? 0}
              sub={stats?.recent?.[0] ? `latest · ${stats.recent[0].name}` : "no students yet"}
              accent="neutral"
            />
          </MetricGrid>

          {(dueFollowUps.length > 0 || campusVisits.length > 0) && (
            <div className="grid gap-5 lg:grid-cols-2">
              {pipeline.followUpsDue > 0 && (
                <Panel
                  title="Follow-ups due"
                  icon={TimerReset}
                  iconTone={ACCENTS.alert.icon}
                  subtitle={`${pipeline.followUpsDue} enquiry${pipeline.followUpsDue === 1 ? "" : "ies"} waiting on a call`}
                  decor="phone"
                  decorTone={ACCENTS.warn.text}
                >
                  {dueFollowUps.length ? (
                    <div className="space-y-2.5">
                      {dueFollowUps.slice(0, 4).map((e) => (
                        <ListRow
                          key={e._id}
                          icon={PhoneCall}
                          iconTone={ACCENTS.alert.icon}
                          title={e.childName}
                          meta={`${e.classApplied} · follow up ${fmtDate(e.followUpDate)}`}
                          trailing={<Badge tone="alert">Due</Badge>}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel
                      icon={PhoneCall}
                      iconTone={ACCENTS.success.icon}
                      title="Nothing overdue"
                      text="Every enquiry with a follow-up date has been contacted."
                    />
                  )}
                </Panel>
              )}

              {pipeline.scheduledVisits > 0 && (
                <Panel
                  title="Campus visits scheduled"
                  icon={MapPin}
                  iconTone={ACCENTS.violet.icon}
                  subtitle={`${pipeline.scheduledVisits} famil${pipeline.scheduledVisits === 1 ? "y" : "ies"} expected on campus`}
                  decor="pin"
                  decorTone={ACCENTS.info.text}
                >
                  {campusVisits.length ? (
                    <div className="space-y-2.5">
                      {campusVisits.slice(0, 4).map((e) => (
                        <ListRow
                          key={e._id}
                          icon={MapPin}
                          iconTone={ACCENTS.violet.icon}
                          title={e.childName}
                          meta={`${e.classApplied} · ${e.visitDate ? fmtDate(e.visitDate) : "date to confirm"}`}
                          trailing={<Badge tone="violet">Visit</Badge>}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyPanel
                      icon={MapPin}
                      iconTone={ACCENTS.neutral.icon}
                      title="No visits scheduled"
                      text="Mark an enquiry as “Campus Visit Scheduled” to plan the visit here."
                    />
                  )}
                </Panel>
              )}
            </div>
          )}

          <Panel
            title="Search admitted students"
            icon={Inbox}
            iconTone={ACCENTS.info.icon}
            subtitle={
              loading
                ? "Loading…"
                : `${total} result${total === 1 ? "" : "s"} · open a profile to complete it`
            }
            bodyClassName="px-5 sm:px-6 pb-5 pt-4"
            decor="search"
            decorTone={ACCENTS.violet.text}
          >
            <div className="relative mb-4 max-w-md">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50"
                aria-hidden="true"
              />
              <Input
                placeholder="Search by Admission ID or name…"
                className="pl-9"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
              />
            </div>

            {loading ? (
              <InlineLoader label="Searching students…" />
            ) : rows.length === 0 ? (
              <EmptyPanel
                icon={Search}
                iconTone={ACCENTS.neutral.icon}
                title="No students match this search"
                text="Try a different name or Admission ID, or clear the search to see everyone."
                action={
                  term ? (
                    <button
                      type="button"
                      onClick={() => setTerm("")}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-bold text-slate-700 transition-colors hover:border-slate-300"
                    >
                      Clear search
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11.5px] uppercase tracking-wide text-slate-text/60">
                      <th className="py-2.5 pr-4 font-semibold">Student</th>
                      <th className="py-2.5 pr-4 font-semibold">Admission ID</th>
                      <th className="py-2.5 pr-4 font-semibold">Class · Section</th>
                      <th className="py-2.5 pr-4 font-semibold">Profile</th>
                      <th className="py-2.5 pr-4 font-semibold">Joined</th>
                      <th className="py-2.5 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((student) => (
                      <tr key={student._id} className="transition-colors hover:bg-slate-50/70">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-ink">{student.name}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="rounded bg-paper px-2 py-1 font-mono text-[12.5px]">
                            {student.admissionNo}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-text/80">
                          {student.class ? `${student.class} · ${student.section || "—"}` : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            tone={student.profileStatus === "complete" ? "success" : "primary"}
                          >
                            {student.profileStatus === "complete" ? "complete" : "incomplete"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap py-3 pr-4 text-slate-text/70">
                          {fmtDate(student.createdAt)}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to={`/students/complete/${student._id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-info/10 px-2.5 py-1.5 text-[12px] font-semibold text-info hover:bg-info/20"
                          >
                            Open profile <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {stats?.recent?.length ? (
            <Panel
              title="Recently created students"
              icon={Sparkles}
              iconTone={ACCENTS.success.icon}
              subtitle="Fresh admissions added to the roll"
              decor="people"
              decorTone={ACCENTS.success.text}
            >
              <div className="grid gap-2.5 sm:grid-cols-3">
                {stats.recent.slice(0, 3).map((s) => (
                  <ListRow
                    key={s._id}
                    icon={UserPlus}
                    iconTone={ACCENTS.success.icon}
                    title={s.name}
                    meta={s.admissionNo}
                    to={`/students/complete/${s._id}`}
                  />
                ))}
              </div>
        </Panel>
      ) : null}
    </div>
  );
}
