import { useEffect, useMemo, useState } from "react";
import { Users, Search, X, Phone, MapPin, CalendarDays, UserRound } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Pill,
  Avatar,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import { useTeacherContext, fmtDate } from "./useTeacherContext";

export default function MyClass() {
  const { cls, section, query, hasClassTeacher, teachingScopes, loading: ctxLoading } =
    useTeacherContext();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    api.students
      .list(`${query}&limit=500`)
      .then(({ data }) => setStudents(data || []))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [query]);

  const list = useMemo(() => {
    const q = search.toLowerCase();
    return (students || [])
      .filter(
        (s) =>
          !q ||
          s.name?.toLowerCase().includes(q) ||
          (s.admissionNo || "").toLowerCase().includes(q) ||
          (s.rollNo || "").includes(q),
      )
      .sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));
  }, [students, search]);

  const openProfile = async (id) => {
    try {
      const { data } = await api.students.get(id);
      setProfile(data);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const present = (students || []).filter((s) => s.status === "Active").length;

  if (!ctxLoading && !hasClassTeacher) {
    return (
      <Card>
        <div className="py-16 text-center">
          <Users size={40} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[15px] font-semibold text-ink">
            You are not a Class Teacher yet
          </p>
          <p className="text-[13px] text-slate-text/70 mt-1">
            {teachingScopes.length
              ? "This page is for your homeroom class. You are a subject teacher for " +
                teachingScopes.map((s) => `Class ${s.class}-${s.section}`).join(", ") +
                " — use Attendance, Timetable and Homework instead."
              : "Your school admin will assign a Class Teacher responsibility to you."}
          </p>
        </div>
      </Card>
    );
  }

  if (!cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <Users size={40} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[15px] font-semibold text-ink">
            No class assigned yet
          </p>
          <p className="text-[13px] text-slate-text/70 mt-1">
            Contact your school admin to link your class and section.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="My Teaching"
        title="My Class"
        description={`Students assigned to Class ${cls}${section ? `-${section}` : ""}.`}
        right={
          <span className="text-[13px] font-medium text-slate-text">
            {students.length} students
          </span>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Students"
          value={String((students || []).length)}
          sub={`Class ${cls}${section ? `-${section}` : ""}`}
          accent="info"
        />
        <StatCard
          icon={UserRound}
          label="Active"
          value={String(present)}
          sub="Currently enrolled"
          accent="success"
        />
        <StatCard
          icon={Users}
          label="Boys / Girls"
          value={`${(students || []).filter((s) => s.gender === "Male").length}/${(students || []).filter((s) => s.gender === "Female").length}`}
          sub="By gender"
          accent="info"
        />
        <StatCard
          icon={CalendarDays}
          label="Profiles Complete"
          value={`${(students || []).filter((s) => s.profileStatus === "complete").length}/${(students || []).length}`}
          sub="Full record on file"
          accent="amber"
        />
      </div>

      <Card
        title="Student Roster"
        action={
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40"
            />
            <Input
              placeholder="Search name / admission no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            Loading students…
          </p>
        ) : list.length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">
            No students found for this class and section.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Student</th>
                  <th className="px-3 py-2 font-semibold">Admission No</th>
                  <th className="px-3 py-2 font-semibold">Roll No</th>
                  <th className="px-3 py-2 font-semibold">Gender</th>
                  <th className="px-3 py-2 font-semibold">Parent</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold text-right">Profile</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr
                    key={s._id}
                    className="border-t border-black/[0.06] hover:bg-paper/60"
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar src={s.photoUrl} name={s.name} size={30} />
                        <p className="font-semibold text-ink truncate">
                          {s.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-text/80">
                      {s.admissionNo}
                    </td>
                    <td className="px-3 py-2.5">{s.rollNo || "—"}</td>
                    <td className="px-3 py-2.5">{s.gender || "—"}</td>
                    <td className="px-3 py-2.5 text-slate-text/80">
                      {s.parentName || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={s.status === "Active" ? "success" : "neutral"}>
                        {s.status || "—"}
                      </Pill>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => openProfile(s._id)}
                        className="text-[12px] font-semibold text-info hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setProfile(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-ink px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <Avatar name={profile.name} size={48} />
                <div>
                  <h3 className="font-display font-semibold text-white text-[17px]">
                    {profile.name}
                  </h3>
                  <p className="text-white/60 text-[12.5px]">
                    {profile.admissionNo} · Class {profile.class}-
                    {profile.section}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProfile(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/70"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3.5">
              <Row
                icon={UserRound}
                label="Roll No"
                value={profile.rollNo || "—"}
              />
              <Row
                icon={CalendarDays}
                label="Date of Birth"
                value={fmtDate(profile.dob)}
              />
              <Row icon={UserRound} label="Gender" value={profile.gender || "—"} />
              <Row icon={MapPin} label="Address" value={profile.address || "—"} />
              <Row
                icon={Phone}
                label="Parent Contact"
                value={`${profile.parentName || "—"} · ${profile.parentContact || "—"}`}
              />
              <Row
                icon={CalendarDays}
                label="Admission Date"
                value={fmtDate(profile.admissionDate)}
              />
              <Row
                icon={UserRound}
                label="Profile Status"
                value={profile.profileStatus === "complete" ? "Complete" : "Incomplete"}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-paper flex items-center justify-center text-slate-text shrink-0">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-[13.5px] font-medium text-ink mt-0.5 break-words">
          {value}
        </p>
      </div>
    </div>
  );
}