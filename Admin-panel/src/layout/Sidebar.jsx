import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import { X, Send } from "lucide-react";
import { selectSchool, selectUser } from "../store/selectors";
import { canSeeNavigation } from "../lib/scope";
import { resolvePersona, isPersonaStaff } from "../lib/persona";
import { PERSONA_NAV } from "../lib/personaNav";
import { sessionLabel } from "../lib/session";
import { useTeacherContext } from "../pages/teacher/useTeacherContext";
import { groups, STUDENT_NAV, PARENT_NAV } from "./sidebarNavData";

export default function Sidebar({ open, onClose }) {
  const school = useSelector(selectSchool);
  const user = useSelector(selectUser);
  const role = user?.role || "school_admin";
  const teacherCtx = useTeacherContext();

  const canSee = (item) => canSeeNavigation(item, user, role);

  const persona = isPersonaStaff(user) ? resolvePersona(user) : null;
  const navGroups = persona
    ? PERSONA_NAV[persona.key] || []
    : role === "student"
      ? STUDENT_NAV
      : role === "parent"
        ? PARENT_NAV
        : groups;

  const brandTagline = "Learning Today, Leading Tomorrow";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-full w-72 bg-navy text-white flex flex-col
        transform transition-transform duration-200 lg:translate-x-0
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            {school?.logo ? (
              <img
                src={school.logo}
                alt=""
                className="w-9 h-9 rounded-lg object-contain shrink-0 bg-white/10"
              />
            ) : (
              <img
                src="/ZipschoolOS-Transparent-logo.png"
                alt=""
                className="w-9 h-9 object-contain shrink-0"
              />
            )}
            <div className="leading-tight">
              <p className="font-display font-bold text-[15px] tracking-tight">
                ZipschoolOS
              </p>
              <p className="text-[11px] text-slate-400">
                {role === "super_admin" ? "Platform Owner" : brandTagline}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thinner py-4 px-3">
          {navGroups.map((group) => {
            if (!persona && role === "teacher" && !group.teacherOnly) return null;

            const items = persona ? group.items : group.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-5">
                <p className="px-3 mb-1.5 text-[11px] font-semibold text-slate-400 tracking-wide">
                  {group.label}
                </p>
                {group.teacherOnly && role === "teacher" && teacherCtx?.allScopes?.length > 1 && (
                  <div className="mx-3 mb-2 rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold px-1 mb-1.5">
                      Active Class
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {teacherCtx.allScopes.map((s, i) => (
                        <button
                          key={`${s.class}-${s.section}`}
                          onClick={() => teacherCtx.setActiveScope(i)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                            i === teacherCtx.activeScopeIdx
                              ? "bg-primary text-white"
                              : "text-slate-400 hover:text-white hover:bg-ink-light"
                          }`}
                        >
                          {s.class}-{s.section || "?"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/60 ${
                          isActive
                            ? "bg-info text-white shadow-[0_8px_20px_-12px_rgba(37,99,235,0.95)]"
                            : "text-slate-300 hover:bg-ink-light hover:text-white"
                        }`
                      }
                    >
                      <item.icon size={17} strokeWidth={2} />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
          {school && (
            <div className="rounded-xl bg-white/5 p-3.5">
              <p className="text-[12px] font-semibold text-white/90">
                {school.name}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {school.code} Â· {sessionLabel(school) || "â€”"}
              </p>
            </div>
          )}
          <div className="mt-3.5 flex items-end justify-between gap-2 px-1">
            <p className="text-[11px] font-medium leading-snug text-white/35">
              Better Learning
              <br />
              Brighter Future
            </p>
            <Send size={20} className="mb-0.5 shrink-0 text-info/80" aria-hidden="true" />
          </div>
        </div>
      </aside>
    </>
  );
}