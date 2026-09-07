import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  LayoutDashboard,
  CalendarCheck,
  UserPlus,
  MessageSquare,
  Bell,
  BookOpenCheck,
  PartyPopper,
  CalendarDays,
  Users,
  ClipboardList,
  Wallet,
  FileBarChart2,
  BarChart3,
  Boxes,
  Bus,
  CreditCard,
  GraduationCap,
  X,
  ScrollText,
  BookOpen,
  BedDouble,
  Banknote,
  UserCog,
  Building2,
  UserRoundCog,
} from "lucide-react";
import { selectSchool, selectUser } from "../store/selectors";
import { canSeeNavigation } from "../lib/scope";

const groups = [
  {
    label: "Platform",
    items: [
      {
        to: "/platform",
        icon: LayoutDashboard,
        label: "Platform Dashboard",
        end: true,
        scope: "platform",
      },
    ],
  },
  {
    label: "Schools",
    items: [
      {
        to: "/platform?tab=schools",
        icon: Building2,
        label: "Schools Management",
        scope: "platform",
      },
    ],
  },
  {
    label: "Users & Access",
    items: [
      {
        to: "/platform?tab=users",
        icon: UserRoundCog,
        label: "Users & Access",
        scope: "platform",
      },
    ],
  },
  {
    label: "Billing & Subscriptions",
    items: [
      { to: "/platform/plans", icon: Banknote, label: "Plans & Pricing", scope: "platform" },
      { to: "/platform/subscriptions", icon: CreditCard, label: "Subscriptions", scope: "platform" },
    ],
  },
  {
    label: "My Dashboards",
    items: [
      {
        to: "/",
        icon: LayoutDashboard,
        label: "Admin Dashboard",
        end: true,
        roles: ["super_admin", "school_admin"],
      },
      {
        to: "/staff-dashboard",
        icon: LayoutDashboard,
        label: "My Dashboard",
        end: true,
        roles: ["staff"],
      },
      {
        to: "/teacher-dashboard",
        icon: UserCog,
        label: "Class Teacher",
        roles: ["school_admin", "class_teacher"],
      },
      {
        to: "/student-dashboard",
        icon: GraduationCap,
        label: "Student / Parent",
        roles: ["school_admin", "student"],
      },
    ],
  },
  {
    label: "Academics",
    items: [
      {
        to: "/attendance",
        icon: CalendarCheck,
        label: "Attendance",
        perm: "attendance:read",
      },
      {
        to: "/timetable",
        icon: CalendarDays,
        label: "Timetable",
        perm: "timetable:read",
      },
      {
        to: "/homework",
        icon: BookOpenCheck,
        label: "Homework",
        perm: "homework:read",
      },
      {
        to: "/examination",
        icon: ClipboardList,
        label: "Examination",
        perm: "exams:read",
      },
      {
        to: "/report-card",
        icon: ScrollText,
        label: "Report Card",
        perm: "marks:read",
      },
      {
        to: "/library",
        icon: BookOpen,
        label: "Library Management",
        perm: "library:read",
      },
      {
        to: "/addstudent",
        icon: UserPlus,
        label: "Add Student",
        perm: "students:write",
      },
      {
        to: "/students",
        icon: Users,
        label: "Student Database",
        perm: "students:read",
      },
    ],
  },
  {
    label: "Admissions & Outreach",
    items: [
      {
        to: "/admission-enquiry",
        icon: UserPlus,
        label: "Admission Enquiry",
        perm: "admissions:read",
      },
      {
        to: "/communication",
        icon: MessageSquare,
        label: "Communication",
        roles: ["school_admin", "class_teacher", "staff"],
      },
      {
        to: "/notice-board",
        icon: Bell,
        label: "Notice Board",
        perm: "notices:read",
      },
      {
        to: "/events",
        icon: PartyPopper,
        label: "Events",
        perm: "events:read",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        to: "/fees-collection",
        icon: Wallet,
        label: "Fees Collection",
        perm: "fees:collect",
      },
      {
        to: "/online-payment",
        icon: CreditCard,
        label: "Online Fees Payment",
        perm: "fees:read",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        to: "/inventory",
        icon: Boxes,
        label: "Inventory Management",
        perm: "inventory:read",
      },
      {
        to: "/bus-tracking",
        icon: Bus,
        label: "Bus Tracking",
        perm: "transport:read",
      },
      {
        to: "/hostel",
        icon: BedDouble,
        label: "Hostel Management",
        perm: "hostel:read",
      },
    ],
  },
  {
    label: "Human Resources",
    items: [
      {
        to: "/leave",
        icon: FileBarChart2,
        label: "Leave Management",
        perm: "leaves:apply",
      },
      {
        to: "/payroll",
        icon: Banknote,
        label: "Payroll / Salary",
        perm: "payroll:view",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        to: "/reports",
        icon: BarChart3,
        label: "Reports",
        perm: "reports:view",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        to: "/users",
        icon: UserRoundCog,
        label: "Users & Access",
        perm: "users:manage",
      },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const school = useSelector(selectSchool);
  const user = useSelector(selectUser);
  const role = user?.role || "school_admin";

  const canSee = (item) => canSeeNavigation(item, user, role);

  const brandName = school?.shortName || "School ERP";
  const brandSession = school?.session
    ? `ERP · ${school.session}`
    : `ERP · ${new Date().getFullYear()}`;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-full w-72 bg-ink text-white flex flex-col
        transform transition-transform duration-200 lg:translate-x-0
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber flex items-center justify-center text-ink shrink-0">
              <GraduationCap size={20} strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="font-display font-bold text-[15px] tracking-tight">
                {brandName}
              </p>
              <p className="text-[11px] text-white/50">
                {role === "super_admin" ? "Platform Owner" : brandSession}
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

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
          {groups.map((group) => {
            const items = group.items.filter(canSee);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="mb-5">
                <p className="px-3 mb-1.5 text-[11px] font-semibold text-white/35 tracking-wide">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
                          isActive
                            ? "bg-amber text-ink"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
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
            <div className="rounded-xl bg-white/5 p-3.5 mb-3">
              <p className="text-[12px] font-semibold text-white/90">
                {school.name}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                {school.code} · {school.session}
              </p>
            </div>
          )}
          <div className="rounded-xl bg-white/5 p-3.5">
            <p className="text-[12.5px] font-semibold text-white/90">
              Need help?
            </p>
            <p className="text-[11.5px] text-white/50 mt-0.5 leading-relaxed">
              Visit the admin support desk or call the IT helpdesk at ext. 204.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
