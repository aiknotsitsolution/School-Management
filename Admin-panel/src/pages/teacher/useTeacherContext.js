import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { selectSchool, selectUser } from "../../store/selectors";
import { api } from "../../lib/api";

// The server owns TeacherAssignment records (staff-service). Pages share one
// cached fetch per signed-in user so switching pages doesn't re-hammer /me.
const assignmentsCache = new Map();

function fetchMyAssignments(user) {
  const key = String(user?.id || "");
  if (!key) return Promise.resolve(null);
  if (!assignmentsCache.has(key)) {
    const promise = api.assignments
      .me()
      .then((r) => r.data || null)
      .catch(() => null);
    assignmentsCache.set(key, promise);
  }
  return assignmentsCache.get(key);
}

export function useTeacherContext() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);

  const isTeacherRole = user?.role === "teacher";

  const [myData, setMyData] = useState(null);
  const [loading, setLoading] = useState(isTeacherRole);

  useEffect(() => {
    if (!isTeacherRole) {
      setMyData(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchMyAssignments(user).then((data) => {
      if (!alive) return;
      setMyData(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, isTeacherRole]);

  // Class Teacher responsibility is an assignment, never an employee type.
  // A teacher with an explicit class_teacher assignment owns that homeroom.
  const classTeacherAssignments = useMemo(
    () => (Array.isArray(myData?.classTeacher) ? myData.classTeacher : []),
    [myData],
  );
  const teachingAssignments = useMemo(
    () => (Array.isArray(myData?.teaching) ? myData.teaching : []),
    [myData],
  );
  const teachingScopes = useMemo(
    () => (Array.isArray(myData?.teachingScopes) ? myData.teachingScopes : []),
    [myData],
  );
  const assignmentHistory = useMemo(
    () => (Array.isArray(myData?.history) ? myData.history : []),
    [myData],
  );

  const hasClassTeacher = classTeacherAssignments.length > 0;

  // PRIMARY teaching scope used by the single-class teacher pages and as the
  // token-level scope on the server:
  //   1. the Class Teacher homeroom, if any
  //   2. the first active teaching assignment
  //   3. the legacy class/section carried on the account (backward compat)
  const primaryScope = useMemo(() => {
    if (classTeacherAssignments[0]) {
      return {
        class: classTeacherAssignments[0].class,
        section: classTeacherAssignments[0].section,
      };
    }
    if (teachingScopes[0]) {
      return { class: teachingScopes[0].class, section: teachingScopes[0].section };
    }
    return user?.class || user?.section
      ? { class: user.class || null, section: user.section || null }
      : null;
  }, [classTeacherAssignments, teachingScopes, user?.class, user?.section]);

  const cls = primaryScope?.class || user?.class || null;
  const section = primaryScope?.section || user?.section || null;

  const query = useMemo(
    () =>
      cls
        ? `class=${encodeURIComponent(cls)}${
            section ? `&section=${encodeURIComponent(section)}` : ""
          }`
        : "",
    [cls, section],
  );

  const assignment = useMemo(() => {
    if (hasClassTeacher) {
      const a = classTeacherAssignments[0];
      return `Class Teacher · Class ${a.class}${a.section ? `-${a.section}` : ""}`;
    }
    if (cls) return `Class ${cls}${section ? `-${section}` : ""}`;
    return "No class assigned";
  }, [hasClassTeacher, classTeacherAssignments, cls, section]);

  return {
    user,
    school,
    cls,
    section,
    query,
    assignment,
    loading,
    // Assignment-aware extras (the null-safe defaults keep existing pages
    // working for teacher accounts with no assignments yet).
    teacherData: myData,
    classTeacherAssignments,
    teachingAssignments,
    teachingScopes,
    assignmentHistory,
    hasClassTeacher,
    staffRecord: myData?.staff || null,
    role: isTeacherRole ? "teacher" : user?.role,
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