// Mock routing configuration for the MUI Sidebar.
//
// This is intentionally decoupled from the live app: it is the "spec" the
// sidebar renders against, so the component can be dropped in and pointed at
// real data later. Each leaf knows the permission (or persona) required to
// see it, so a real integration only has to supply a `canSee(item)` predicate
// instead of reworking the tree.
//
// Icons come from @mui/icons-material because MUI's icon set renders
// crisply at the small sizes used in a rail without extra tuning.

import DashboardIcon from "@mui/icons-material/Dashboard";
import SchoolIcon from "@mui/icons-material/School";
import ClassIcon from "@mui/icons-material/Class";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import BadgeIcon from "@mui/icons-material/Badge";
import PaymentsIcon from "@mui/icons-material/Payments";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBus";
import HotelIcon from "@mui/icons-material/Hotel";
import InventoryIcon from "@mui/icons-material/Inventory";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CampaignIcon from "@mui/icons-material/Campaign";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";

export const SIDEBAR_WIDTH_EXPANDED = 292;
export const SIDEBAR_WIDTH_COLLAPSED = 76;

/**
 * A leaf is `{ to, label, icon, badge?, permission?, persona?, end? }`.
 * A group is `{ header, icon, items: [...] }` and may nest another group
 * one level deep for real sub-menus.
 */
export const MOCK_NAV = [
  {
    id: "main",
    items: [
      {
        to: "/admin-dashboard",
        label: "Dashboard",
        icon: DashboardIcon,
        end: true,
        persona: ["super_admin", "school_admin", "staff"],
      },
    ],
  },
  {
    id: "academics",
    header: "Academics",
    icon: SchoolIcon,
    items: [
      {
        to: "/classes",
        label: "Classes",
        icon: ClassIcon,
        permission: "students:read",
        children: [
          { to: "/classes?view=list", label: "Class List", permission: "students:read" },
          { to: "/promotions", label: "Promotions", permission: "promotion:read" },
          { to: "/transfers", label: "Transfers", permission: "transfer:read" },
          { to: "/rollover", label: "Rollover", permission: "rollover:read" },
        ],
      },
      {
        to: "/timetable",
        label: "Timetable",
        icon: CalendarMonthIcon,
        permission: "timetable:read",
        badge: 1,
      },
      {
        to: "/syllabus",
        label: "Subjects & Syllabus",
        icon: MenuBookIcon,
        permission: "timetable:read",
      },
      {
        to: "/examination",
        label: "Exams",
        icon: FactCheckIcon,
        permission: "exams:read",
        children: [
          { to: "/examination", label: "Exam Schedule", permission: "exams:read" },
          { to: "/marks-entry", label: "Marks Entry", permission: "marks:write" },
          { to: "/report-card", label: "Report Cards", permission: "marks:read" },
          { to: "/grading-scales", label: "Grading Scales", permission: "marks:read" },
        ],
      },
      { to: "/academic-sessions", label: "Sessions", icon: FactCheckIcon, permission: "sessions:read" },
    ],
  },
  {
    id: "students",
    header: "Students",
    icon: GroupsIcon,
    items: [
      { to: "/students", label: "Directory", icon: GroupsIcon, permission: "students:read" },
      {
        to: "/addstudent",
        label: "Admissions",
        icon: PersonAddAltIcon,
        permission: "students:write",
        badge: { count: 6, tone: "primary" },
        children: [
          { to: "/addstudent", label: "New Admission", permission: "students:write" },
          { to: "/admission-enquiry", label: "Enquiries", permission: "admissions:read", badge: { count: 12, tone: "warning" } },
          { to: "/admission-counsellor", label: "Counsellor Desk", permission: "admissions:read" },
        ],
      },
      {
        to: "/attendance",
        label: "Attendance",
        icon: HowToRegIcon,
        permission: "attendance:read",
        children: [
          { to: "/attendance", label: "Mark Attendance", permission: "attendance:mark" },
          { to: "/staff/my-attendance", label: "My Attendance", permission: "attendance:read" },
        ],
      },
      { to: "/report-card", label: "Results", icon: FactCheckIcon, permission: "marks:read" },
      { to: "/behavior", label: "Behaviour", icon: BadgeIcon, permission: "conduct:read" },
      { to: "/achievements", label: "Achievements", icon: BadgeIcon, permission: "achievements:read" },
    ],
  },
  {
    id: "staff",
    header: "Staff & HR",
    icon: BadgeIcon,
    items: [
      { to: "/teachers", label: "Staff Directory", icon: GroupsIcon, permission: "staff:read" },
      { to: "/payroll", label: "Payroll", icon: PaymentsIcon, permission: "payroll:view" },
      {
        to: "/leave",
        label: "Leave",
        icon: EventAvailableIcon,
        permission: "leaves:apply",
        badge: { count: 4, tone: "warning" },
      },
      { to: "/profile", label: "My Profile", icon: BadgeIcon, permission: "profile:read" },
    ],
  },
  {
    id: "fees",
    header: "Fees & Finance",
    icon: AccountBalanceWalletIcon,
    items: [
      {
        to: "/fees-collection",
        label: "Invoices",
        icon: ReceiptLongIcon,
        permission: "fees:read",
        children: [
          { to: "/fees-collection", label: "Fee Collection", permission: "fees:collect" },
          { to: "/online-payment", label: "Online Payments", permission: "fees:read" },
          { to: "/payment-gateway", label: "Payment Gateway", permission: "payments:settings" },
        ],
      },
      { to: "/accountant/fees", label: "Collect Fee", icon: PaymentsIcon, permission: "fees:collect" },
      { to: "/accounting", label: "Expenses", icon: TrendingDownIcon, permission: "accounting:read" },
      { to: "/reports", label: "Finance Reports", icon: FactCheckIcon, permission: "fees:reports" },
    ],
  },
  {
    id: "facility",
    header: "Library & Facility",
    icon: LocalLibraryIcon,
    items: [
      {
        to: "/librarian/books",
        label: "Books",
        icon: LocalLibraryIcon,
        permission: "library:read",
        children: [
          { to: "/librarian/books", label: "Catalogue", permission: "library:read" },
          { to: "/librarian/circulation", label: "Circulation", permission: "library:manage", badge: 3 },
          { to: "/library", label: "Library Home", permission: "library:read" },
        ],
      },
      {
        to: "/transport/routes",
        label: "Transport",
        icon: DirectionsBusIcon,
        permission: "transport:read",
        children: [
          { to: "/transport/routes", label: "Bus Routes", permission: "transport:read" },
          { to: "/transport/allocations", label: "Allocations", permission: "transport:update" },
          { to: "/bus-tracking", label: "Live Tracking", permission: "transport:read" },
        ],
      },
      { to: "/hostel", label: "Hostels", icon: HotelIcon, permission: "hostel:read" },
      { to: "/inventory", label: "Inventory", icon: InventoryIcon, permission: "inventory:read" },
    ],
  },
  {
    id: "admin",
    header: "Settings & Administration",
    icon: AdminPanelSettingsIcon,
    items: [
      { to: "/settings", label: "School Settings", icon: SettingsIcon, permission: "school:settings" },
      { to: "/users", label: "User Management", icon: TuneIcon, permission: "users:manage" },
      { to: "/broadcast", label: "Broadcast", icon: CampaignIcon, permission: "notices:publish" },
      { to: "/support", label: "Support", icon: SupportAgentIcon, persona: ["super_admin", "school_admin"] },
    ],
  },
];

export default MOCK_NAV;
