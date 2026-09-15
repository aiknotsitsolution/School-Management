import { useEffect, useState, useCallback } from "react";
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

export default function AttendanceCheckinModal({ userName, onDone }) {
  const [state, setState] = useState("loading");
  const [record, setRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const checkToday = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await api.staff.attendance.meToday();
      if (res.data) {
        setRecord(res.data);
        setState("already_marked");
        setTimeout(() => onDone(), 1200);
      } else {
        setState("not_marked");
      }
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }, [onDone]);

  useEffect(() => {
    checkToday();
  }, [checkToday]);

  const markAttendance = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const local = new Date(now.getTime() - offset * 60000);
      const today = local.toISOString().slice(0, 10);
      const checkInTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      const res = await api.staff.attendance.mark({
        date: today,
        status: "Present",
        checkIn: checkInTime,
        source: "self",
      });
      setRecord(res.data);
      setState("success");
      setTimeout(() => onDone(), 1800);
    } catch (err) {
      setError(err.message);
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <Loader2 size={32} className="mx-auto text-amber animate-spin mb-4" />
          <p className="text-[14px] text-slate-text">Checking today&apos;s attendance...</p>
        </div>
      </div>
    );
  }

  if (state === "already_marked") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-success mb-4" />
          <p className="text-[14px] font-semibold text-ink mb-1">Attendance already marked today.</p>
          {record?.checkIn && (
            <p className="text-[13px] text-slate-text/70">Check-in: {record.checkIn}</p>
          )}
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-success mb-4" />
          <p className="text-[14px] font-semibold text-ink mb-1">Attendance marked successfully.</p>
          {record?.checkIn && (
            <p className="text-[13px] text-slate-text/70">Check-in: {record.checkIn}</p>
          )}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <AlertCircle size={40} className="mx-auto text-alert mb-4" />
          <p className="text-[14px] font-semibold text-ink mb-1">Unable to mark attendance.</p>
          <p className="text-[13px] text-slate-text/70 mb-4">{error}</p>
          <Button onClick={checkToday} variant="outline" className="mx-auto">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  const todayStr = local.toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Mark today's attendance">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-ink px-6 py-5 text-white">
          <h2 className="font-display font-bold text-lg">Mark Your Today&apos;s Attendance</h2>
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

          <div className="flex items-center justify-between bg-paper rounded-xl p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-text/50">Status</p>
              <p className="text-[14px] font-semibold text-ink mt-0.5">Present</p>
            </div>
            <CheckCircle2 size={22} className="text-success" />
          </div>

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
                <Loader2 size={15} className="animate-spin" /> Marking attendance...
              </>
            ) : (
              "Mark Attendance"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
