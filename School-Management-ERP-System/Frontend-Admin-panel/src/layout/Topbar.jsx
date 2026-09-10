import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Bell,
  CheckCheck,
  ChevronDown,
  LogOut,
  Inbox,
} from "lucide-react";
import { selectRole, selectUser } from "../store/selectors";
import { logout } from "../store/authSlice";
import { api } from "../lib/api";

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
  const role = useSelector(selectRole);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        api.notifications.list("limit=8"),
        api.notifications.unreadCount(),
      ]);
      setItems(list.data || []);
      setUnreadCount(count.unreadCount || 0);
    } catch {
      /* notifications unavailable — keep previous state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 45000);
    const unsubscribe = api.notifications.subscribe({
      onData: () => refresh(),
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [refresh]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    await api.notifications.markAllRead().catch(() => {});
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleOpenItem = async (item) => {
    if (!item.read) {
      await api.notifications.markRead(item._id).catch(() => {});
      setUnreadCount((n) => Math.max(0, n - 1));
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
    }
    setOpen(false);
    navigate(item.link || "/notifications");
  };

  const relativeTime = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
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

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-full bg-paper border border-black/[0.06] flex items-center justify-center hover:bg-amber/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell size={17} className="text-ink" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-alert text-white text-[10px] font-semibold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-black/[0.08] shadow-lg shadow-black/5 overflow-hidden z-30">
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
                <p className="text-[13px] font-semibold text-ink">Notifications</p>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-[11px] text-slate-text/70 hover:text-ink transition-colors"
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate("/notifications");
                    }}
                    className="text-[11px] font-medium text-amber hover:text-amber/80 transition-colors"
                  >
                    View all
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-black/[0.04]">
                {items.length === 0 ? (
                  <div className="px-4 py-10 flex flex-col items-center text-center gap-2">
                    <Inbox size={22} className="text-slate-text/40" />
                    <p className="text-[12px] text-slate-text/60">No notifications yet</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <button
                      key={item._id}
                      onClick={() => handleOpenItem(item)}
                      className={`w-full text-left px-4 py-3 hover:bg-paper transition-colors ${item.read ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        {!item.read && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber shrink-0"></span>
                        )}
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-ink truncate">
                            {item.title}
                          </p>
                          {item.message && (
                            <p className="text-[11px] text-slate-text/70 line-clamp-2">
                              {item.message}
                            </p>
                          )}
                        </div>
                        <span className="ml-auto shrink-0 text-[10px] text-slate-text/50">
                          {relativeTime(item.createdAt)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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