import { useEffect, useMemo, useRef, useState } from "react";
import { Search, UserPlus, Users, UserMinus, Route } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Select,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";

export default function Allocations() {
  const [routes, setRoutes] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Guards against an earlier, slower search response overwriting a newer one.
  const searchSeq = useRef(0);

  const refresh = () => {
    setLoading(true);
    api.transport
      .list()
      .then(({ data }) => setRoutes(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  // Search-as-you-type used to fire a request per keystroke. Debounced here and
  // the stale-response guard keeps the dropdown consistent with the input.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setStudents([]);
      return undefined;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(() => {
      api.students
        .list(`q=${encodeURIComponent(q)}&limit=10`)
        .then(({ data }) => {
          if (seq === searchSeq.current) setStudents(data || []);
        })
        .catch((e) => {
          if (seq === searchSeq.current) toast(e.message, "error");
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const active = routes.find((r) => r._id === selectedRoute);

  const assign = async (student) => {
    setBusy(true);
    try {
      await api.transport.assign(active._id, { studentId: student.admissionNo });
      toast(`${student.name} assigned to Route ${active.routeNo}`, "success");
      setStudents([]);
      setSearch("");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  // Unassign is a separate backend verb: $addToSet alone cannot remove a student.
  const unassign = async (admissionNo) => {
    setBusy(true);
    try {
      await api.transport.unassign(active._id, { studentId: admissionNo });
      toast("Student removed from route", "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  // The roster names come from the backend (which resolves admission numbers
  // through the internal student-service channel), so this page no longer shows
  // a column of bare admission numbers.
  const roster = useMemo(() => {
    if (!active) return [];
    if (Array.isArray(active.roster) && active.roster.length > 0) {
      return active.roster;
    }
    return (active.assignedStudents || []).map((id) => ({ admissionNo: id, name: null }));
  }, [active]);

  if (loading) {
    return <p className="text-[13px] text-slate-text py-10 text-center">Loading allocations…</p>;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Transport Workspace"
        title="Student Allocations"
        description="Assign students to bus routes."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Allocation Slots" value={String(routes.reduce((s, r) => s + (r.assignedStudents?.length || 0), 0))} sub="Assigned across routes" accent="info" />
        <StatCard icon={Users} label="Routes with Students" value={String(routes.filter((r) => r.assignedStudents?.length > 0).length)} accent="primary" />
        <StatCard icon={Users} label="Routes Empty" value={String(routes.filter((r) => !r.assignedStudents || r.assignedStudents.length === 0).length)} accent="alert" />
        <StatCard icon={Route} label="Routes" value={String(routes.length)} accent="success" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Assign Students" action={<UserPlus size={15} className="text-slate-text/40" />}>
          <div className="space-y-3">
            <Select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
              <option value="">Select a route…</option>
              {routes.map((r) => (
                <option key={r._id} value={r._id}>
                  Route {r.routeNo} · {r.assignedStudents?.length || 0} students
                </option>
              ))}
            </Select>
            {active && (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search student by name / admission no"
                    className="pl-8 w-full"
                  />
                </div>
                {students.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {(students || []).map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        disabled={busy}
                        onClick={() => assign(s)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-paper flex items-center justify-between disabled:opacity-50"
                      >
                        <span className="text-[13px]">
                          <b className="text-ink">{s.name}</b>
                          <span className="text-slate-text/60 ml-2">{s.admissionNo}</span>
                        </span>
                        <span className="text-[12px] text-info font-semibold">Assign</span>
                      </button>
                    ))}
                  </div>
                )}
                {active.assignedStudents?.length > 0 && (
                  <p className="text-[12px] text-slate-text/70">
                    <b className="text-ink">{active.assignedStudents.length}</b> students currently on Route {active.routeNo}.
                  </p>
                )}
              </>
            )}
          </div>
        </Card>

        <Card title="Assigned Students">
          {!active ? (
            <p className="text-[13px] text-slate-text py-10 text-center">Select a route to see its roster.</p>
          ) : roster.length === 0 ? (
            <p className="text-[13px] text-slate-text py-10 text-center">No students on Route {active.routeNo} yet.</p>
          ) : (
            <div className="space-y-2">
              {roster.map((s) => (
                <div
                  key={s.admissionNo}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink truncate">
                      {s.name || "Name unavailable"}
                    </span>
                    <span className="block text-[11.5px] text-slate-text/60 font-mono">
                      {s.admissionNo}
                      {s.class ? ` · Class ${s.class}` : ""}
                      {s.section ? `-${s.section}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => unassign(s.admissionNo)}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-text/60 hover:text-alert disabled:opacity-40"
                  >
                    <UserMinus size={12} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}