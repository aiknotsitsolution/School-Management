import { useMemo, useState, useEffect } from "react";
import {
  Check,
  X,
  Clock3,
  Download,
  CalendarCheck,
  Search,
  UserCheck,
  UserX,
  Timer,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Avatar,
  StatCard,
  Pill,
} from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  CartesianGrid,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import { useMasterOptions } from "../hooks/useMasterOptions";

const CLASS_OPTIONS_FALLBACK = [
  "Nursery",
  "LKG",
  "UKG",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11-Sci",
  "11-Com",
  "12-Sci",
  "12-Com",
];

const SECTION_OPTIONS_FALLBACK = ["A", "B", "C"];

const DEFAULT_STATUSES = ["Present", "Absent", "Late", "Leave"];
const STATUS_TONES = { present: "success", absent: "alert", late: "amber", leave: "info" };
const STATUS_LABELS = { present: "P", absent: "A", late: "L", leave: "Lv" };
const ACTIVE_STYLES = {
  present: "bg-success text-white border-success",
  absent: "bg-alert text-white border-alert",
  late: "bg-amber text-ink border-amber",
  leave: "bg-info text-white border-info",
};
const API_STATUS_MAP = { present: "Present", absent: "Absent", late: "Half Day", leave: "Leave" };

function formatClassLabel(c) {
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  if (c.startsWith("11") || c.startsWith("12")) return `Class ${c}`;
  return `Class ${c}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Attendance() {
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: SECTION_OPTIONS, rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const { options: attendanceStatusOptions } = useMasterOptions("attendance-statuses", DEFAULT_STATUSES);
  const [students, setStudents] = useState([]);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [cls, setCls] = useState("8");
  const [section, setSection] = useState("A");
  const [query, setQuery] = useState("");
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [date] = useState(todayLabel());

  const statusConfig = useMemo(() => {
    const cfg = {};
    attendanceStatusOptions.forEach((name) => {
      const key = name.toLowerCase().replace(/\s+/g, "_");
      cfg[key] = {
        label: STATUS_LABELS[key] || name.charAt(0),
        full: name,
        tone: STATUS_TONES[key] || "neutral",
      };
    });
    return cfg;
  }, [attendanceStatusOptions]);
  const filteredSections = useMemo(() => {
    if (!cls || cls === "All") return SECTION_OPTIONS;
    return [...new Set(rawSections.filter((s) => s.className === cls).map((s) => s.name))];
  }, [cls, SECTION_OPTIONS, rawSections]);

  useEffect(() => {
    Promise.all([api.students.list("limit=1000"), api.attendance.list()])
      .then(([studentResponse, attendanceResponse]) => {
        const loadedStudents = (studentResponse.data || []).map((student) => ({
          ...student,
          id: student._id,
          roll: Number(student.rollNo || 0),
          avatar: student.photoUrl,
        }));
        const records = attendanceResponse.data || [];
        const grouped = new Map();
        records.forEach((record) => {
          const key = new Date(record.date).toISOString().slice(0, 7);
          const current = grouped.get(key) || {
            total: 0,
            present: 0,
            date: record.date,
          };
          current.total += 1;
          if (record.status === "Present") current.present += 1;
          grouped.set(key, current);
        });
        setStudents(loadedStudents);
        setAttendanceTrend(
          [...grouped.values()].map((item) => ({
            month: new Date(item.date).toLocaleDateString("en-IN", {
              month: "short",
            }),
            attendance: item.total
              ? Math.round((item.present / item.total) * 100)
              : 0,
          })),
        );

        const today = new Date().toISOString().slice(0, 10);
        const existing = {};
        records
          .filter(
            (record) =>
              new Date(record.date).toISOString().slice(0, 10) === today,
          )
          .forEach((record) => {
            existing[record.studentId] =
              record.status === "Present"
                ? "present"
                : record.status === "Absent"
                  ? "absent"
                  : record.status === "Leave"
                    ? "leave"
                    : "late";
          });
        setMarks(existing);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  const list = useMemo(() => {
    return students
      .filter((s) => s.class === cls && s.section === section)
      .filter(
        (s) =>
          !query ||
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          String(s.roll).includes(query) ||
          s.id.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => a.roll - b.roll);
  }, [cls, section, query]);

  const [attPage, setAttPage] = useState(1);
  const [attPageSize, setAttPageSize] = useState(20);
  const attTotalPages = Math.max(1, Math.ceil(list.length / attPageSize));
  const attSafePage = Math.min(attPage, attTotalPages);
  const paginatedList = useMemo(() => {
    const start = (attSafePage - 1) * attPageSize;
    return list.slice(start, start + attPageSize);
  }, [list, attSafePage, attPageSize]);

  // Reset marks when class/section changes
  useEffect(() => {
    setMarks({});
    setSaved(false);
    setAttPage(1);
  }, [cls, section, query]);

  const setMark = (id, val) => {
    setMarks((m) => ({ ...m, [id]: val }));
    setSaved(false);
  };

  const markAll = (status) => {
    const next = {};
    list.forEach((s) => {
      next[s.id] = status;
    });
    setMarks(next);
    setSaved(false);
  };

  const getStatus = (id) => marks[id] || "present";

  const counts = useMemo(() => {
    const c = {};
    Object.keys(statusConfig).forEach((k) => { c[k] = 0; });
    list.forEach((s) => {
      const st = getStatus(s.id);
      c[st] = (c[st] || 0) + 1;
    });
    return c;
  }, [list, marks, statusConfig]);

  const handleSave = async () => {
    if (list.length === 0) {
      setError("No students found for this class and section.");
      return;
    }
    try {
      await api.attendance.mark(
        list.map((student) => ({
          studentId: student.id,
          class: student.class,
          section: student.section,
          date: new Date().toISOString().slice(0, 10),
          status: {
            present: "Present",
            absent: "Absent",
            late: "Half Day",
            leave: "Leave",
          }[getStatus(student.id)],
        })),
      );
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const exportRegister = () => {
    if (list.length === 0) return;
    const headers = [
      "Admission No",
      "Name",
      "Class",
      "Section",
      "Roll",
      "Status",
    ];
    const rows = list.map((s) => [
      s.id,
      s.name,
      s.class,
      s.section,
      s.roll,
      (statusConfig[getStatus(s.id)] || {}).full || "Present",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            return /[",\n]/.test(value)
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${cls}-${section}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Attendance"
        description="Mark and monitor daily attendance across classes and sections."
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportRegister}>
              <Download size={15} /> Export Register
            </Button>
          </div>
        }
      />
      {error && <p className="text-alert text-[13px]">{error}</p>}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(statusConfig).slice(0, 4).map(([key, cfg]) => (
          <StatCard
            key={key}
            icon={key === "present" ? UserCheck : key === "absent" ? UserX : key === "late" ? Timer : CheckCircle2}
            label={cfg.full}
            value={String(counts[key] || 0)}
            sub={
              list.length && key === "present"
                ? `${Math.round(((counts[key] || 0) / list.length) * 100)}% of class`
                : `${counts[key] || 0} students`
            }
            accent={cfg.tone === "success" ? "success" : cfg.tone === "alert" ? "alert" : cfg.tone === "amber" ? "amber" : "info"}
          />
        ))}
      </div>

      {/* Trend Chart */}
      <Card title="Monthly Attendance Trend (School-wide)">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={attendanceTrend}
            margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3F8F5F" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#3F8F5F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#EEEAE0"
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[80, 100]}
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #E5E2D9",
                fontSize: 13,
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
              formatter={(value) => [`${value}%`, "Attendance"]}
            />
            <Area
              type="monotone"
              dataKey="attendance"
              stroke="#3F8F5F"
              strokeWidth={2.5}
              fill="url(#attGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Marking Panel */}
      <Card
        title={
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span>Daily Attendance Register</span>
            <span className="text-[12.5px] font-normal text-slate-text/70">
              {date}
            </span>
          </div>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search name / roll..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-44 sm:w-52"
              />
            </div>
            <SearchableSelect
              options={CLASS_OPTIONS}
              value={cls}
              onChange={(v) => { setCls(v); setSection(filteredSections[0] || ""); }}
              renderLabel={(c) => formatClassLabel(c)}
              placeholder="Select class"
              className="min-w-[140px]"
            />
            <SearchableSelect
              options={filteredSections}
              value={section}
              onChange={setSection}
              renderLabel={(s) => `Section ${s}`}
              placeholder="Section"
              className="min-w-[120px]"
            />
          </div>
        }
      >
        {/* Quick actions + legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-black/6">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => markAll("present")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-success/10 text-success hover:bg-success/20 transition-colors"
            >
              <Check size={13} /> Mark All Present
            </button>
            <button
              onClick={() => markAll("absent")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-alert/10 text-alert hover:bg-alert/20 transition-colors"
            >
              <X size={13} /> Mark All Absent
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-[11.5px] text-slate-text/70">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-success" /> Present
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-alert" /> Absent
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber" /> Late
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-info" /> Leave
            </span>
          </div>
        </div>

        {/* Student list */}
        {list.length === 0 ? (
          <div className="py-14 text-center">
            <AlertCircle
              size={36}
              className="mx-auto text-slate-text/30 mb-3"
            />
            <p className="text-[14px] font-medium text-ink">
              No students found
            </p>
            <p className="text-[13px] text-slate-text/60 mt-1">
              Try a different class, section, or clear the search.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {paginatedList.map((s) => {
              const status = getStatus(s.id);
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 py-3 hover:bg-paper/60 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <Avatar src={s.avatar} name={s.name} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-ink truncate">
                        {s.name}
                      </p>
                      <Pill tone="neutral">#{s.roll}</Pill>
                    </div>
                    <p className="text-[11.5px] text-slate-text/60 mt-0.5">
                      {s.id} · {s.gender} · {s.house} House
                    </p>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {Object.entries(statusConfig).map(([key, cfg]) => {
                      const isActive = status === key;
                      return (
                        <button
                          key={key}
                          title={cfg.full}
                          onClick={() => setMark(s.id, key)}
                          className={`w-9 h-9 rounded-lg text-[12px] font-bold border transition-all ${
                            isActive
                              ? (ACTIVE_STYLES[key] || "bg-ink text-white border-ink")
                              : "bg-white text-slate-text/55 border-black/10 hover:bg-paper hover:border-black/20"
                          }`}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {list.length > attPageSize && (
          <div className="flex items-center justify-between pt-4 mt-3 border-t border-black/[0.04]">
            <p className="text-[12px] text-slate-text/55">
              Showing {list.length === 0 ? 0 : (attSafePage - 1) * attPageSize + 1}–{Math.min(attSafePage * attPageSize, list.length)} of {list.length}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={attPageSize}
                onChange={(e) => { setAttPageSize(Number(e.target.value)); setAttPage(1); }}
                className="text-[12px] border border-black/[0.08] rounded-lg px-2 py-1.5 bg-paper text-ink"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
              <Button variant="outline" className="px-3 py-1.5 text-[12px]" disabled={attSafePage <= 1} onClick={() => setAttPage((p) => Math.max(1, p - 1))}>
                Prev
              </Button>
              <span className="text-[12px] text-ink font-medium">{attSafePage} / {attTotalPages}</span>
              <Button variant="outline" className="px-3 py-1.5 text-[12px]" disabled={attSafePage >= attTotalPages} onClick={() => setAttPage((p) => Math.min(attTotalPages, p + 1))}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Footer actions */}
        {list.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-black/6">
            <div className="text-[12.5px] text-slate-text/70">
              Showing <strong className="text-ink">{list.length}</strong>{" "}
              students{" "}
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <span key={key}>
                  · {cfg.full}{" "}
                  <strong className={`text-${cfg.tone === "success" ? "success" : cfg.tone === "alert" ? "alert" : cfg.tone === "amber" ? "amber-dark" : "info"}`}>
                    {counts[key] || 0}
                  </strong>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                  <CheckCircle2 size={16} /> Attendance saved
                </span>
              )}
              <Button variant="amber" onClick={handleSave}>
                <Check size={15} /> Save Attendance
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Quick tip */}
      <div className="rounded-xl bg-ink/5 border border-ink/10 px-4 py-3.5 text-[13px] text-slate-text">
        <strong className="text-ink">Tip:</strong> Default status is Present.
        Use the P / A / L / Lv buttons to mark each student. Changes are sent to
        the backend when you click <strong>Save Attendance</strong>.
      </div>
    </div>
  );
}

// import { useMemo, useState } from "react";
// import { Check, X, Clock3, Download, CalendarCheck } from "lucide-react";
// import { PageIntro, Card, Button, Select, Avatar, StatCard } from "../components/UI";
// import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip, CartesianGrid, YAxis } from "recharts";

// const classShortMap = { "Class 1":"1","Class 2":"2","Class 3":"3","Class 4":"4","Class 5":"5","Class 6":"6","Class 7":"7","Class 8":"8","Class 9":"9","Class 10":"10" };

// export default function Attendance() {
//   const [cls, setCls] = useState("8");
//   const [section, setSection] = useState("A");
//   const list = useMemo(
//     () => students.filter((s) => s.class === cls && s.section === section),
//     [cls, section]
//   );
//   const [marks, setMarks] = useState({});

//   const setMark = (id, val) => setMarks((m) => ({ ...m, [id]: val }));
//   const present = list.filter((s) => (marks[s.id] || "present") === "present").length;

//   return (
//     <div className="space-y-6">
//       <PageIntro
//         eyebrow="Academics"
//         title="Attendance"
//         description="Mark and monitor daily attendance across classes."
//         right={
//           <Button variant="outline"><Download size={15} /> Export Register</Button>
//         }
//       />

//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         <StatCard icon={CalendarCheck} label="School Average Today" value="96.2%" sub="1,024 of 1,065 present" accent="success" />
//         <StatCard icon={Check} label="Selected Class Present" value={`${present}/${list.length}`} accent="amber" />
//         <StatCard icon={Clock3} label="Late Arrivals" value="14" sub="Before 9:15 AM cutoff" accent="info" />
//         <StatCard icon={X} label="On Leave (Approved)" value="9" accent="alert" />
//       </div>

//       <Card title="Weekly Attendance Trend">
//         <ResponsiveContainer width="100%" height={180}>
//           <AreaChart data={attendanceTrend} margin={{ left: -20 }}>
//             <defs>
//               <linearGradient id="a2" x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="0%" stopColor="#3F8F5F" stopOpacity={0.3} />
//                 <stop offset="100%" stopColor="#3F8F5F" stopOpacity={0} />
//               </linearGradient>
//             </defs>
//             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEAE0" />
//             <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#475467" }} axisLine={false} tickLine={false} />
//             <YAxis domain={[80, 100]} tick={{ fontSize: 12, fill: "#475467" }} axisLine={false} tickLine={false} />
//             <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #eee", fontSize: 12.5 }} />
//             <Area type="monotone" dataKey="attendance" stroke="#3F8F5F" strokeWidth={2.5} fill="url(#a2)" />
//           </AreaChart>
//         </ResponsiveContainer>
//       </Card>

//       <Card
//         title={`Mark Attendance — ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`}
//         action={
//           <div className="flex gap-2">
//             <Select value={cls} onChange={(e) => setCls(e.target.value)}>
//               {["1","2","3","4","5","6","7","8","9","10"].map((c) => <option key={c} value={c}>Class {c}</option>)}
//             </Select>
//             <Select value={section} onChange={(e) => setSection(e.target.value)}>
//               {["A","B","C"].map((s) => <option key={s} value={s}>Section {s}</option>)}
//             </Select>
//           </div>
//         }
//       >
//         <div className="divide-y divide-black/[0.06]">
//           {list.length === 0 && <p className="text-sm text-slate-text py-6 text-center">No students found for this class/section.</p>}
//           {list.map((s) => {
//             const status = marks[s.id] || "present";
//             return (
//               <div key={s.id} className="flex items-center gap-3 py-3">
//                 <Avatar src={s.avatar} name={s.name} size={36} />
//                 <div className="flex-1 min-w-0">
//                   <p className="text-[13.5px] font-semibold text-ink truncate">{s.name}</p>
//                   <p className="text-[11.5px] text-slate-text/60">Roll No. {s.roll}</p>
//                 </div>
//                 <div className="flex gap-1.5">
//                   {[
//                     { key: "present", label: "P", tone: "success" },
//                     { key: "absent", label: "A", tone: "alert" },
//                     { key: "late", label: "L", tone: "amber" },
//                   ].map((btn) => (
//                     <button
//                       key={btn.key}
//                       onClick={() => setMark(s.id, btn.key)}
//                       className={`w-9 h-9 rounded-lg text-[12.5px] font-bold border transition-colors ${
//                         status === btn.key
//                           ? btn.tone === "success" ? "bg-success text-white border-success"
//                           : btn.tone === "alert" ? "bg-alert text-white border-alert"
//                           : "bg-amber text-ink border-amber"
//                           : "bg-white text-slate-text/60 border-black/10 hover:bg-paper"
//                       }`}
//                     >
//                       {btn.label}
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//         {list.length > 0 && (
//           <div className="flex justify-end mt-4 pt-4 border-t border-black/[0.06]">
//             <Button variant="amber">Save Attendance</Button>
//           </div>
//         )}
//       </Card>
//     </div>
//   );
// }
