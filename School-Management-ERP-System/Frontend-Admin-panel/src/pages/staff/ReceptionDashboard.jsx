import { useEffect, useMemo, useState } from "react";
import {
  Inbox,
  Users,
  Megaphone,
  ArrowRight,
  ClipboardList,
  UserSearch,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageIntro, Card, StatCard, Button, Pill, toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtDate } from "./useStaffContext";

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
    enquiries.forEach((q) => { byStatus[q.status] = (byStatus[q.status] || 0) + 1; });
    const sources = {};
    enquiries.forEach((q) => { sources[q.source] = (sources[q.source] || 0) + 1; });
    return {
      total: enquiries.length,
      byStatus,
      new: byStatus["New"] || 0,
      admitted: byStatus["Admitted"] || 0,
      sources,
    };
  }, [enquiries]);

  if (loading) {
    return <p className="text-[13px] text-slate-text py-10 text-center">Loading reception…</p>;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Reception Workspace"
        title="Front Desk"
        description={`Welcome desk overview at ${school?.name || "your school"}.`}
        right={
          <Button variant="amber" onClick={() => navigate("/reception/enquiries")}>
            Manage Enquiries <ArrowRight size={15} />
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Inbox} label="Total Enquiries" value={String(stats.total)} sub="All admission leads" accent="info" />
        <StatCard icon={Users} label="New (to follow up)" value={String(stats.new)} sub="Uncontacted leads" accent="amber" />
        <StatCard icon={Users} label="Admitted" value={String(stats.admitted)} sub="Converted" accent="success" />
        <StatCard icon={Megaphone} label="Active Notices" value={String(notices.length)} sub="Currently published" accent="alert" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Recent Enquiries" action={<button onClick={() => navigate("/reception/enquiries")} className="text-[12px] font-semibold text-info hover:underline">View all</button>}>
          {enquiries.length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">No enquiries yet.</p>
          ) : (
            <div className="space-y-3">
              {enquiries.slice(0, 6).map((q) => (
                <div key={q._id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{q.childName || "—"}</p>
                    <p className="text-[12px] text-slate-text/60">
                      Class {q.classApplied || "—"} · {q.contact || "—"} · {fmtDate(q.createdAt)}
                    </p>
                  </div>
                  <Pill tone={q.status === "New" ? "info" : q.status === "Admitted" ? "success" : q.status === "Rejected" ? "alert" : "neutral"}>
                    {q.status}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Quick Actions">
          <div className="grid gap-3">
            <button
              onClick={() => navigate("/reception/enquiries")}
              className="flex items-center gap-3 bg-white rounded-xl border border-black/[0.06] p-4 hover:border-amber/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-amber/10 text-amber flex items-center justify-center"><ClipboardList size={17} /></div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-ink">Admission Enquiries</p>
                <p className="text-[12px] text-slate-text/70">Log walk-ins, follow up and update stages</p>
              </div>
              <ArrowRight size={16} className="text-slate-text/40" />
            </button>
            <button
              onClick={() => navigate("/reception/student-lookup")}
              className="flex items-center gap-3 bg-white rounded-xl border border-black/[0.06] p-4 hover:border-success/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center"><UserSearch size={17} /></div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-ink">Student Lookup</p>
                <p className="text-[12px] text-slate-text/70">Find a student by name or admission number</p>
              </div>
              <ArrowRight size={16} className="text-slate-text/40" />
            </button>
            <button
              onClick={() => navigate("/reception/notices")}
              className="flex items-center gap-3 bg-white rounded-xl border border-black/[0.06] p-4 hover:border-info/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-info/10 text-info flex items-center justify-center"><Megaphone size={17} /></div>
              <div className="flex-1">
                <p className="text-[13.5px] font-semibold text-ink">Notice Board</p>
                <p className="text-[12px] text-slate-text/70">Browse published notices</p>
              </div>
              <ArrowRight size={16} className="text-slate-text/40" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}