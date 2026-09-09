import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { usePermission } from "../lib/permissions";
import { PageIntro, Select } from "../components/UI";
import TimetableManager from "../components/timetable/TimetableManager";

export default function Timetable() {
  const [students, setStudents] = useState([]);
  const [cls, setCls] = useState("");
  const [section, setSection] = useState("");
  const canWrite = usePermission("timetable:write");

  const classOptions = useMemo(() => {
    const seen = new Map();
    students.forEach((student) => {
      if (!student.class || !student.section) return;
      const key = `${student.class}|${student.section}`;
      if (seen.has(key)) return;
      seen.set(key, { class: student.class, section: student.section });
    });
    return [...seen.values()].sort(
      (a, b) =>
        String(a.class).localeCompare(String(b.class), undefined, {
          numeric: true,
        }) || String(a.section).localeCompare(String(b.section)),
    );
  }, [students]);

  const sectionOptions = useMemo(
    () => [
      ...new Set(
        (cls ? students.filter((s) => s.class === cls).map((s) => s.section) : students.map((s) => s.section))
          .filter(Boolean),
      ),
    ].sort(),
    [students, cls],
  );

  useEffect(() => {
    api.students
      .list("limit=1000")
      .then(({ data }) => setStudents(data || []))
      .catch(() => setStudents([]));
  }, []);

  const handleClassChange = (value) => {
    setCls(value === "" ? "" : value);
    setSection("");
    const match = classOptions.find((option) => option.class === value);
    if (match && value) setSection(match.section);
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Timetable"
        description={
          canWrite
            ? "Build and manage weekly timetables for every class and section. Add, edit, or remove lesson slots from the grid."
            : "Weekly class timetable stored in the ERP — select a class and section to view its schedule."
        }
        right={
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={cls}
              onChange={(event) => handleClassChange(event.target.value)}
              className="min-w-[180px]"
            >
              <option value="">Select class</option>
              {classOptions.map((option) => (
                <option key={`${option.class}-${option.section}`} value={option.class}>
                  Class {option.class}
                </option>
              ))}
            </Select>
            <Select
              value={section}
              onChange={(event) => setSection(event.target.value)}
              className="min-w-[130px]"
              disabled={!cls}
            >
              <option value="">Select section</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <TimetableManager cls={cls} section={section} canWrite={canWrite} />
    </div>
  );
}