import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import { CalendarDays } from "lucide-react";
import SidebarMui from "./SidebarMui";
import { sidebarTheme } from "./sidebarTheme";
import { groups, STUDENT_NAV, PARENT_NAV } from "./sidebarNavData";
import Topbar from "./Topbar";
import SupportChatbot from "../components/SupportChatbot";
import AttendanceCheckinModal from "../components/AttendanceCheckinModal";
import { selectSchool, selectRole, selectUser, selectImpersonating, selectImpersonateReadOnly } from "../store/selectors";
import { canSeeNavigation } from "../lib/scope";
import { resolvePersona, isPersonaStaff } from "../lib/persona";
import { PERSONA_NAV } from "../lib/personaNav";
import { sessionLabel, schoolNeedsConfig, getDismissConfigKey } from "../lib/session";
import { useTeacherContext } from "../pages/teacher/useTeacherContext";

const EMPTY_NAV = [];

// Self-sourcing so `nav` stays referentially stable: `useTeacherContext` returns
// a fresh object every render, and the assignments fetch is module-cached, so
// calling it here costs no extra request while keeping the active-scope index
// live through the shared listener store.
function TeacherScopeSwitcher() {
  const { allScopes, activeScopeIdx, setActiveScope } = useTeacherContext();
  if (!allScopes || allScopes.length < 2) return null;

  return (
    <div className="rounded-lg bg-slate-100 p-2">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 px-1 mb-1.5">
        Active Class
      </p>
      <div className="flex flex-wrap gap-1">
        {allScopes.map((s, i) => (
          <button
            key={`${s.class}-${s.section}`}
            type="button"
            onClick={() => setActiveScope(i)}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
              i === activeScopeIdx
                ? "bg-primary text-white"
                : "text-slate-500 hover:bg-white"
            }`}
          >
            {s.class}-{s.section || "?"}
          </button>
        ))}
      </div>
    </div>
  );
}

function isOnboardingDefaultDates(session) {
  if (!session?.startDate || !session?.endDate) return false;
  const s = new Date(session.startDate);
  const e = new Date(session.endDate);
  return s.getUTCFullYear() + 1 === e.getUTCFullYear()
    && s.getUTCMonth() === 3 && s.getUTCDate() === 1
    && e.getUTCMonth() === 2 && e.getUTCDate() === 31;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const navigate = useNavigate();
  const school = useSelector(selectSchool);
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);
  const impersonating = useSelector(selectImpersonating);
  const readOnly = useSelector(selectImpersonateReadOnly);

  const persona = isPersonaStaff(user) ? resolvePersona(user) : null;

  const baseGroups = useMemo(() => {
    if (persona) return PERSONA_NAV[persona.key] || EMPTY_NAV;
    if (role === "student") return STUDENT_NAV;
    if (role === "parent") return PARENT_NAV;
    return groups;
  }, [persona, role]);

  const nav = useMemo(
    () =>
      baseGroups
        .filter((g) => !g.teacherOnly || role === "teacher")
        .map((g, i) => ({
          id: g.id || `grp-${g.label || i}`,
          header: g.header || g.label,
          items: g.items || [],
          extra: g.teacherOnly && role === "teacher" ? <TeacherScopeSwitcher /> : null,
        })),
    [baseGroups, role],
  );

  // Persona nav is already curated, so it bypasses the permission filter the
  // same way the previous sidebar did.
  const canSee = useMemo(
    () =>
      persona
        ? () => true
        : (item) =>
            canSeeNavigation(item, user, role, { impersonating, readOnly }),
    [persona, user, role, impersonating, readOnly],
  );

  // The sidebar brands the *tenant*, not the product: once a school is resolved
  // its own logo and name head the rail, so one ERP instance serving many
  // schools reads as each school's own system. `logo` is deliberately left empty
  // when the school has not uploaded one — BrandMark then falls back to the
  // school's initials, which beats silently showing the product mark to a school
  // that never opted into it. ZipschoolOS branding is kept for the pre-auth
  // screens (Landing/Login/Splash), where no tenant exists yet.
  //
  // The subtitle is `shortName · session`: shortName is the field schools set
  // explicitly for this spot ("Short name used in the sidebar" in School
  // settings), so `code` is only the fallback for schools that never filled it
  // in. Listing both would just print the same identity twice.
  const sidebarBrand = useMemo(
    () => ({
      name: school?.name || "",
      code: school
        ? [school.shortName || school.code, sessionLabel(school)]
            .filter(Boolean)
            .join(" · ")
        : "School ERP",
      logo: school?.logo || "",
    }),
    [school],
  );

  const needsConfig = useMemo(() => {
    if (!["school_admin", "admin"].includes(role)) return false;
    if (!schoolNeedsConfig(school)) return false;
    if (promptDismissed) return false;
    if (typeof localStorage !== "undefined") {
      if (localStorage.getItem(getDismissConfigKey(school?.id || school?._id)) === "1") return false;
    }
    const session = school?.currentSession || school?.school?.currentSession;
    if (session && !isOnboardingDefaultDates(session)) return false;
    return true;
  }, [promptDismissed, role, school]);

  const dismissConfigPrompt = () => {
    setPromptDismissed(true);
    try { localStorage.setItem(getDismissConfigKey(school?.id || school?._id), "1"); } catch {}
  };

  const goToConfig = () => {
    dismissConfigPrompt();
    navigate("/account", { state: { configTab: "organization" } });
  };

  // Every Staff/Teacher account (persona workspaces included) owes the school
  // today's attendance + check-in, so the gate lives in the app shell and runs
  // once per login rather than once per dashboard. The modal probes
  // /staff/attendance/me/today itself and renders nothing when the record is
  // already marked AND checked in — nothing flashes for people who are done.
  // Platform admins and impersonated sessions are out of scope: they manage
  // attendance rather than their own.
  const owesCheckin =
    !impersonating && ["teacher", "staff"].includes(role);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <ThemeProvider theme={sidebarTheme}>
        <SidebarMui
          nav={nav}
          brand={sidebarBrand}
          // The rail footer no longer repeats the school/session block — the
          // brand header at the top already carries the school, and printing it
          // twice read as duplicated filler.
          showSchoolSession={false}
          canSee={canSee}
          open={open}
          onClose={() => setOpen(false)}
          mobileBreakpoint="lg"
        />
      </ThemeProvider>
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          {school && (
            <div className="flex items-center gap-2 mb-4 text-[11.5px] text-slate-text/70">
              <span className="font-semibold truncate">
                {school.name} · {school.code}
              </span>
              {sessionLabel(school) && (
                <>
                  <span className="text-slate-text/40">·</span>
                  <span>Session {sessionLabel(school)}</span>
                </>
              )}
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <SupportChatbot />
      {owesCheckin && <AttendanceCheckinModal userName={user?.name || "Staff"} />}

      {needsConfig && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-0 shadow-2xl overflow-hidden">
            <div className="bg-primary/10 px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                  <CalendarDays className="h-5 w-5 text-primary-dark" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">Academic Session Needs Confirmation</h3>
                  <p className="text-[12px] text-slate-text/60">Set up your school year before proceeding</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4">
              <p className="text-[13px] leading-relaxed text-slate-text">
                Session{" "}
                <span className="font-semibold text-ink">{sessionLabel(school)}</span> was created from onboarding
                defaults. Please review the start/end dates and session name before adding students, fees or timetables.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-3">
              <button
                type="button"
                onClick={dismissConfigPrompt}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-text transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={goToConfig}
                className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-primary-dark"
              >
                Save now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
