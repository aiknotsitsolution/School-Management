import { useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import SupportChatbot from "../components/SupportChatbot";
import { selectSchool, selectRole } from "../store/selectors";
import { sessionLabel, schoolNeedsConfig } from "../lib/session";

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const navigate = useNavigate();
  const school = useSelector(selectSchool);
  const role = useSelector(selectRole);
  const needsConfig = useMemo(() => {
    if (promptDismissed) return false;
    if (!["school_admin", "admin"].includes(role)) return false;
    return schoolNeedsConfig(school);
  }, [promptDismissed, role, school]);

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
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-[15px] font-semibold text-slate-900">Academic session needs confirmation</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-text/80">
              Session <span className="font-semibold text-slate-900">{sessionLabel(school)}</span> is currently set from
              onboarding defaults. Please review and save your academic configuration before adding students, fees or
              timetables.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPromptDismissed(true)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-[13px] font-medium text-slate-text transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setPromptDismissed(true);
                  navigate("/account", { state: { configTab: "organization" } });
                }}
                className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-white transition hover:bg-primary/90"
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
