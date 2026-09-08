import { useMemo } from "react";
import { useSelector } from "react-redux";
import { selectSchool, selectUser } from "../../store/selectors";

export function useTeacherContext() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const cls = user?.class || null;
  const section = user?.section || null;

  const query = useMemo(
    () =>
      cls
        ? `class=${encodeURIComponent(cls)}${
            section ? `&section=${encodeURIComponent(section)}` : ""
          }`
        : "",
    [cls, section],
  );

  return {
    user,
    school,
    cls,
    section,
    query,
    assignment: cls
      ? `Class ${cls}${section ? `-${section}` : ""}`
      : "No class assigned",
  };
}

export function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate(),
  ).padStart(2, "0")}`;
}

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}