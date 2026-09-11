import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users, ClipboardCheck, UserCheck, Plus, ArrowRight, PhoneCall, CalendarClock, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import {
  Button,
  Card,
  Input,
  PageIntro,
  Pill,
  StatCard,
  toast,
} from "../components/UI";
import { selectUser } from "../store/selectors";
import { useSelector } from "react-redux";

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

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
        const today = new Date().toISOString().slice(0, 10);
        const followUpsDue = enquiries.filter(
          (e) =>
            e.followUpDate &&
            new Date(e.followUpDate).toISOString().slice(0, 10) <= today &&
            !["Admitted", "Rejected"].includes(e.status),
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

  return (
    <div className="max-w-6xl">
      <PageIntro
        eyebrow={`${user?.name || "Admission Counsellor"} · Admissions`}
        title="Counsellor Workspace"
        description="Track every admitted student, complete their profiles, and hand them a working login — all tied to the school's Admission ID."
        right={
          <Link to="/addstudent">
            <Button variant="amber">
              <Plus size={15} /> New student
            </Button>
          </Link>
        }
      />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5">
          <StatCard
            icon={Users}
            label="Total students"
            value={stats.total}
            sub="in this school"
            accent="amber"
          />
          <StatCard
            icon={ClipboardCheck}
            label="Incomplete profiles"
            value={stats.incomplete}
            sub="need your attention"
            accent="info"
          />
          <StatCard
            icon={UserCheck}
            label="Completed profiles"
            value={stats.complete}
            sub="ready to use"
            accent="success"
          />
          <Card className="!p-0" bodyClassName="p-3.5">
            <p className="text-[11.5px] font-semibold text-slate-text/60 uppercase tracking-wide">
              Recently created
            </p>
            <div className="mt-2 space-y-2">
              {stats.recent?.length
                ? stats.recent.slice(0, 3).map((s) => (
                    <div key={s._id} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="text-ink font-medium truncate">{s.name}</span>
                      <span className="text-slate-text/60 shrink-0">{s.admissionNo}</span>
                    </div>
                  ))
                : <p className="text-[12.5px] text-slate-text/70">No students yet.</p>}
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5">
        <StatCard
          icon={TrendingUp}
          label="Total Enquiries"
          value={pipeline.totalEnquiries}
          sub="in pipeline"
          accent="info"
        />
        <StatCard
          icon={PhoneCall}
          label="Follow-ups Due"
          value={pipeline.followUpsDue}
          sub={pipeline.followUpsDue > 0 ? "need attention" : "none pending"}
          accent={pipeline.followUpsDue > 0 ? "alert" : "success"}
        />
        <StatCard
          icon={CalendarClock}
          label="Campus Visits"
          value={pipeline.scheduledVisits}
          sub="scheduled"
          accent="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion Rate"
          value={`${pipeline.conversionRate}%`}
          sub="enquiry → admission"
          accent="success"
        />
      </div>

      {(pipeline.followUpsDue > 0 || pipeline.scheduledVisits > 0) && (
        <Card title="Admission Pipeline" className="mb-5">
          <div className="grid sm:grid-cols-2 gap-4">
            {pipeline.followUpsDue > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-slate-text/60 uppercase tracking-wide mb-2">
                  Follow-ups Due
                </p>
                <div className="space-y-2">
                  {pipeline.recentEnquiries
                    .filter(
                      (e) =>
                        e.followUpDate &&
                        new Date(e.followUpDate).toISOString().slice(0, 10) <=
                          new Date().toISOString().slice(0, 10) &&
                        !["Admitted", "Rejected"].includes(e.status),
                    )
                    .slice(0, 4)
                    .map((e) => (
                      <div key={e._id} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="text-ink font-medium truncate">{e.childName}</span>
                        <span className="text-slate-text/60 shrink-0">{e.classApplied}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {pipeline.scheduledVisits > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-slate-text/60 uppercase tracking-wide mb-2">
                  Campus Visits Scheduled
                </p>
                <div className="space-y-2">
                  {pipeline.recentEnquiries
                    .filter((e) => e.status === "Campus Visit Scheduled")
                    .slice(0, 4)
                    .map((e) => (
                      <div key={e._id} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="text-ink font-medium truncate">{e.childName}</span>
                        <Pill tone="info">Visit</Pill>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Search admitted students" bodyClassName="p-5">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/50" />
          <Input
            placeholder="Search by Admission ID or name…"
            className="pl-9"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>

        <p className="text-[12px] text-slate-text/60 mt-3 mb-2">
          {loading ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wide text-slate-text/60 border-b border-black/[0.06]">
                <th className="py-2.5 pr-4 font-semibold">Student</th>
                <th className="py-2.5 pr-4 font-semibold">Admission ID</th>
                <th className="py-2.5 pr-4 font-semibold">Class · Section</th>
                <th className="py-2.5 pr-4 font-semibold">Profile</th>
                <th className="py-2.5 pr-4 font-semibold">Joined</th>
                <th className="py-2.5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {rows.map((student) => (
                <tr key={student._id}>
                  <td className="py-3 pr-4">
                    <p className="font-medium text-ink">{student.name}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-[12.5px] bg-paper px-2 py-1 rounded">
                      {student.admissionNo}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-text/80">
                    {student.class ? `${student.class} · ${student.section || "—"}` : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    {student.profileStatus === "complete" ? (
                      <Pill tone="success">complete</Pill>
                    ) : (
                      <Pill tone="amber">incomplete</Pill>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-text/70 whitespace-nowrap">
                    {fmtDate(student.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      to={`/students/complete/${student._id}`}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-info bg-info/10 px-2.5 py-1.5 rounded-lg hover:bg-info/20"
                    >
                      Open profile <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[13px] text-slate-text/70">
                    No students match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}