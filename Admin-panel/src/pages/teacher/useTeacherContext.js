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

// Shared active scope state (persists across page navigation within a session).
let _activeScopeIdx = 0;
const _scopeListeners = new Set();

function useActiveScopeIdx() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    _scopeListeners.add(fn);
    return () => _scopeListeners.delete(fn);
  }, []);
  return [
    _activeScopeIdx,
    (idx) => {
      _activeScopeIdx = idx;
      _scopeListeners.forEach((fn) => fn());
    },
  ];
}

export function useTeacherContext() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);

  const isTeacherRole = user?.role === "teacher";

  const [myData, setMyData] = useState(null);
  const [loading, setLoading] = useState(isTeacherRole);
  const [activeScopeIdx, setActiveScopeIdx] = useActiveScopeIdx();

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

  // All distinct scopes the teacher can access (class_teacher first, then teaching).
  const allScopes = useMemo(() => {
    const map = new Map();
    classTeacherAssignments.forEach((a) => {
      const key = `${a.class}::${a.section || ""}`;
      if (!map.has(key)) map.set(key, { class: a.class, section: a.section || null, type: "class_teacher" });
    });
    teachingScopes.forEach((s) => {
      const key = `${s.class}::${s.section || ""}`;
      if (!map.has(key)) map.set(key, { class: s.class, section: s.section || null, type: "teaching" });
    });
    return Array.from(map.values());
  }, [classTeacherAssignments, teachingScopes]);

  // Clamp active index when scopes change.
  const clampedIdx = Math.min(activeScopeIdx, Math.max(allScopes.length - 1, 0));

  const activeScope = allScopes[clampedIdx] || null;

  const setActiveScope = (idx) => {
    setActiveScopeIdx(Math.max(0, Math.min(idx, allScopes.length - 1)));
  };

  // PRIMARY teaching scope used by the single-class teacher pages and as the
  // token-level scope on the server:
  //   1. the active scope (switcher), if any
  //   2. the Class Teacher homeroom, if any
  //   3. the first active teaching assignment
  //   4. the legacy class/section carried on the account (backward compat)
  const primaryScope = useMemo(() => {
    if (activeScope) return activeScope;
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
  }, [activeScope, classTeacherAssignments, teachingScopes, user?.class, user?.section]);

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
    // Multi-class switching
    allScopes,
    activeScope,
    activeScopeIdx: clampedIdx,
    setActiveScope,
    // Assignment-aware extras
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