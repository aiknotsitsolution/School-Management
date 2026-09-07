import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  Building2,
  LogOut,
} from "lucide-react";
import { api } from "../lib/api";
import { selectActiveSchoolId, selectRole, selectSchool, selectUser } from "../store/selectors";
import { logout, setActiveSchoolId } from "../store/authSlice";

const roleLabel = (role, designation) => {
  if (role === "super_admin") return "Platform Owner";
  if (role === "school_admin" || role === "admin") return "School Admin";
  if (role === "class_teacher" || role === "teacher") return "Class Teacher";
  if (role === "staff") return designation ? `Staff · ${designation}` : "Staff";
  if (role === "student" || role === "parent") return "Student / Parent";
  return "User";
};

function InitialsAvatar({ name }) {
  const initials = (name || "U")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-ink text-amber flex items-center justify-center font-semibold text-[13px] shrink-0">
      {initials}
    </div>
  );
}

export default function Topbar({ onMenuClick, title }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const role = useSelector(selectRole);
  const activeSchoolId = useSelector(selectActiveSchoolId);
  const [schools, setSchools] = useState([]);

  const isSuperAdmin = role === "super_admin";
  const scopedSchoolId = school?.id || activeSchoolId;

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.schools
      .list()
      .then(({ data }) => setSchools(data || []))
      .catch(() => {});
  }, [isSuperAdmin]);

  const switchSchool = (id) => {
    if (!id) return;
    dispatch(setActiveSchoolId(id));
    window.location.reload();
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-16 bg-white border-b border-black/[0.06] flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-ink p-1 -ml-1">
          <Menu size={22} />
        </button>
        <h1 className="font-display font-semibold text-lg sm:text-xl text-ink tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden md:flex items-center gap-2 bg-paper rounded-full px-4 py-2 w-64 border border-black/[0.06]">
          <Search size={16} className="text-slate-text/60" />
          <input
            placeholder="Search students, staff, records..."
            className="bg-transparent outline-none text-[13px] w-full placeholder:text-slate-text/50"
          />
        </div>

        {isSuperAdmin && (
          <div className="hidden sm:flex items-center gap-2 bg-paper rounded-lg px-3 py-1.5 border border-black/[0.06]">
            <Building2 size={15} className="text-slate-text/60" />
            <select
              value={scopedSchoolId || ""}
              onChange={(event) => switchSchool(event.target.value)}
              className="bg-transparent outline-none text-[12.5px] font-medium text-ink max-w-[200px] truncate"
              title="Active school (ascending tenant)"
            >
              <option value="">— No school —</option>
              {schools.map((item) => (
                <option key={item.id || item._id} value={item.id || item._id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <button className="relative w-9 h-9 rounded-full bg-paper border border-black/[0.06] flex items-center justify-center hover:bg-amber/10 transition-colors">
          <Bell size={17} className="text-ink" />
          <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-alert"></span>
        </button>

        <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-black/[0.08]">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <InitialsAvatar name={user?.name} />
          )}
          <div className="hidden sm:block leading-tight">
            <p className="text-[13px] font-semibold text-ink">{user?.name}</p>
            <p className="text-[11px] text-slate-text/70 capitalize">
              {roleLabel(role, user?.designation)}
            </p>
          </div>
          <ChevronDown
            size={15}
            className="hidden sm:block text-slate-text/50"
          />
        </div>

        <button
          onClick={handleLogout}
          title="Sign out"
          className="w-9 h-9 rounded-full bg-paper border border-black/[0.06] flex items-center justify-center hover:bg-alert/10 hover:text-alert transition-colors"
        >
          <LogOut size={16} className="text-ink" />
        </button>
      </div>
    </header>
  );
}