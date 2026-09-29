// Navigation data for the school ERP shell.
//
// Kept separate from `Sidebar.jsx` so the same definitions can be rendered by
// either sidebar implementation (see `SidebarMui.jsx` + `Layout.jsx`) and so
// this module stays free of React component code.
//
// A group is `{ label, items, teacherOnly? }`; a leaf is
// `{ to, label, icon, end?, perm?, roles?, scope?, designation? }`. Visibility
// is decided by `canSeeNavigation` in `lib/scope.js`.

// Navigation icons: MUI Material Design *Filled* set (no extra dependency).
import AccountBalance from "@mui/icons-material/AccountBalance";
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import Apartment from "@mui/icons-material/Apartment";
import Article from "@mui/icons-material/Article";
import Assignment from "@mui/icons-material/Assignment";
import AssignmentTurnedIn from "@mui/icons-material/AssignmentTurnedIn";
import BarChart from "@mui/icons-material/BarChart";
import BusinessCenter from "@mui/icons-material/BusinessCenter";
import Celebration from "@mui/icons-material/Celebration";
import Comment from "@mui/icons-material/Comment";
import CreditCard from "@mui/icons-material/CreditCard";
import Dashboard from "@mui/icons-material/Dashboard";
import Description from "@mui/icons-material/Description";
import DirectionsBus from "@mui/icons-material/DirectionsBus";
import EmojiEvents from "@mui/icons-material/EmojiEvents";
import Engineering from "@mui/icons-material/Engineering";
import Event from "@mui/icons-material/Event";
import EventAvailable from "@mui/icons-material/EventAvailable";
import FactCheck from "@mui/icons-material/FactCheck";
import Groups from "@mui/icons-material/Groups";
import InsertChart from "@mui/icons-material/InsertChart";
import Inventory2 from "@mui/icons-material/Inventory2";
import KingBed from "@mui/icons-material/KingBed";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import MenuBook from "@mui/icons-material/MenuBook";
import Money from "@mui/icons-material/Money";
import Notifications from "@mui/icons-material/Notifications";
import PersonAdd from "@mui/icons-material/PersonAdd";
import School from "@mui/icons-material/School";
import Send from "@mui/icons-material/Send";
import SwapHoriz from "@mui/icons-material/SwapHoriz";
import Sync from "@mui/icons-material/Sync";
import Tune from "@mui/icons-material/Tune";
import Warning from "@mui/icons-material/Warning";
export const groups = [
  {
    label: "Platform",
    items: [
      {
        to: "/platform",
        icon: Dashboard,
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
        icon: PersonAdd,
        label: "School Onboarding",
        scope: "platform",
      },
      {
        to: "/platform/schools",
        icon: Apartment,
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
        icon: Engineering,
        label: "Users & Access",
        scope: "platform",
      },
      {
        to: "/platform/audit",
        icon: Article,
        label: "Audit Logs",
        scope: "platform",
      },
    ],
  },
  {
    label: "Billing & Monetization",
    items: [
      { to: "/platform/plans", icon: Money, label: "Plans & Pricing", scope: "platform" },
      { to: "/platform/subscriptions", icon: CreditCard, label: "Subscriptions", scope: "platform" },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        to: "/platform/reports",
        icon: BarChart,
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
        icon: ManageAccounts,
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
        icon: Dashboard,
        label: "Admin Dashboard",
        end: true,
        roles: ["super_admin", "school_admin"],
      },
      {
        to: "/staff-dashboard",
        icon: Dashboard,
        label: "My Dashboard",
        end: true,
        roles: ["staff"],
      },
      {
        to: "/admission-counsellor",
        icon: Assignment,
        label: "Counsellor Workspace",
        end: true,
        roles: ["staff"],
        designation: "admission_counsellor",
      },
      {
        to: "/teacher-dashboard",
        icon: ManageAccounts,
        label: "Class Teacher",
        roles: ["teacher"],
      },
      {
        to: "/student-dashboard",
        icon: School,
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
        icon: EventAvailable,
        label: "My Attendance",
        roles: ["staff", "teacher"],
      },
      {
        to: "/notifications",
        icon: Notifications,
        label: "Notifications",
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
        icon: Dashboard,
        label: "Dashboard",
        end: true,
        roles: ["teacher"],
      },
      {
        to: "/teacher/my-class",
        icon: Groups,
        label: "My Class",
        roles: ["teacher"],
      },
      {
        to: "/teacher/attendance",
        icon: EventAvailable,
        label: "Student Attendance",
        roles: ["teacher"],
      },
      {
        to: "/teacher/timetable",
        icon: Event,
        label: "Timetable",
        roles: ["teacher"],
      },
      {
        to: "/teacher/homework",
        icon: FactCheck,
        label: "Homework & Assignments",
        roles: ["teacher"],
      },
      {
        to: "/teacher/exams",
        icon: Assignment,
        label: "Examinations",
        roles: ["teacher"],
      },
      {
        to: "/teacher/performance",
        icon: BarChart,
        label: "Class Performance",
        roles: ["teacher"],
      },
      {
        to: "/notice-board",
        icon: Notifications,
        label: "Notices",
        perm: "notices:publish",
        roles: ["teacher"],
      },
    ],
  },
  {
    label: "Students",
    teacherOnly: true,
    items: [
      {
        to: "/behavior",
        icon: Warning,
        label: "Behavior Log",
        roles: ["teacher"],
      },
      {
        to: "/achievements",
        icon: EmojiEvents,
        label: "Achievements",
        roles: ["teacher"],
      },
    ],
  },
  {
    label: "My Account",
    teacherOnly: true,
    items: [
      {
        to: "/staff/my-attendance",
        icon: AssignmentTurnedIn,
        label: "My Attendance",
        roles: ["teacher"],
      },
      {
        to: "/leave",
        icon: Description,
        label: "Leave Request",
        roles: ["teacher"],
      },
      {
        to: "/payroll",
        icon: Money,
        label: "Payroll",
        roles: ["teacher"],
      },
    ],
  },
  {
    label: "Admissions & Outreach",
    items: [
      {
        to: "/admission-enquiry",
        icon: PersonAdd,
        label: "Admission Enquiry",
        perm: "admissions:read",
      },
      {
        to: "/notice-board",
        icon: Notifications,
        label: "Notice Board",
        perm: "notices:read",
      },
      {
        to: "/diary",
        icon: MenuBook,
        label: "Class Diary",
        perm: "notices:read",
        roles: ["school_admin", "super_admin", "teacher", "parent"],
      },
      {
        to: "/messages",
        icon: Comment,
        label: "Message Teacher",
        perm: "notices:read",
        roles: ["school_admin", "super_admin", "teacher", "parent"],
      },
      {
        to: "/broadcast",
        icon: Send,
        label: "Broadcast",
        perm: "notices:publish",
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/events",
        icon: Celebration,
        label: "Events",
        perm: "events:read",
      },
    ],
  },
  {
    label: "Academics",
    items: [
      {
        to: "/addstudent",
        icon: PersonAdd,
        label: "Onboard Student",
        perm: "students:write",
      },
      {
        to: "/students",
        icon: Groups,
        label: "Student Database",
        perm: "students:read",
      },
      {
        to: "/attendance",
        icon: EventAvailable,
        label: "Attendance",
        perm: "attendance:read",
      },
      {
        to: "/timetable",
        icon: Event,
        label: "Timetable",
        perm: "timetable:read",
      },
      {
        to: "/examination",
        icon: Assignment,
        label: "Examination",
        perm: "exams:read",
      },
      {
        to: "/marks-entry",
        icon: AssignmentTurnedIn,
        label: "Marks Entry",
        perm: "marks:write",
      },
      {
        to: "/report-card",
        icon: Article,
        label: "Report Card",
        perm: "marks:read",
      },
      {
        to: "/grading-scales",
        icon: BarChart,
        label: "Grading Scales",
        perm: "exams:read",
      },
      {
        to: "/syllabus",
        icon: Article,
        label: "Syllabus",
        perm: "homework:read",
      },
      {
        to: "/study-materials",
        icon: Description,
        label: "Study Materials",
        perm: "homework:read",
      },
      {
        to: "/promotions",
        icon: School,
        label: "Promotions",
        perm: "promotion:read",
      },
      {
        to: "/transfers",
        icon: SwapHoriz,
        label: "Transfers",
        perm: "transfer:read",
      },
      {
        to: "/academic-sessions",
        icon: Event,
        label: "Academic Sessions",
        perm: "sessions:read",
      },
      {
        to: "/rollover",
        icon: Sync,
        label: "Academic Rollover",
        perm: "rollover:read",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        to: "/inventory",
        icon: Inventory2,
        label: "Inventory Management",
        perm: "inventory:read",
      },
      {
        to: "/bus-tracking",
        icon: DirectionsBus,
        label: "Bus Tracking",
        perm: "transport:read",
      },
      {
        to: "/hostel",
        icon: KingBed,
        label: "Hostel Management",
        perm: "hostel:read",
      },
      {
        to: "/library",
        icon: MenuBook,
        label: "Library Management",
        perm: "library:read",
      },
    ],
  },
  {
    label: "Human Resources",
    items: [
      {
        to: "/teachers",
        icon: School,
        label: "Teachers",
        perm: "staff:write",
      },
      {
        to: "/homework",
        icon: BusinessCenter,
        label: "Assign Work",
        perm: "homework:read",
      },
      {
        to: "/leave",
        icon: InsertChart,
        label: "Leave Management",
        perm: "leaves:apply",
      },
      {
        to: "/payroll",
        icon: Money,
        label: "Payroll / Salary",
        perm: "payroll:view",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        to: "/fees-collection",
        icon: AccountBalanceWallet,
        label: "Fees Collection",
        perm: "fees:collect",
      },
      {
        to: "/online-payment",
        icon: CreditCard,
        label: "Online Fees Payment",
        perm: "fees:read",
      },
      {
        to: "/payment-gateway",
        icon: Tune,
        label: "Payment Gateway",
        perm: "payments:settings",
      },
      {
        to: "/accounting",
        icon: Article,
        label: "Accounting",
        perm: "accounting:read",
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        to: "/reports",
        icon: BarChart,
        label: "Reports",
        perm: "reports:view",
      },
      {
        to: "/behavior",
        icon: Warning,
        label: "Behavior Log",
        perm: "conduct:read",
      },
      {
        to: "/achievements",
        icon: EmojiEvents,
        label: "Achievements",
        perm: "achievements:read",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        to: "/users",
        icon: Engineering,
        label: "Users & Access",
        perm: "users:manage",
      },
      {
        to: "/manage-school",
        icon: AccountBalance,
        label: "Manage School",
        perm: "users:manage",
      },
      {
        to: "/subscription",
        icon: CreditCard,
        label: "Subscription & Upgrade",
        perm: "school:settings",
      },
    ],
  },
];

export const STUDENT_NAV = [
  {
    label: "My Academics",
    items: [
      {
        to: "/student-dashboard",
        icon: Dashboard,
        label: "Dashboard",
        end: true,
        roles: ["student"],
      },
      {
        to: "/student/attendance",
        icon: EventAvailable,
        label: "My Attendance",
        roles: ["student"],
      },
      {
        to: "/student/timetable",
        icon: Event,
        label: "My Timetable",
        roles: ["student"],
      },
      {
        to: "/student/achievements",
        icon: EmojiEvents,
        label: "My Achievements",
        roles: ["student"],
      },
      {
        to: "/student/behavior",
        icon: Warning,
        label: "My Behavior Log",
        roles: ["student"],
      },
    ],
  },
  {
    label: "Learning",
    items: [
      {
        to: "/student/homework",
        icon: FactCheck,
        label: "Homework & Assignments",
        roles: ["student"],
      },
      {
        to: "/student/exams",
        icon: Assignment,
        label: "Examinations",
        roles: ["student"],
      },
      {
        to: "/student/results",
        icon: BarChart,
        label: "Results & Report Card",
        roles: ["student"],
      },
      {
        to: "/student/study-materials",
        icon: MenuBook,
        label: "Study Materials",
        roles: ["student"],
      },
      {
        to: "/student/syllabus",
        icon: Article,
        label: "Syllabus",
        roles: ["student"],
      },
    ],
  },
  {
    label: "School Services",
    items: [
      {
        to: "/student/fees",
        icon: AccountBalanceWallet,
        label: "Fees & Payments",
        roles: ["student"],
      },
      {
        to: "/student/leave",
        icon: Description,
        label: "Leave Request",
        roles: ["student"],
      },
      {
        to: "/student/notifications",
        icon: Notifications,
        label: "Notifications",
        roles: ["student"],
      },
      {
        to: "/student/notices",
        icon: Notifications,
        label: "Notices",
        roles: ["student"],
      },
      {
        to: "/diary",
        icon: MenuBook,
        label: "Class Diary",
        roles: ["student"],
      },
      {
        to: "/student/library",
        icon: MenuBook,
        label: "My Library",
        roles: ["student"],
      },
      {
        to: "/student/transport",
        icon: DirectionsBus,
        label: "My Transport",
        roles: ["student"],
      },
      {
        to: "/student/documents",
        icon: Description,
        label: "My Documents",
        roles: ["student"],
      },
      {
        to: "/student/hostel",
        icon: KingBed,
        label: "My Hostel",
        roles: ["student"],
      },
      {
        to: "/student/events",
        icon: Celebration,
        label: "Events",
        roles: ["student"],
      },
    ],
  },
];

export const PARENT_NAV = [
  {
    label: "My Children",
    items: [
      {
        to: "/parent-dashboard",
        icon: Dashboard,
        label: "Dashboard",
        end: true,
        roles: ["parent"],
      },
      {
        to: "/diary",
        icon: MenuBook,
        label: "Class Diary",
        roles: ["parent"],
      },
      {
        to: "/messages",
        icon: Event,
        label: "Message Teacher",
        roles: ["parent"],
      },
      {
        to: "/notifications",
        icon: Notifications,
        label: "Notifications",
        roles: ["parent"],
      },
    ],
  },
  {
    label: "School Services",
    items: [
      {
        to: "/notice-board",
        icon: Assignment,
        label: "Notices",
        roles: ["parent"],
      },
      {
        to: "/events",
        icon: Celebration,
        label: "Events",
        roles: ["parent"],
      },
      {
        to: "/online-payment",
        icon: AccountBalanceWallet,
        label: "Fees & Payments",
        roles: ["parent"],
      },
    ],
  },
];
