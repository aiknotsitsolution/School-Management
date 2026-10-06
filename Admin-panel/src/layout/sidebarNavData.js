// Navigation data for the school ERP shell.
//
// Kept separate from `SidebarMui.jsx` so this module stays free of React
// component code: `Layout.jsx` picks the tree and hands it to the sidebar,
// with `canSee` deciding which leaves render.
//
// A group is `{ label, items, teacherOnly? }`; a leaf is
// `{ to, label, icon, end?, perm?, roles?, scope?, designation? }`. Visibility
// is decided by `canSeeNavigation` in `lib/scope.js`.

// Navigation icons: MUI Material Design *Filled* set (no extra dependency).
// Vectors only — they stay crisp at the 84px rail size and inherit `currentColor`,
// so the active/hover recolouring in SidebarMui works without a per-icon override.
import AccountBalance from "@mui/icons-material/AccountBalance";
import Analytics from "@mui/icons-material/Analytics";
import Apartment from "@mui/icons-material/Apartment";
import Article from "@mui/icons-material/Article";
import Assignment from "@mui/icons-material/Assignment";
import AssignmentTurnedIn from "@mui/icons-material/AssignmentTurnedIn";
import AutoStories from "@mui/icons-material/AutoStories";
import Campaign from "@mui/icons-material/Campaign";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import Comment from "@mui/icons-material/Comment";
import CreditCard from "@mui/icons-material/CreditCard";
import Description from "@mui/icons-material/Description";
import DirectionsBus from "@mui/icons-material/DirectionsBus";
import EmojiEvents from "@mui/icons-material/EmojiEvents";
import Engineering from "@mui/icons-material/Engineering";
import Event from "@mui/icons-material/Event";
import FactCheck from "@mui/icons-material/FactCheck";
import Groups from "@mui/icons-material/Groups";
import InsertChart from "@mui/icons-material/InsertChart";
import Inventory2 from "@mui/icons-material/Inventory2";
import KingBed from "@mui/icons-material/KingBed";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import Money from "@mui/icons-material/Money";
import Payment from "@mui/icons-material/Payment";
import PersonAdd from "@mui/icons-material/PersonAdd";
import Quiz from "@mui/icons-material/Quiz";
import Send from "@mui/icons-material/Send";
import SpaceDashboard from "@mui/icons-material/SpaceDashboard";
import SwapHoriz from "@mui/icons-material/SwapHoriz";
import Sync from "@mui/icons-material/Sync";
import Tune from "@mui/icons-material/Tune";
import WorkspacePremium from "@mui/icons-material/WorkspacePremium";
export const groups = [
  {
    label: "Platform",
    items: [
      {
        to: "/platform",
        icon: SpaceDashboard,
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
        icon: Analytics,
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
        to: "/dashboard",
        icon: SpaceDashboard,
        label: "Admin Dashboard",
        end: true,
        // /dashboard is guarded to school_admin (App.jsx RequireRole). A
        // super_admin lands on /platform instead, so listing it here produced a
        // dead link that bounced the user to /platform. Super admins also sit in
        // PLATFORM_SCOPE, which hides school modules until a school is selected.
        //
        // super_admin stays in the list on purpose: `selectRole` reports the
        // signed-in role even while impersonating a school (selectors.js:7), and
        // `canReachSchoolScope` lets an impersonating platform owner through the
        // school check. Dropping super_admin here would empty the admin
        // navigation for an impersonation session, which is the opposite of what
        // support needs. Every allow-list below follows the same rule.
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/staff-dashboard",
        icon: SpaceDashboard,
        label: "My Dashboard",
        end: true,
        roles: ["staff"],
      },
      {
        // Moved out of "My Teaching" so EVERY school role opens its sidebar on
        // a dashboard: this group is first in the array and every group above it
        // is platform-scoped (hidden for school roles), so whatever survives
        // here lands at position 1. Keeping it under My Teaching left teachers
        // scrolling past Staff Tools to reach their own dashboard.
        to: "/teacher-dashboard",
        icon: SpaceDashboard,
        label: "Dashboard",
        end: true,
        roles: ["teacher"],
      },
      // /admission-counsellor and /student-dashboard were removed from this
      // tree. Both were unreachable: Layout.jsx:74-79 hands counsellors
      // PERSONA_NAV and students STUDENT_NAV before `groups` is ever consulted,
      // so these entries could only render for a role that never sees this file.
      // Both routes still exist in App.jsx and are linked from their dashboards.
    ],
  },
  {
    label: "Staff Tools",
    items: [
      {
        to: "/my-work",
        icon: AssignmentTurnedIn,
        label: "My Work",
        // No `perm`: the route is ownership-scoped on the server, and
        // non-teaching staff hold no homework:read (it gates the school-wide
        // Assign Work list, which is why that entry stays admin-only).
        roles: ["staff", "teacher"],
      },
      {
        to: "/staff/my-attendance",
        icon: FactCheck,
        label: "My Attendance",
        roles: ["staff", "teacher"],
      },
      {
        to: "/notifications",
        icon: Campaign,
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
        to: "/teacher/my-class",
        icon: Groups,
        label: "My Class",
        roles: ["teacher"],
      },
      {
        to: "/teacher/attendance",
        icon: FactCheck,
        label: "Student Attendance",
        roles: ["teacher"],
      },
      {
        to: "/teacher/timetable",
        icon: CalendarMonth,
        label: "Timetable",
        roles: ["teacher"],
      },
      {
        to: "/teacher/homework",
        icon: Assignment,
        label: "Homework & Assignments",
        roles: ["teacher"],
      },
      {
        to: "/teacher/exams",
        icon: Quiz,
        label: "Examinations",
        roles: ["teacher"],
      },
      {
        to: "/teacher/performance",
        icon: Analytics,
        label: "Class Performance",
        roles: ["teacher"],
      },
      {
        to: "/teacher/notices",
        icon: Campaign,
        label: "Notices",
        // Teacher-scoped page (App.jsx:480, RequireRole teacher) rather than the
        // school-wide /notice-board. TeacherDashboard already links here
        // ("View all"), so this is the notice surface teachers actually use;
        // the generic duplicate is restricted to admin roles below.
        roles: ["teacher"],
      },
    ],
  },
  {
    label: "Students",
    teacherOnly: true,
    items: [
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
      // /staff/my-attendance is intentionally NOT repeated here: "Staff Tools"
      // above already lists it for staff and teacher alike, so a second copy
      // under a different group gave teachers the same route twice.
      // /leave is likewise not repeated: the Human Resources entry is gated on
      // leaves:apply, which teachers already hold, and it serves both
      // self-service apply and admin approval.
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
        icon: Campaign,
        label: "Notice Board",
        perm: "notices:read",
        // Teachers are excluded: they get the teacher-scoped /teacher/notices
        // under "My Teaching". Listing both showed the same notice surface twice.
        // staff stays for the custom-designation fallback, where school notices
        // are a legitimate read-only responsibility; the five known personas have
        // their own entry in PERSONA_NAV.
        roles: ["school_admin", "super_admin", "staff"],
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
        icon: CalendarMonth,
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
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/attendance",
        icon: FactCheck,
        label: "Attendance",
        perm: "attendance:read",
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/timetable",
        icon: CalendarMonth,
        label: "Timetable",
        perm: "timetable:read",
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/examination",
        icon: Quiz,
        label: "Examination",
        perm: "exams:read",
        roles: ["school_admin", "super_admin"],
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
        icon: Analytics,
        label: "Grading Scales",
        perm: "exams:read",
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/syllabus",
        icon: Description,
        label: "Syllabus",
        perm: "homework:read",
      },
      {
        to: "/promotions",
        icon: WorkspacePremium,
        label: "Promotions",
        perm: "promotion:read",
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/transfers",
        icon: SwapHoriz,
        label: "Transfers",
        perm: "transfer:read",
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/academic-sessions",
        icon: CalendarMonth,
        label: "Academic Sessions",
        perm: "sessions:read",
      },
      {
        to: "/rollover",
        icon: Sync,
        label: "Academic Rollover",
        perm: "rollover:read",
        roles: ["school_admin", "super_admin"],
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
        icon: AutoStories,
        // Teachers keep this as a browse-only catalogue (they hold library:read
        // but not library:manage, and the page hides write actions accordingly).
        // Generic staff no longer see it: an unknown designation proves no
        // library responsibility.
        label: "Library",
        perm: "library:read",
        roles: ["school_admin", "super_admin", "teacher"],
      },
    ],
  },
  {
    label: "Human Resources",
    items: [
      {
        to: "/teachers",
        icon: PersonAdd,
        label: "Add Staff",
        perm: "staff:write",
      },
      {
        to: "/homework",
        icon: Assignment,
        label: "Assign Work",
        perm: "homework:read",
        roles: ["school_admin", "super_admin"],
      },
      {
        to: "/leave",
        icon: InsertChart,
        // Neutral label: the route is gated on leaves:apply and serves BOTH
        // self-service apply (teacher/staff) and approval (school_admin).
        // "Leave Management" overstated what leaves:apply grants.
        label: "Leave",
        perm: "leaves:apply",
      },
      {
        to: "/payroll",
        icon: Money,
        label: "Payroll / Salary",
        perm: "payroll:view",
        // Teachers reach their own payslip through the teacher-only "My Account"
        // entry above, so listing it here too showed them the same route twice.
        // payrollController.js scopes staff/teacher reads to req.user.refId, so
        // this is the admin-facing surface.
        roles: ["school_admin", "super_admin"],
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        to: "/fees-collection",
        icon: Payment,
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
        icon: Analytics,
        label: "Reports",
        perm: "reports:view",
      },
      {
        to: "/achievements",
        icon: EmojiEvents,
        label: "Achievements",
        perm: "achievements:read",
        // Teachers get the teacher-only "Students" entry above; this copy is the
        // admin-facing view of the whole school.
        roles: ["school_admin", "super_admin"],
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
        to: "/branches",
        icon: Apartment,
        label: "Branches",
        perm: "branches:read",
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
        icon: SpaceDashboard,
        label: "Dashboard",
        end: true,
        roles: ["student"],
      },
      {
        to: "/student/attendance",
        icon: FactCheck,
        label: "My Attendance",
        roles: ["student"],
      },
      {
        to: "/student/timetable",
        icon: CalendarMonth,
        label: "My Timetable",
        roles: ["student"],
      },
      {
        to: "/student/achievements",
        icon: EmojiEvents,
        label: "My Achievements",
        roles: ["student"],
      },
    ],
  },
  {
    label: "Learning",
    items: [
      {
        to: "/student/homework",
        icon: Assignment,
        label: "Homework & Assignments",
        roles: ["student"],
      },
      {
        to: "/student/exams",
        icon: Quiz,
        label: "Examinations",
        roles: ["student"],
      },
      {
        to: "/student/results",
        icon: Analytics,
        label: "Results & Report Card",
        roles: ["student"],
      },
      {
        to: "/student/syllabus",
        icon: Description,
        label: "Syllabus",
        roles: ["student"],
      },
      {
        // My Library holds the Study Materials shelf as a tab, so the separate
        // "Study Materials" leaf is gone — one Library, two tabs.
        to: "/student/library",
        icon: AutoStories,
        label: "My Library",
        roles: ["student"],
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        to: "/messages",
        icon: Comment,
        label: "Messages",
        roles: ["student"],
      },
    ],
  },
  {
    label: "School Services",
    items: [
      {
        to: "/student/fees",
        icon: Payment,
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
        icon: Campaign,
        label: "Notifications",
        roles: ["student"],
      },
      {
        to: "/student/notices",
        icon: Campaign,
        label: "Notices",
        roles: ["student"],
      },
      {
        to: "/student/transport",
        icon: DirectionsBus,
        label: "My School Bus",
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
        icon: CalendarMonth,
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
        icon: SpaceDashboard,
        label: "Dashboard",
        end: true,
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
        icon: Campaign,
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
        icon: Campaign,
        label: "Notices",
        roles: ["parent"],
      },
      {
        to: "/events",
        icon: CalendarMonth,
        label: "Events",
        roles: ["parent"],
      },
      {
        to: "/online-payment",
        icon: Payment,
        label: "Fees & Payments",
        roles: ["parent"],
      },
    ],
  },
];