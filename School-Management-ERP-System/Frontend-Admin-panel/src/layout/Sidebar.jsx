import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  LayoutDashboard,
  CalendarCheck,
  UserPlus,
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
  UserRound,
  FileText,
} from "lucide-react";
import { selectSchool, selectUser } from "../store/selectors";
import { canSeeNavigation } from "../lib/scope";
import { resolvePersona, isPersonaStaff } from "../lib/persona";
import { PERSONA_NAV } from "../lib/personaNav";

const groups = [
  {
    label: "Platform",
    items: [
      {
        to: "/platform",
        icon: LayoutDashboard,
        label: "Dashboard",
        end: true,
        scope: "platform",
      },
    ],
  },
  {
    label: "School Operations",
    items: [
      {
        to: "/platform/onboarding",
        icon: UserPlus,
        label: "School Onboarding",
        scope: "platform",
      },
      {
        to: "/platform/schools",
        icon: Building2,
        label: "Schools Management",
        scope: "platform",
      },
    ],
  },
  {
    label: "Access & Security",
    items: [
      {
        to: "/platform/users",
        icon: UserRoundCog,
        label: "Users & Access",
        scope: "platform",
      },
      {
        to: "/platform/audit",
        icon: ScrollText,
        label: "Audit Logs",
        scope: "platform",
      },
    ],
  },
  {
    label: "Billing & Monetization",
    items: [
      { to: "/platform/plans", icon: Banknote, label: "Plans & Pricing", scope: "platform" },
      { to: "/platform/subscriptions", icon: CreditCard, label: "Subscriptions", scope: "platform" },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        to: "/platform/reports",
        icon: BarChart3,
        label: "Reports",
        scope: "platform",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        to: "/platform/settings",
        icon: UserCog,
        label: "Settings",
        scope: "platform",
      },
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
        to: "/admission-counsellor",
        icon: ClipboardList,
        label: "Counsellor Workspace",
        end: true,
        roles: ["staff"],
        designation: "admission_counsellor",
      },
      {
        to: "/teacher-dashboard",
        icon: UserCog,
        label: "Class Teacher",
        roles: ["class_teacher"],
      },
      {
        to: "/student-dashboard",
        icon: GraduationCap,
        label: "Student / Parent",
        roles: ["student"],
      },
    ],
  },
  {
    label: "Staff Tools",
    items: [
      {
        to: "/staff/my-attendance",
        icon: CalendarCheck,
        label: "My Attendance",
        roles: ["staff"],
      },
      {
        to: "/notifications",
        icon: Bell,
        label: "Notifications",
        roles: ["staff"],
      },
      {
        to: "/staff/profile",
        icon: UserRound,
        label: "My Profile",
        roles: ["staff"],
      },
    ],
  },
  {
    label: "My Teaching",
    teacherOnly: true,
    items: [
      {
        to: "/teacher-dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        end: true,
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/my-class",
        icon: Users,
        label: "My Class",
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/attendance",
        icon: CalendarCheck,
        label: "Attendance",
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/timetable",
        icon: CalendarDays,
        label: "Timetable",
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/homework",
        icon: BookOpenCheck,
        label: "Homework & Assignments",
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/exams",
        icon: ClipboardList,
        label: "Examinations",
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/performance",
        icon: BarChart3,
        label: "Class Performance",
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/notices",
        icon: Bell,
        label: "Notices",
        roles: ["class_teacher"],
      },
      {
        to: "/teacher/profile",
        icon: UserCog,
        label: "My Profile",
        roles: ["class_teacher"],
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

const STUDENT_NAV = [
  {
    label: "My Academics",
    items: [
      {
        to: "/student-dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        end: true,
        roles: ["student"],
      },
      {
        to: "/student/profile",
        icon: UserRound,
        label: "My Profile",
        roles: ["student"],
      },
      {
        to: "/student/attendance",
        icon: CalendarCheck,
        label: "My Attendance",
        roles: ["student"],
      },
      {
        to: "/student/timetable",
        icon: CalendarDays,
        label: "My Timetable",
        roles: ["student"],
      },
    ],
  },
  {
    label: "Learning",
    items: [
      {
        to: "/student/homework",
        icon: BookOpenCheck,
        label: "Homework & Assignments",
        roles: ["student"],
      },
      {
        to: "/student/exams",
        icon: ClipboardList,
        label: "Examinations",
        roles: ["student"],
      },
      {
        to: "/student/results",
        icon: BarChart3,
        label: "Results & Report Card",
        roles: ["student"],
      },
    ],
  },
  {
    label: "School Services",
    items: [
      {
        to: "/student/fees",
        icon: Wallet,
        label: "Fees & Payments",
        roles: ["student"],
      },
      {
        to: "/student/notices",
        icon: Bell,
        label: "Notices",
        roles: ["student"],
      },
      {
        to: "/student/library",
        icon: BookOpen,
        label: "My Library",
        roles: ["student"],
      },
      {
        to: "/student/transport",
        icon: Bus,
        label: "My Transport",
        roles: ["student"],
      },
      {
        to: "/student/documents",
        icon: FileText,
        label: "My Documents",
        roles: ["student"],
      },
      {
        to: "/student/hostel",
        icon: BedDouble,
        label: "My Hostel",
        roles: ["student"],
      },
      {
        to: "/student/events",
        icon: PartyPopper,
        label: "Events",
        roles: ["student"],
      },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const school = useSelector(selectSchool);
  const user = useSelector(selectUser);
  const role = user?.role || "school_admin";

  const canSee = (item) => canSeeNavigation(item, user, role);

  const persona = isPersonaStaff(user) ? resolvePersona(user) : null;
  const navGroups = persona
    ? PERSONA_NAV[persona.key] || []
    : role === "student"
      ? STUDENT_NAV
      : groups;

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
          {navGroups.map((group) => {
            if (!persona && role === "class_teacher" && !group.teacherOnly)
              return null;
            const items = persona ? group.items : group.items.filter(canSee);
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
