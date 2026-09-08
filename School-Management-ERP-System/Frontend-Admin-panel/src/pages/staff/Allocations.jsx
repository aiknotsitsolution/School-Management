import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Select,
  Button,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext from "./useStaffContext";

export default function Allocations() {
  const [routes, setRoutes] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    api.transport
      .list()
      .then(({ data }) => setRoutes(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const searchStudents = (q) => {
    if (!q.trim()) {
      setStudents([]);
      return;
    }
    api.students
      .list(`q=${encodeURIComponent(q)}&limit=10`)
      .then(({ data }) => setStudents(data || []))
      .catch((e) => toast(e.message, "error"));
  };

  const active = routes.find((r) => r._id === selectedRoute);

  const assign = async (student) => {
    try {
      await api.transport.assign(active._id, { studentId: student.admissionNo });
      toast(`${student.name} assigned to Route ${active.routeNo}`, "success");
      setStudents([]);
      setSearch("");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

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
        <StatCard icon={Users} label="Routes with Students" value={String(routes.filter((r) => r.assignedStudents?.length > 0).length)} accent="amber" />
        <StatCard icon={Users} label="Routes Empty" value={String(routes.filter((r) => !r.assignedStudents || r.assignedStudents.length === 0).length)} accent="alert" />
        <StatCard icon={null} label="Routes" value={String(routes.length)} accent="success" />
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
                    onChange={(e) => {
                      setSearch(e.target.value);
                      searchStudents(e.target.value);
                    }}
                    placeholder="Search student by name / admission no"
                    className="pl-8 w-full"
                  />
                </div>
                {students.length > 0 && (
                  <div className="border border-black/[0.06] rounded-xl overflow-hidden">
                    {(students || []).map((s) => (
                      <button
                        key={s._id}
                        onClick={() => assign(s)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-paper flex items-center justify-between"
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
          ) : (!active.assignedStudents || active.assignedStudents.length === 0) ? (
            <p className="text-[13px] text-slate-text py-10 text-center">No students on Route {active.routeNo} yet.</p>
          ) : (
            <div className="space-y-2">
              {(active.assignedStudents || []).map((id) => (
                <div key={id} className="flex items-center justify-between rounded-lg border border-black/[0.06] px-3.5 py-2.5">
                  <span className="text-[13px] font-semibold text-ink">{id}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}