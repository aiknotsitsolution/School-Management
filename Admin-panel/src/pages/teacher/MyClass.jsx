import { useEffect, useMemo, useState } from "react";
import { Users, Search, UserRound, CalendarDays } from "lucide-react";
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
import { useTeacherContext } from "./useTeacherContext";
import StudentDetailModal from "./StudentDetailModal";

export default function MyClass() {
  const { cls, section, query, hasClassTeacher, loading: ctxLoading } =
    useTeacherContext();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [profileId, setProfileId] = useState(null);

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

  const openProfile = (id) => {
    setProfileId(id);
  };

  const present = (students || []).filter((s) => s.status === "Active").length;

  if (!ctxLoading && !cls) {
    return (
      <Card>
        <div className="py-16 text-center">
          <Users size={40} className="mx-auto text-slate-text/30 mb-3" />
          <p className="text-[15px] font-semibold text-ink">
            No class assigned to your account yet
          </p>
          <p className="text-[13px] text-slate-text/70 mt-1 max-w-sm mx-auto">
            Your school admin needs to assign you a class and section before you
            can view students here. Once assigned, your class roster will appear
            on this page.
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
        description={
          hasClassTeacher
            ? `You are the Class Teacher for ${cls}${section ? `-${section}` : ""}.`
            : `Students in Class ${cls}${section ? `-${section}` : ""} that you teach.`
        }
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

      {profileId && (
        <StudentDetailModal
          studentId={profileId}
          onClose={() => setProfileId(null)}
        />
      )}
    </div>
  );
}