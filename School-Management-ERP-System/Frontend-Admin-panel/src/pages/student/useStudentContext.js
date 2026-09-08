import { useState } from "react";
import { useSelector } from "react-redux";
import { selectUser, selectSchool } from "../../store/selectors";

// Student portal context. The student record is always resolved through the
// authenticated endpoint (`GET /students/me`) — never via a student list.
export default function useStudentContext() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const [profile, setProfile] = useState(null);
  return {
    user,
    school,
    profile,
    setProfile,
    refId: user?.refId,
    cls: user?.class || profile?.class,
    section: user?.section || profile?.section,
  };
}

export function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtMoney(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function dateOf(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}