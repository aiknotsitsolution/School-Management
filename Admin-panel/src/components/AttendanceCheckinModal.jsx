import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "./UI";
import { api } from "../lib/api";

function fmtTime(d) {
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const STATUSES = [
  { key: "Present", label: "P", full: "Present", color: "bg-success text-white border-success" },
  { key: "Absent", label: "A", full: "Absent", color: "bg-alert text-white border-alert" },
  { key: "Leave", label: "L", full: "Leave", color: "bg-info text-white border-info" },
  { key: "Half Day", label: "HD", full: "Half Day", color: "bg-warning text-white border-primary" },
];

const STATUS_STYLE = {
  Present: "bg-success/10 text-success border-success/30",
  Absent: "bg-alert/10 text-alert border-alert/30",
  Leave: "bg-info/10 text-info border-info/30",
  "Half Day": "bg-warning/10 text-primary border-warning/30",
  Late: "bg-warning/10 text-primary border-warning/30",
};

const todayISO = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

// Today's attendance gate for Staff / Teacher accounts.
//
// The parent mounts it the moment the app opens (Layout), and the component
// decides for itself whether there is anything to show:
//   · record with a check-in  → renders NOTHING (no flash, no confirmation card)
//   · no record yet           → the "Mark Your Today's Attendance" popup
//   · record without check-in → a check-in-only popup (status already sits on
//                               the record — usually the admin's) so the person
//                               can stamp their arrival time
//   · the probe itself failed → renders NOTHING; a failed check must never
//                               hold the dashboard hostage
export default function AttendanceCheckinModal({ userName, onDone }) {
  // "checking" and "hidden" render null; "form" is the popup; "success" is the
  // short confirmation shown right after marking.
  const [view, setView] = useState("checking");
  const [mode, setMode] = useState("mark"); // "mark" | "checkin"
  const [record, setRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("Present");

  // `onDone` is read through a ref: parents often pass an inline arrow, and a
  // changing callback identity would re-run the "check today" effect forever.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const finish = useCallback(() => {
    setView("hidden");
    if (onDoneRef.current) onDoneRef.current();
  }, []);

  const checkToday = useCallback(async () => {
    try {
      const res = await api.staff.attendance.meToday();
      const today = res.data || null;
      setRecord(today);

      if (today && today.checkIn) {
        // Marked AND checked in — nothing to ask for.
        finish();
        return;
      }
      if (today) {
        // Present on the roster today but never checked in (an admin marking
        // attendance records no arrival time).
        setMode("checkin");
        setSelectedStatus(today.status || "Present");
      } else {
        setMode("mark");
        setSelectedStatus("Present");
      }
      setView("form");
    } catch (err) {
      // No linked staff record, an expired token, service down… none of these
      // should block the app or nag the person.
      console.warn("[attendance] could not check today's record:", err?.message);
      finish();
    }
  }, [finish]);

  useEffect(() => {
    checkToday();
  }, [checkToday]);

  const markAttendance = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      const checkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const res = await api.staff.attendance.mark({
        date: todayISO(),
        // Check-in mode keeps the status already on the record: this popup only
        // stamps the arrival time, it must not rewrite an admin's decision.
        status: mode === "checkin" ? record?.status || selectedStatus : selectedStatus,
        checkIn: checkInTime,
        source: "self",
      });
      setRecord(res.data);
      setView("success");
      setTimeout(() => finish(), 1600);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (view === "checking" || view === "hidden") return null;

  const now = new Date();
  const todayStr = todayISO();

  if (view === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-success mb-4" />
          <p className="text-[14px] font-semibold text-ink mb-1">
            {mode === "checkin" ? "Checked in successfully." : "Attendance marked successfully."}
          </p>
          {record?.checkIn && (
            <p className="text-[13px] text-slate-text/70">Check-in: {record.checkIn}</p>
          )}
        </div>
      </div>
    );
  }

  const checkingIn = mode === "checkin";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={checkingIn ? "Check in for today" : "Mark today's attendance"}
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-ink px-6 py-5 text-white">
          <h2 className="font-display font-bold text-lg">
            {checkingIn ? "Check In for Today" : "Mark Your Today's Attendance"}
          </h2>
          <p className="text-white/70 text-[13px] mt-1">
            {greeting()}, {userName} 👋
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/50">Today</p>
              <p className="text-[14px] font-medium text-ink mt-0.5">{fmtDate(todayStr)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/50">Current time</p>
              <p className="text-[14px] font-medium text-ink mt-0.5">{fmtTime(now)}</p>
            </div>
          </div>

          {checkingIn ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/50 mb-2">
                Attendance
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-bold ${
                    STATUS_STYLE[record?.status] || "bg-slate-100 text-slate-text border-slate-200"
                  }`}
                >
                  {record?.status || "Marked"}
                </span>
                <span className="text-[12px] text-slate-text/70">
                  already marked · check-in time missing
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/50 mb-2">Status</p>
              <div className="grid grid-cols-4 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSelectedStatus(s.key)}
                    className={`py-2.5 rounded-lg text-[13px] font-bold border transition-all ${
                      selectedStatus === s.key
                        ? s.color
                        : "bg-white text-slate-text border-slate-200 hover:border-slate-300"
                    }`}
                    title={s.full}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-alert/10 text-alert rounded-lg px-3 py-2 text-[12px]">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <Button
            onClick={markAttendance}
            disabled={submitting}
            className="w-full justify-center"
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />{" "}
                {checkingIn ? "Checking in..." : "Marking attendance..."}
              </>
            ) : checkingIn ? (
              "Check In Now"
            ) : (
              "Mark Attendance"
            )}
          </Button>

          <button
            type="button"
            onClick={finish}
            className="w-full text-center text-[12.5px] text-slate-text/60 hover:text-slate-text transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
