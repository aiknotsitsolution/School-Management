import { useMemo, useState, useEffect } from "react";
import {
  Check,
  X,
  Download,
  Search,
  UserCheck,
  UserX,
  Timer,
  CheckCircle2,
  AlertCircle,
  Users,
  Briefcase,
} from "lucide-react";
import {
  PageIntro,
  Card,
  Button,
  Input,
  Avatar,
  StatCard,
  Pill,
  Select,
  toast,
} from "../components/UI";
import SearchableSelect from "../components/SearchableSelect";
import { SegmentedTabs } from "../components/Pagination";
import AttendanceTrendChart from "../components/AttendanceTrendChart";
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

const DEFAULT_STATUSES = ["Present", "Absent", "Half Day", "Leave"];
const STATUS_DISPLAY = { present: "Present", absent: "Absent", late: "Half Day", half_day: "Half Day", leave: "Leave" };
const STATUS_TONES = { present: "success", absent: "alert", late: "amber", half_day: "amber", leave: "info" };
const STATUS_LABELS = { present: "P", absent: "A", late: "HD", half_day: "HD", leave: "L" };
const ACTIVE_STYLES = {
  present: "bg-success text-white border-success",
  absent: "bg-alert text-white border-alert",
  late: "bg-amber text-ink border-amber",
  half_day: "bg-amber text-ink border-amber",
  leave: "bg-info text-white border-info",
};

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

function StaffMonthlySummary() {
  const [monthData, setMonthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());

  const load = () => {
    setLoading(true);
    setError("");
    api.staff.attendance
      .monthly(`month=${selMonth}&year=${selYear}`)
      .then(({ data }) => setMonthData(data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [selMonth, selYear]);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <Card
      title="Monthly Staff Attendance"
      action={
        <div className="flex items-center gap-2">
          <select
            value={selMonth}
            onChange={(e) => setSelMonth(Number(e.target.value))}
            className="text-[12px] border border-black/10 rounded-lg px-2 py-1.5 bg-white"
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selYear}
            onChange={(e) => setSelYear(Number(e.target.value))}
            className="text-[12px] border border-black/10 rounded-lg px-2 py-1.5 bg-white"
          >
            {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      }
    >
      {loading ? (
        <p className="text-[13px] text-slate-text py-8 text-center">Loading monthly data...</p>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-[13px] text-alert mb-2">{error}</p>
          <Button variant="outline" onClick={load}>Retry</Button>
        </div>
      ) : monthData.length === 0 ? (
        <p className="text-[13px] text-slate-text/60 py-8 text-center">No staff found.</p>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide border-b border-black/[0.06]">
                <th className="px-5 py-2 font-semibold">Staff</th>
                <th className="px-3 py-2 font-semibold">Designation</th>
                <th className="px-3 py-2 text-center font-semibold">P</th>
                <th className="px-3 py-2 text-center font-semibold">A</th>
                <th className="px-3 py-2 text-center font-semibold">L</th>
                <th className="px-3 py-2 text-center font-semibold">HD</th>
                <th className="px-3 py-2 text-center font-semibold">Late</th>
                <th className="px-3 py-2 text-right font-semibold">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {monthData.map((row) => (
                <tr key={row.staffId} className="border-t border-black/[0.04] hover:bg-paper/40">
                  <td className="px-5 py-2.5 font-medium text-ink">{row.name}</td>
                  <td className="px-3 py-2.5 text-slate-text/70">{row.designation || row.role || "—"}</td>
                  <td className="px-3 py-2.5 text-center text-success font-medium">{row.present}</td>
                  <td className="px-3 py-2.5 text-center text-alert font-medium">{row.absent}</td>
                  <td className="px-3 py-2.5 text-center text-info font-medium">{row.leave}</td>
                  <td className="px-3 py-2.5 text-center text-amber font-medium">{row.halfDay}</td>
                  <td className="px-3 py-2.5 text-center text-amber-dark font-medium">{row.late}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={`font-semibold ${row.attendancePct >= 90 ? "text-success" : row.attendancePct >= 75 ? "text-amber" : "text-alert"}`}>
                      {row.attendancePct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function Attendance() {
  const { options: CLASS_OPTIONS } = useMasterOptions("classes", CLASS_OPTIONS_FALLBACK);
  const { options: SECTION_OPTIONS, rawItems: rawSections } = useMasterOptions("sections", SECTION_OPTIONS_FALLBACK);
  const { options: attendanceStatusOptions } = useMasterOptions("attendance-statuses", DEFAULT_STATUSES);
  const [activeTab, setActiveTab] = useState("student");
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState("");
  const [cls, setCls] = useState("All");
  const [section, setSection] = useState("All");
  const [query, setQuery] = useState("");
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [date] = useState(todayLabel());
  const [classTeacherMap, setClassTeacherMap] = useState({});
  const [staffAssignmentsMap, setStaffAssignmentsMap] = useState({});

  // Staff attendance state
  const [staffList, setStaffList] = useState([]);
  const [staffMarks, setStaffMarks] = useState({});
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffSaved, setStaffSaved] = useState(false);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffAttendanceRecords, setStaffAttendanceRecords] = useState([]);
  const [staffTrendLoading, setStaffTrendLoading] = useState(true);
  const [staffTrendError, setStaffTrendError] = useState("");
  const [staffPage, setStaffPage] = useState(1);
  const [staffPageSize, setStaffPageSize] = useState(20);
  const todayStr = new Date().toISOString().slice(0, 10);

  const statusConfig = useMemo(() => {
    const cfg = {};
    attendanceStatusOptions.forEach((name) => {
      const key = name.toLowerCase().replace(/\s+/g, "_");
      cfg[key] = {
        label: STATUS_LABELS[key] || name.charAt(0),
        full: STATUS_DISPLAY[key] || name,
        tone: STATUS_TONES[key] || "neutral",
      };
    });
    return cfg;
  }, [attendanceStatusOptions]);
  const CLASS_OPTIONS_WITH_ALL = useMemo(() => ["All", ...CLASS_OPTIONS], [CLASS_OPTIONS]);
  const filteredSections = useMemo(() => {
    if (!cls || cls === "All") return ["All", ...SECTION_OPTIONS];
    return ["All", ...new Set(rawSections.filter((s) => s.className === cls).map((s) => s.name))];
  }, [cls, SECTION_OPTIONS, rawSections]);

  useEffect(() => {
    Promise.all([
      api.students.list("limit=1000"),
      api.attendance.list(),
      api.assignments.list("status=active"),
    ])
      .then(([studentResponse, attendanceResponse, assignmentResponse]) => {
        const loadedStudents = (studentResponse.data || []).map((student) => ({
          ...student,
          id: student._id,
          roll: student.rollNo || "—",
          avatar: student.photoUrl,
        }));
        const records = attendanceResponse.data || [];
        setStudents(loadedStudents);
        setAttendanceRecords(records);
        setTrendError("");

        const assignments = assignmentResponse.data || [];
        const ctMap = {};
        const sMap = {};
        assignments.forEach((a) => {
          const ctKey = `${a.class}__${a.section}`;
          if (a.type === "class_teacher" && !ctMap[ctKey]) ctMap[ctKey] = a.staffName || "—";
          if (a.staffId) {
            if (!sMap[a.staffId]) sMap[a.staffId] = [];
            if (a.type === "class_teacher") {
              sMap[a.staffId].push(`Class Teacher · ${a.class}-${a.section}`);
            } else if (a.subject) {
              sMap[a.staffId].push(`${a.subject} · ${a.class}-${a.section}`);
            }
          }
        });
        setClassTeacherMap(ctMap);
        setStaffAssignmentsMap(sMap);
      })
      .catch((requestError) => {
        setError(requestError.message);
        setTrendError(requestError.message);
      })
      .finally(() => setTrendLoading(false));
  }, []);

  // Real-time attendance updates via SSE — other users' changes appear instantly
  useEffect(() => {
    const unsubscribe = api.attendanceStream.subscribe({
      onData: () => {
        if (document.visibilityState !== "visible") return;
        api.attendance.list().then((res) => {
          setAttendanceRecords(res.data || []);
          setTrendError("");
        }).catch(() => {});
      },
    });
    return unsubscribe;
  }, []);

  // Update marks when date changes
  useEffect(() => {
    const existing = {};
    // Build admissionNo → _id map for matching teacher-saved records
    const admToId = {};
    students.forEach((s) => { if (s.admissionNo) admToId[s.admissionNo] = s.id; });
    attendanceRecords
      .filter(
        (record) =>
          new Date(record.date).toISOString().slice(0, 10) === selectedDate,
      )
      .forEach((record) => {
        const key = admToId[record.studentId] || record.studentId;
        existing[key] =
          record.status === "Present"
            ? "present"
            : record.status === "Absent"
              ? "absent"
              : record.status === "Leave"
                ? "leave"
                : "late";
      });
    setMarks(existing);
    setSaved(false);
  }, [selectedDate, attendanceRecords, students]);

  // Fetch all staff attendance for trend chart (runs once on mount)
  useEffect(() => {
    setStaffTrendLoading(true);
    api.staff.attendance.list("limit=5000")
      .then((res) => {
        setStaffAttendanceRecords(res.data || []);
        setStaffTrendError("");
      })
      .catch((err) => {
        setStaffTrendError(err.message);
      })
      .finally(() => setStaffTrendLoading(false));
  }, []);

  // Fetch staff + today's staff attendance
  useEffect(() => {
    if (activeTab !== "staff") return;
    setStaffLoading(true);
    Promise.all([
      api.staff.list("limit=1000"),
      api.staff.attendance.list(`date=${todayStr}`),
    ])
      .then(([staffRes, attRes]) => {
        const allStaff = (staffRes.data || []).map((s) => ({
          id: s._id,
          name: s.name,
          designation: s.designation || "Staff",
          employeeId: s.employeeId || "",
          photoUrl: s.photoUrl || "",
          userId: s.userId || null,
        }));
        setStaffList(allStaff);
        const existing = {};
        (attRes.data || []).forEach((r) => {
          existing[r.staffId] =
            r.status === "Present"
              ? "present"
              : r.status === "Absent"
                ? "absent"
                : r.status === "Half Day" || r.status === "Late"
                  ? "half_day"
                  : "leave";
        });
        setStaffMarks(existing);
      })
      .catch((err) => toast(err.message, "error"))
      .finally(() => setStaffLoading(false));
  }, [activeTab, todayStr]);

  const retryTrend = () => {
    setTrendLoading(true);
    setTrendError("");
    api.attendance
      .list()
      .then(({ data }) => {
        setAttendanceRecords(data || []);
        setTrendError("");
      })
      .catch((requestError) => setTrendError(requestError.message))
      .finally(() => setTrendLoading(false));
  };

  const list = useMemo(() => {
    return students
      .filter((s) => (cls === "All" || s.class === cls) && (section === "All" || s.section === section))
      .filter(
        (s) =>
          !query ||
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          String(s.roll).includes(query) ||
          s.id.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => String(a.roll).localeCompare(String(b.roll)));
  }, [cls, section, query, students]);

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
          studentId: student.admissionNo || student.id,
          class: student.class,
          section: student.section,
          date: selectedDate,
          status: {
            present: "Present",
            absent: "Absent",
            half_day: "Half Day",
            leave: "Leave",
          }[getStatus(student.id)],
        })),
      );
      // Refresh attendance records so the useEffect picks up saved data
      const { data } = await api.attendance.list();
      setAttendanceRecords(data || []);
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

  const exportStaffRegister = () => {
    if (filteredStaff.length === 0) return;
    const headers = ["Employee ID", "Name", "Designation", "Department", "Status"];
    const rows = filteredStaff.map((s) => [
      s.employeeId || "—",
      s.name,
      s.designation || "—",
      s.department || "—",
      (statusConfig[getStaffMark(s.id)] || {}).full || "Present",
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
    link.download = `staff-attendance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Staff attendance helpers ---
  const filteredStaff = useMemo(() => {
    if (!staffQuery) return staffList;
    const q = staffQuery.toLowerCase();
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.employeeId.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q),
    );
  }, [staffList, staffQuery]);

  const getStaffMark = (id) => staffMarks[id] || "present";

  const setStaffMark = (id, val) => {
    setStaffMarks((m) => ({ ...m, [id]: val }));
    setStaffSaved(false);
  };

  const staffCounts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, half_day: 0, leave: 0 };
    filteredStaff.forEach((s) => {
      const st = getStaffMark(s.id);
      c[st] = (c[st] || 0) + 1;
    });
    return c;
  }, [filteredStaff, staffMarks]);

  const staffTotalPages = Math.max(1, Math.ceil(filteredStaff.length / staffPageSize));
  const staffSafePage = Math.min(staffPage, staffTotalPages);
  const paginatedStaff = useMemo(() => {
    const start = (staffSafePage - 1) * staffPageSize;
    return filteredStaff.slice(start, start + staffPageSize);
  }, [filteredStaff, staffSafePage, staffPageSize]);

  const handleSaveStaff = async () => {
    if (filteredStaff.length === 0) return;
    try {
      const apiMap = { present: "Present", absent: "Absent", half_day: "Half Day", leave: "Leave" };
      await Promise.all(
        filteredStaff.map((s) =>
          api.staff.attendance.mark({
            staffId: s.id,
            date: todayStr,
            status: apiMap[getStaffMark(s.id)] || "Present",
          }),
        ),
      );
      setStaffSaved(true);
      toast("Staff attendance saved");
      setTimeout(() => setStaffSaved(false), 3500);
    } catch (err) {
      toast(err.message || "Failed to save staff attendance", "error");
    }
  };

  const TABS = [
    { id: "student", label: "Student Attendance", icon: Users },
    { id: "staff", label: "Staff Attendance", icon: Briefcase },
  ];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Attendance"
        description="Mark and monitor daily attendance across classes, sections and staff."
        right={
          <div className="flex gap-2">
            {activeTab === "student" && (
              <Button variant="outline" onClick={exportRegister}>
                <Download size={15} /> Export Register
              </Button>
            )}
            {activeTab === "staff" && (
              <Button variant="outline" onClick={exportStaffRegister}>
                <Download size={15} /> Export Register
              </Button>
            )}
          </div>
        }
      />

      <SegmentedTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === "student" && (
        <>
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
      <AttendanceTrendChart
        records={attendanceRecords}
        loading={trendLoading}
        error={trendError}
        onRetry={retryTrend}
      />

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
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
              />
              <Input
                placeholder="Search name / roll..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8 w-44 text-[12px] py-1.5"
              />
            </div>
            <SearchableSelect
              options={CLASS_OPTIONS_WITH_ALL}
              value={cls}
              onChange={(v) => { setCls(v); setSection(v === "All" ? "All" : filteredSections[0] || "All"); }}
              renderLabel={(c) => c === "All" ? "All Classes" : formatClassLabel(c)}
              placeholder="Class"
              className="min-w-[150px] whitespace-nowrap"
            />
            <SearchableSelect
              options={filteredSections}
              value={section}
              onChange={setSection}
              renderLabel={(s) => s === "All" ? "All Sections" : `Section ${s}`}
              placeholder="Section"
              className="min-w-[130px]"
            />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[110px] py-1.5 text-[12px]"
            />
          </div>
        }
      >
        {/* Quick actions + legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-black/6">
          <div className="flex flex-wrap gap-2 text-[11.5px] text-slate-text/70">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-success" /> Present
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-alert" /> Absent
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber" /> Half Day
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
                      {s.admissionNo || "—"} · {s.gender} · {s.house} House
                    </p>
                    {classTeacherMap[`${s.class}__${s.section}`] && (
                      <p className="text-[11px] text-primary font-medium mt-0.5">
                        Class Teacher: {classTeacherMap[`${s.class}__${s.section}`]}
                      </p>
                    )}
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
              Showing {list.length === 0 ? 0 : (attSafePage - 1) * attPageSize + 1}â€“{Math.min(attSafePage * attPageSize, list.length)} of {list.length}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={attPageSize}
                onChange={(e) => { setAttPageSize(Number(e.target.value)); setAttPage(1); }}
                className="text-[12px]"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </Select>
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
        Use the P / A / HD / L buttons to mark each student. Changes are sent to
        the backend when you click <strong>Save Attendance</strong>.
      </div>
        </>
      )}

      {/* ─── Staff Attendance Tab ─── */}
      {activeTab === "staff" && (
        <>
          {staffTrendError && !staffAttendanceRecords.length && <p className="text-alert text-[13px]">{staffTrendError}</p>}

          {/* Staff Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(statusConfig).slice(0, 4).map(([key, cfg]) => (
              <StatCard
                key={key}
                icon={key === "present" ? UserCheck : key === "absent" ? UserX : key === "late" ? Timer : CheckCircle2}
                label={cfg.full}
                value={String(staffCounts[key] || 0)}
                sub={
                  filteredStaff.length && key === "present"
                    ? `${Math.round(((staffCounts[key] || 0) / filteredStaff.length) * 100)}% of staff`
                    : `${staffCounts[key] || 0} staff`
                }
                accent={cfg.tone === "success" ? "success" : cfg.tone === "alert" ? "alert" : cfg.tone === "amber" ? "amber" : "info"}
              />
            ))}
          </div>

          {/* Staff Trend Chart */}
          <AttendanceTrendChart
            records={staffAttendanceRecords}
            loading={staffTrendLoading}
            error={staffTrendError}
            onRetry={() => {
              setStaffTrendLoading(true);
              api.staff.attendance.list("limit=5000")
                .then((res) => { setStaffAttendanceRecords(res.data || []); setStaffTrendError(""); })
                .catch((err) => { setStaffTrendError(err.message); })
                .finally(() => setStaffTrendLoading(false));
            }}
            title="Staff Attendance Trend"
            subtitle="Staff-wide attendance performance"
          />

          {/* Staff Monthly Summary */}
          <StaffMonthlySummary />

          {/* Staff Marking Panel */}
          <Card
            title={
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span>Staff Daily Attendance</span>
                <span className="text-[12.5px] font-normal text-slate-text/70">
                  {date}
                </span>
              </div>
            }
            action={
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
                <Input
                  placeholder="Search staff..."
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  className="pl-8 w-44 sm:w-52"
                />
              </div>
            }
          >
            {/* Quick actions + legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-black/6">
              <div className="flex flex-wrap gap-2 text-[11.5px] text-slate-text/70">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-alert" /> Absent</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> Half Day</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-info" /> Leave</span>
              </div>
            </div>

            {staffLoading ? (
              <div className="py-14 text-center">
                <p className="text-[13px] text-slate-text/60">Loading staff...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-14 text-center">
                <AlertCircle size={36} className="mx-auto text-slate-text/30 mb-3" />
                <p className="text-[14px] font-medium text-ink">No staff found</p>
                <p className="text-[13px] text-slate-text/60 mt-1">Try a different search or add staff members first.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {paginatedStaff.map((s) => {
                  const status = getStaffMark(s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3 hover:bg-paper/60 -mx-2 px-2 rounded-lg transition-colors">
                      <Avatar src={s.photoUrl} name={s.name} size={38} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-ink truncate">{s.name}</p>
                        <p className="text-[11.5px] text-slate-text/60 mt-0.5">
                          {s.designation} {s.employeeId ? `· ${s.employeeId}` : ""}
                        </p>
                        {staffAssignmentsMap[s.id]?.length > 0 && (
                          <p className="text-[11px] text-primary font-medium mt-0.5">
                            {staffAssignmentsMap[s.id].join(" | ")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {Object.entries(statusConfig).map(([key, cfg]) => {
                          const isActive = status === key;
                          return (
                            <button
                              key={key}
                              title={cfg.full}
                              onClick={() => setStaffMark(s.id, key)}
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

            {/* Staff Pagination */}
            {filteredStaff.length > staffPageSize && (
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-black/[0.04]">
                <p className="text-[12px] text-slate-text/55">
                  Showing {filteredStaff.length === 0 ? 0 : (staffSafePage - 1) * staffPageSize + 1}–{Math.min(staffSafePage * staffPageSize, filteredStaff.length)} of {filteredStaff.length}
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={staffPageSize}
                    onChange={(e) => { setStaffPageSize(Number(e.target.value)); setStaffPage(1); }}
                    className="text-[12px]"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n} / page</option>
                    ))}
                  </Select>
                  <Button variant="outline" className="px-3 py-1.5 text-[12px]" disabled={staffSafePage <= 1} onClick={() => setStaffPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <span className="text-[12px] text-ink font-medium">{staffSafePage} / {staffTotalPages}</span>
                  <Button variant="outline" className="px-3 py-1.5 text-[12px]" disabled={staffSafePage >= staffTotalPages} onClick={() => setStaffPage((p) => Math.min(staffTotalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Staff footer */}
            {filteredStaff.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-black/6">
                <div className="text-[12.5px] text-slate-text/70">
                  Showing <strong className="text-ink">{filteredStaff.length}</strong> staff
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <span key={key}>
                      · {cfg.full}{" "}
                      <strong className={`text-${cfg.tone === "success" ? "success" : cfg.tone === "alert" ? "alert" : cfg.tone === "amber" ? "amber-dark" : "info"}`}>
                        {staffCounts[key] || 0}
                      </strong>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {staffSaved && (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                      <CheckCircle2 size={16} /> Attendance saved
                    </span>
                  )}
                  <Button variant="amber" onClick={handleSaveStaff}>
                    <Check size={15} /> Save Attendance
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <div className="rounded-xl bg-ink/5 border border-ink/10 px-4 py-3.5 text-[13px] text-slate-text">
            <strong className="text-ink">Tip:</strong> Staff attendance is saved per individual.
            Use the status buttons to mark attendance, then save when ready.
          </div>
        </>
      )}
    </div>
  );
}