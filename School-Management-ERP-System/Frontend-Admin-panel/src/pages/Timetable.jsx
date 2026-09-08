import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { api } from "../lib/api";
import { PageIntro, Card, Select, Pill } from "../components/UI";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function sortPeriods(periods) {
  return [...periods].sort((a, b) =>
    String(a.startTime || "").localeCompare(String(b.startTime || "")),
  );
}

function timeLabel(value) {
  if (!value) return "";
  const [h, m] = String(value).split(":").map((part) => Number(part));
  if (Number.isNaN(h)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

export default function Timetable() {
  const [students, setStudents] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [cls, setCls] = useState("");
  const [section, setSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    () => [...new Set(students.map((s) => s.section).filter(Boolean))].sort(),
    [students],
  );

  useEffect(() => {
    api.students
      .list("limit=1000")
      .then(({ data }) => setStudents(data || []))
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!cls || !section) {
      setTimetable([]);
      return;
    }
    setLoading(true);
    const query = `class=${encodeURIComponent(cls)}&section=${encodeURIComponent(section)}`;
    api.timetable
      .list(query)
      .then(({ data }) => setTimetable(data || []))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [cls, section]);

  const scheduleByDay = useMemo(() => {
    const map = new Map(DAYS.map((day) => [day, []]));
    timetable.forEach((slot) => {
      if (map.has(slot.day)) map.set(slot.day, sortPeriods(slot.periods || []));
    });
    return map;
  }, [timetable]);

  const totalSlots = [...scheduleByDay.values()].reduce(
    (sum, periods) => sum + periods.length,
    0,
  );

  const handleClassChange = (value) => {
    setCls(value === "" ? "" : value);
    const match = classOptions.find((option) => option.class === value);
    if (match && !section) setSection(match.section);
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="Timetable"
        description="Weekly class timetable stored in the ERP — select a class and section to view its schedule."
        right={
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={cls}
              onChange={(event) => handleClassChange(event.target.value)}
              className="min-w-[180px]"
            >
              <option value="">All classes</option>
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
            >
              <option value="">All sections</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {error && (
        <Card>
          <p className="text-sm text-alert">{error}</p>
        </Card>
      )}

      {!loading && !cls && (
        <Card>
          <CalendarDays size={30} className="text-slate-text/30 mx-auto mb-3" />
          <p className="text-center text-[14px] font-medium text-ink">
            Select a class to view its weekly timetable
          </p>
          <p className="text-center text-[13px] text-slate-text/60 mt-1">
            {totalSlots} timetable entries for {cls || "this school"}
          </p>
        </Card>
      )}

      {cls && (
        <Card
          title={`Class ${cls} — ${section || "All Sections"}`}
          action={
            <div className="flex items-center gap-2 text-[12px] text-slate-text/60">
              <Clock size={14} />
              <span>{totalSlots} lesson slots</span>
            </div>
          }
        >
          {loading ? (
            <p className="py-14 text-center text-[13px] text-slate-text/60">
              Loading timetable...
            </p>
          ) : totalSlots === 0 ? (
            <div className="py-14 text-center">
              <CalendarDays
                size={34}
                className="mx-auto text-slate-text/30 mb-3"
              />
              <p className="text-[14px] font-medium text-ink">
                No timetable published for this class yet
              </p>
              <p className="text-[13px] text-slate-text/60 mt-1">
                Published schedules appear here as lesson slots are saved.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 px-5 pb-5 min-w-[980px]">
                {DAYS.map((day) => {
                  const periods = scheduleByDay.get(day) || [];
                  return (
                    <div
                      key={day}
                      className="rounded-xl border border-black/[0.06] overflow-hidden"
                    >
                      <div className="bg-ink text-white px-4 py-2.5 font-semibold text-[12.5px]">
                        {day}
                      </div>
                      {periods.length === 0 ? (
                        <p className="px-4 py-6 text-center text-[12px] text-slate-text/50">
                          No periods
                        </p>
                      ) : (
                        <div className="divide-y divide-black/[0.04]">
                          {periods.map((period, index) => (
                            <div
                              key={`${day}-${index}`}
                              className="px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[13px] font-semibold text-ink">
                                  {period.subject || "—"}
                                </p>
                                <Pill tone="amber">
                                  {timeLabel(period.startTime)}
                                </Pill>
                              </div>
                              <p className="text-[11.5px] text-slate-text/60 mt-1 truncate">
                                {period.teacherName || "Not assigned"}
                                {period.endTime &&
                                  ` · ${timeLabel(period.startTime)}–${timeLabel(period.endTime)}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}