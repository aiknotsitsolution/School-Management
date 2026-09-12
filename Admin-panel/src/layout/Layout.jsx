import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import SupportChatbot from "../components/SupportChatbot";
import { selectSchool } from "../store/selectors";

export default function Layout() {
  const [open, setOpen] = useState(false);
  const school = useSelector(selectSchool);

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
              {school.session && (
                <>
                  <span className="text-slate-text/40">·</span>
                  <span>Session {school.session}</span>
                </>
              )}
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <SupportChatbot />
    </div>
  );
}
