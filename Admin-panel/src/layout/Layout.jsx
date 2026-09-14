import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { CalendarDays } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import SupportChatbot from "../components/SupportChatbot";
import { selectSchool, selectRole } from "../store/selectors";
import { sessionLabel, schoolNeedsConfig, getDismissConfigKey } from "../lib/session";

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
  const role = useSelector(selectRole);

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

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar open={open} onClose={() => setOpen(false)} />
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

      {needsConfig && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-0 shadow-2xl overflow-hidden">
            <div className="bg-amber/10 px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber/20">
                  <CalendarDays className="h-5 w-5 text-amber-dark" />
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
                className="rounded-lg bg-amber px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-amber-dark"
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
