import { NavLink } from "react-router-dom";
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
} from "lucide-react";
const school = {
  shortName: "School ERP",
  session: String(new Date().getFullYear()),
};

const groups = [
  {
    label: "Overview",
    items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard", end: true }],
  },
  {
    label: "Academics",
    items: [
      { to: "/attendance", icon: CalendarCheck, label: "Attendance" },
      { to: "/timetable", icon: CalendarDays, label: "Timetable" },
      { to: "/homework", icon: BookOpenCheck, label: "Homework" },
      { to: "/examination", icon: ClipboardList, label: "Examination" },
      { to: "/report-card", icon: ScrollText, label: "Report Card" },
      { to: "/library", icon: BookOpen, label: "Library Management" },
      { to: "/addstudent", icon: UserPlus, label: "Add Student" },
      { to: "/students", icon: Users, label: "Student Database" },
    ],
  },
  {
    label: "Admissions & Outreach",
    items: [
      { to: "/admission-enquiry", icon: UserPlus, label: "Admission Enquiry" },
      { to: "/communication", icon: MessageSquare, label: "Communication" },
      { to: "/notice-board", icon: Bell, label: "Notice Board" },
      { to: "/events", icon: PartyPopper, label: "Events" },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/fees-collection", icon: Wallet, label: "Fees Collection" },
      { to: "/online-payment", icon: CreditCard, label: "Online Fees Payment" },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/inventory", icon: Boxes, label: "Inventory Management" },
      { to: "/bus-tracking", icon: Bus, label: "Bus Tracking" },
      { to: "/hostel", icon: BedDouble, label: "Hostel Management" },
    ],
  },
  {
    label: "Human Resources",
    items: [
      { to: "/leave", icon: CalendarDays, label: "Leave Management" },
      { to: "/payroll", icon: Banknote, label: "Payroll / Salary" },
    ],
  },
  {
    label: "Insights",
    items: [{ to: "/reports", icon: BarChart3, label: "Reports" }],
  },
];

export default function Sidebar({ open, onClose }) {
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
                {school.shortName}
              </p>
              <p className="text-[11px] text-white/50">
                ERP · {school.session}
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
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 mb-1.5 text-[11px] font-semibold text-white/35 tracking-wide">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
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
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
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
