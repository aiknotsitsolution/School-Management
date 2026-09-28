import { useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { api } from "../../lib/api";
import { Card, Pill } from "../UI";

const STATUS_TONE = { scheduled: "warning", completed: "success", cancelled: "alert" };

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Read-only "my substitutions" feed for the teacher portal. The backend scopes
// the list to substitutions the logged-in teacher is part of (original or
// substitute), so no client-side filtering by identity is needed.
export default function MySubstitutions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.timetable.substitutions
      .list()
      .then(({ data }) => {
        const all = Array.isArray(data) ? data : [];
        const upcoming = all.filter((s) => s.status === "scheduled" && s.date >= today());
        const recent = all.filter((s) => !(s.status === "scheduled" && s.date >= today()));
        setRows([...upcoming, ...recent].slice(0, 20));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <Card>
        <p className="text-[13px] text-alert">{error}</p>
      </Card>
    );
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ArrowRightLeft size={16} />
          My substitutions
        </span>
      }
    >
      {loading ? (
        <p className="py-6 text-center text-[13px] text-slate-text/60">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center">
          <ArrowRightLeft size={28} className="mx-auto text-slate-text/30 mb-2" />
          <p className="text-[13px] text-slate-text/70">
            No substitutions assigned. You will be notified here when you cover a class.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((sub) => {
            const iAmSubstitute = sub.substituteTeacherId && sub.originalTeacherId !== sub.substituteTeacherId;
            return (
              <div key={sub._id} className="py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Pill tone={STATUS_TONE[sub.status] || "neutral"}>{sub.status}</Pill>
                <span className="text-[13px] font-semibold text-ink">
                  {iAmSubstitute ? "Covering" : "Being covered"} · {sub.subject || "Period"}
                </span>
                <span className="text-[12.5px] text-slate-text/70">
                  Class {sub.class}-{sub.section} · {sub.date} · {sub.startTime}-{sub.endTime}
                </span>
                <span className="text-[12.5px] text-slate-text/60">
                  {sub.originalTeacherName} → {sub.substituteTeacherName}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
