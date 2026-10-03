import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  CheckCheck,
  ChevronDown,
  Inbox,
  UserRound,
  Settings,
  School,
  ShieldCheck,
  GraduationCap,
  Briefcase,
} from "lucide-react";
// The topbar's four action buttons use MUI's Rounded icons — the same set the
// sidebar navigation uses (see SidebarMui) — rather than the outline Lucide
// set, so the shell reads as one family. Rounded is still solid, which is what
// a stroked 9x9 glyph in a circular button lacked.
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { selectRole, selectUser } from "../store/selectors";
import { logout, setActiveSchoolId } from "../store/authSlice";
import { hasPermission, legacyRole } from "../lib/permissions";
import { useThemeMode } from "../hooks/useThemeMode.jsx";
import BranchSwitcher from "./BranchSwitcher.jsx";
import { api } from "../lib/api";
import { onSocket } from "../lib/socket";

const roleLabel = (role, designation) => {
  if (role === "super_admin") return "Platform Owner";
  if (role === "school_admin" || role === "admin") return "School Admin";
  if (role === "teacher") return "Teacher";
  if (role === "staff") return designation ? `Staff · ${designation}` : "Staff";
  if (role === "student" || role === "parent") return "Student / Parent";
  return "User";
};

const TITLE_OVERRIDES = {
  "student-dashboard": "Dashboard",
  "teacher-dashboard": "Dashboard",
  "staff-dashboard": "Dashboard",
  "parent-dashboard": "Dashboard",
  "admission-counsellor": "Counsellor Workspace",
  platform: "Platform",
  accountant: "Accountant Dashboard",
  librarian: "Library Dashboard",
  transport: "Transport Dashboard",
  reception: "Reception Dashboard",
  "study-materials": "Study Materials",
  "report-card": "Report Card",
  diary: "Class Diary",
  users: "Students & Users",
  teachers: "Staff & Teachers",
};

function prettify(segment) {
  if (!segment) return "Dashboard";
  if (TITLE_OVERRIDES[segment]) return TITLE_OVERRIDES[segment];
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function routeTitle(path) {
  if (path === "/" || path === "/dashboard") return "Dashboard";
  const segments = path.split("/").filter(Boolean);
  let last = segments[segments.length - 1];
  if (/^[0-9a-f]{24}$/i.test(last) || /^\d+$/.test(last)) {
    last = segments[segments.length - 2];
  }
  return prettify(last);
}

function InitialsAvatar({ name }) {
  const initials = (name || "U")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-[13px] shrink-0">
      {initials}
    </div>
  );
}

export default function Topbar({ onMenuClick }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useSelector(selectUser);
  const role = useSelector(selectRole);
  // A tenant switcher is deliberately not rendered for the platform owner, so a
  // school picked in an earlier session is dropped instead of silently keeping
  // the platform user inside someone else's tenant.
  const activeSchoolId = useSelector((s) => s.auth?.activeSchoolId);
  const { mode, toggle: toggleTheme } = useThemeMode();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // The Thread model stores no read/unread flag (see
  // communication-service/src/models/Thread.js), so "unread" is derived on the
  // client: a thread counts as new while its lastMessageAt is newer than the
  // moment we last looked at the inbox.
  const [unreadMessages, setUnreadMessages] = useState(0);
  const dropdownRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ students: [], staff: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);

  // The global search queries the student AND staff directories in one box, so
  // it is offered only to roles holding both read permissions. super_admin's
  // wildcard bundle passes; student/parent bundles hold neither.
  const canSearchDirectory =
    hasPermission(user, "students:read") && hasPermission(user, "staff:read");

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
    // Push-only: notification:new arrives over the socket, so the list and the
    // badge update the moment one is created. The slow interval is kept only as
    // a reconciliation net for the case where a push was missed while the tab
    // was suspended (socket reconnect drops nothing, but a dropped network does).
    const reconcile = setInterval(refresh, 5 * 60 * 1000);
    const offNotification = onSocket("notification:new", () => refresh());
    return () => {
      clearInterval(reconcile);
      offNotification();
    };
  }, [refresh]);

  // Unread messages badge.
  //
  // The count is server-derived: each conversation participant carries their own
  // lastReadAt, so the number is correct per user and survives a device change.
  // A push keeps it current — no polling, and no localStorage clock that would
  // wrongly mark pre-existing threads as unread on a first visit.

  // /messages is wrapped in RequireRole for these roles only, so the badge is
  // gated to match — otherwise the button would dead-end for other roles.
  const canMessage = [
    "student",
    "parent",
    "teacher",
    "staff",
    "school_admin",
    "admin",
    "super_admin",
  ].includes(role);

  const refreshMessages = useCallback(async () => {
    if (!canMessage) return;
    try {
      const { data } = await api.conversations.list();
      const list = Array.isArray(data) ? data : [];
      setUnreadMessages(list.reduce((sum, c) => sum + (c.unread || 0), 0));
    } catch {
      /* communications unavailable — leave the badge as it was */
    }
  }, [canMessage]);

  useEffect(() => {
    if (!canMessage) return;
    refreshMessages();
    // Pushed updates only: an incoming message re-counts without a poll, and a
    // conversation the user has open in another tab stays in sync because the
    // reply endpoint marks the sender's receipt server-side.
    const offMessage = onSocket("conversation:message", () => refreshMessages());
    const offCreated = onSocket("conversation:created", () => refreshMessages());
    return () => {
      offMessage();
      offCreated();
    };
  }, [refreshMessages, canMessage]);

  // Opening the inbox is what marks it read — the list endpoint is what clears
  // each participant's receipt, so re-reading it is what zeroes the badge.
  useEffect(() => {
    if (pathname !== "/messages" || !canMessage) return;
    // eslint-disable-next-line react/set-state-in-effect -- the badge must clear
    // the moment the inbox opens, not after the round trip resolves.
    setUnreadMessages(0);
    const timer = setTimeout(refreshMessages, 500);
    return () => clearTimeout(timer);
  }, [pathname, canMessage, refreshMessages]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Profile menu closes on outside click and Escape while open.
  useEffect(() => {
    if (!profileOpen) return;
    const onClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  // Global search
  useEffect(() => {
    if (!searchOpen) return;
    const onClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [searchOpen]);

  useEffect(() => {
    // Only roles that may read the student and staff directories get a search
    // box at all. A student/parent has neither permission, so the two list
    // calls below would 403 and the widget would be permanently empty.
    // Bailing out here is the actual fix: no directory request is ever issued.
    // The widget is unmounted by the `canSearchDirectory` gate below, so any
    // leftover query/results stay invisible and need no clearing.
    if (!canSearchDirectory) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults({ students: [], staff: [] });
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(() => {
      Promise.allSettled([
        api.students.list(`search=${encodeURIComponent(q)}&limit=5`),
        api.staff.list(`search=${encodeURIComponent(q)}&limit=5`),
      ]).then(([sRes, stRes]) => {
        setSearchResults({
          students: sRes.status === "fulfilled" ? (sRes.value.data || []).slice(0, 5) : [],
          staff: stRes.status === "fulfilled" ? (stRes.value.data || []).slice(0, 5) : [],
        });
        setSearchLoading(false);
      });
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery, canSearchDirectory]);

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

  // The platform owner is platform-scope only: no tenant switcher, no campus
  // switcher, so a stale school from a previous session must not linger.
  useEffect(() => {
    if (role === "super_admin" && activeSchoolId) {
      dispatch(setActiveSchoolId(null));
    }
  }, [role, activeSchoolId, dispatch]);

  // One source of truth: `legacyRole` comes from lib/permissions and only
  // normalises the legacy "admin" role. Do not redeclare a role map here — a
  // local `parent: "student"` mapping sent parents to a /student/* route that
  // RequireRole then rejected, bouncing them through the landing gate.
  const profileTarget = {
    school_admin: "/profile",
    super_admin: "/profile",
    staff: "/staff/profile",
    teacher: "/teacher/profile",
    student: "/student/profile",
  }[legacyRole(role)] || "/profile";
  const settingsTarget = legacyRole(role) === "super_admin" ? "/platform/settings" : "/settings";
  const manageItem =
    legacyRole(role) === "super_admin"
      ? { label: "Manage Platform", icon: ShieldCheck, to: "/platform" }
      : legacyRole(role) === "school_admin"
        ? { label: "Manage School", icon: School, to: "/manage-school" }
        : null;

  const goProfile = (path) => {
    setProfileOpen(false);
    navigate(path);
  };

  const pageTitle = routeTitle(pathname);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 sticky top-0 z-20">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-ink p-1 -ml-1" aria-label="Open navigation">
          <Menu size={22} />
        </button>
        {/* The page name lives in the sidebar and the browser tab; the topbar
            keeps only the accessible name so the row does not repeat itself. */}
        <span className="sr-only">{pageTitle}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <BranchSwitcher />
        {canSearchDirectory ? (
        <div className="hidden md:block relative" ref={searchRef}>
          <div className="flex items-center gap-2 bg-paper rounded-full px-4 py-2 w-64 border border-slate-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 transition-all">
            <Search size={16} className="text-slate-text/60" />
            <input
              placeholder="Search students, staff..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              className="bg-transparent outline-none text-[13px] w-full placeholder:text-slate-text/50"
            />
          </div>

          {searchOpen && searchQuery.trim().length >= 2 && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl border border-slate-200 shadow-lg shadow-black/5 overflow-hidden z-30">
              {searchLoading ? (
                <div className="px-4 py-8 text-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-[12px] text-slate-text/60 mt-2">Searching...</p>
                </div>
              ) : (searchResults.students.length === 0 && searchResults.staff.length === 0) ? (
                <div className="px-4 py-8 text-center">
                  <Search size={20} className="text-slate-text/30 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-text/60">No results for "{searchQuery.trim()}"</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.students.length > 0 && (
                    <div>
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                        <GraduationCap size={13} className="text-primary" />
                        <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Students</p>
                      </div>
                      {searchResults.students.map((s) => (
                        <button
                          key={s._id}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); navigate("/students"); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-paper transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <GraduationCap size={14} className="text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-ink truncate">{s.name}</p>
                            <p className="text-[11px] text-slate-text/60">{s.admissionNo || "—"} · Class {s.class}-{s.section}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.staff.length > 0 && (
                    <div>
                      <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                        <Briefcase size={13} className="text-primary" />
                        <p className="text-[11px] font-semibold text-slate-text/60 uppercase tracking-wide">Staff</p>
                      </div>
                      {searchResults.staff.map((s) => (
                        <button
                          key={s._id}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); navigate("/teachers"); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-paper transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Briefcase size={14} className="text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-ink truncate">{s.name}</p>
                            <p className="text-[11px] text-slate-text/60">{s.employeeId || "—"} · {s.designation || "Staff"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        ) : null}

        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-full bg-paper border border-slate-200 flex items-center justify-center hover:bg-primary/10 transition-colors"
          aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
        >
          {mode === "dark" ? (
            <DarkModeRoundedIcon sx={{ fontSize: 18 }} className="text-ink" />
          ) : (
            <LightModeRoundedIcon sx={{ fontSize: 18 }} className="text-ink" />
          )}
        </button>

        {canMessage ? (
        <button
          onClick={() => navigate("/messages")}
          className="relative w-9 h-9 rounded-full bg-paper border border-slate-200 flex items-center justify-center hover:bg-primary/10 transition-colors"
          aria-label="Communications"
          title="Communications"
        >
          <ChatRoundedIcon sx={{ fontSize: 18 }} className="text-ink" />
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </button>
        ) : null}

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-full bg-paper border border-slate-200 flex items-center justify-center hover:bg-primary/10 transition-colors"
            aria-label="Notifications"
          >
            <NotificationsRoundedIcon sx={{ fontSize: 18 }} className="text-ink" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-alert text-white text-[10px] font-semibold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-slate-200 shadow-lg shadow-black/5 overflow-hidden z-30">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
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
                    className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    View all
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
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
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
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

        <div className="relative pl-2 sm:border-l sm:border-slate-200" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((p) => !p)}
            aria-label="Account menu"
            aria-expanded={profileOpen}
            className="flex items-center gap-2 px-2 -mx-1.5 py-1.5 -my-1.5 rounded-xl hover:bg-paper transition-colors"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <InitialsAvatar name={user?.name} />
            )}
            <div className="hidden sm:block leading-tight text-left">
              <p className="text-[13px] font-semibold text-ink">{user?.name}</p>
              <p className="text-[11px] text-slate-text/70 capitalize">
                {roleLabel(role, user?.designation)}
              </p>
            </div>
            <ChevronDown
              size={15}
              className={`hidden sm:block text-slate-text/50 transition-transform ${
                profileOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl border border-slate-200 shadow-lg shadow-black/5 overflow-hidden z-30">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <InitialsAvatar name={user?.name} />
                )}
                <div className="min-w-0 leading-tight">
                  <p className="text-[13px] font-semibold text-ink truncate">
                    {user?.name}
                  </p>
                  <p className="text-[11px] text-slate-text/70 capitalize truncate">
                    {roleLabel(role, user?.designation)}
                  </p>
                </div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => goProfile(profileTarget)}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-ink hover:bg-paper flex items-center gap-3 transition-colors"
                >
                  <UserRound size={15} className="text-slate-text/60" />
                  My Profile
                </button>
                <button
                  onClick={() => goProfile(settingsTarget)}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-ink hover:bg-paper flex items-center gap-3 transition-colors"
                >
                  <Settings size={15} className="text-slate-text/60" />
                  Settings
                </button>
                {manageItem && (
                  <button
                    onClick={() => goProfile(manageItem.to)}
                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-ink hover:bg-paper flex items-center gap-3 transition-colors"
                  >
                    <manageItem.icon size={15} className="text-slate-text/60" />
                    {manageItem.label}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          title="Sign out"
          className="w-9 h-9 rounded-full bg-paper border border-slate-200 flex items-center justify-center hover:bg-alert/10 hover:text-alert transition-colors"
        >
          <LogoutRoundedIcon sx={{ fontSize: 18 }} className="text-ink" />
        </button>
      </div>
    </header>
  );
}