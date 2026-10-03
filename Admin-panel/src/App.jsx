import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Ban } from "lucide-react";
import Layout from "./layout/Layout";
import { loadActiveGradingScale } from "./lib/grading";
import { logout } from "./store/authSlice";
import RouteFallback from "./components/RouteFallback";

// Every page is code-split: 105 statically imported pages meant a single
// 2.4 MB entry chunk that every visitor (including the login screen) had to
// parse. Roles now load only what they navigate to.
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Landing = lazy(() => import("./pages/Landing"));
const IconPicker = lazy(() => import("./pages/IconPicker"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Timetable = lazy(() => import("./pages/Timetable"));
const Homework = lazy(() => import("./pages/Homework"));
const Examination = lazy(() => import("./pages/Examination"));
const AcademicSessions = lazy(() => import("./pages/AcademicSessions"));
const GradingScales = lazy(() => import("./pages/GradingScales"));
const Branches = lazy(() => import("./pages/Branches"));
const StudyMaterials = lazy(() => import("./pages/StudyMaterials"));
const SyllabusManage = lazy(() => import("./pages/SyllabusManage"));
const ReportCard = lazy(() => import("./pages/ReportCard"));
const MarksEntry = lazy(() => import("./pages/MarksEntry"));
const Promotions = lazy(() => import("./pages/Promotions"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Rollover = lazy(() => import("./pages/Rollover"));
const Students = lazy(() => import("./pages/Students"));
const AdmissionEnquiry = lazy(() => import("./pages/AdmissionEnquiry"));
const NoticeBoard = lazy(() => import("./pages/NoticeBoard"));
const Events = lazy(() => import("./pages/Events"));
const FeesCollection = lazy(() => import("./pages/FeesCollection"));
const Accounting = lazy(() => import("./pages/Accounting"));
const OnlinePayment = lazy(() => import("./pages/OnlinePayment"));
const PaymentGateway = lazy(() => import("./pages/PaymentGateway"));
const Inventory = lazy(() => import("./pages/Inventory"));
const BusTracking = lazy(() => import("./pages/BusTracking"));
const Reports = lazy(() => import("./pages/Reports"));
const Library = lazy(() => import("./pages/Library"));
const Leave = lazy(() => import("./pages/Leave"));
const Hostel = lazy(() => import("./pages/Hostel"));
const Payroll = lazy(() => import("./pages/Payroll"));
const AddStudent = lazy(() => import("./pages/AddStudent"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherMyClass = lazy(() => import("./pages/teacher/MyClass"));
const TeacherAttendance = lazy(() => import("./pages/teacher/Attendance"));
const TeacherTimetable = lazy(() => import("./pages/teacher/Timetable"));
const TeacherHomework = lazy(() => import("./pages/teacher/Homework"));
const TeacherExams = lazy(() => import("./pages/teacher/Exams"));
const TeacherPerformance = lazy(() => import("./pages/teacher/Performance"));
const TeacherNotices = lazy(() => import("./pages/teacher/Notices"));
const TeacherProfile = lazy(() => import("./pages/teacher/Profile"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const Diary = lazy(() => import("./pages/Diary"));
const Messages = lazy(() => import("./pages/Messages"));
const Broadcast = lazy(() => import("./pages/Broadcast"));
const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
const StudentProfile = lazy(() => import("./pages/student/Profile"));
const StudentAttendance = lazy(() => import("./pages/student/Attendance"));
const StudentTimetable = lazy(() => import("./pages/student/Timetable"));
const StudentHomework = lazy(() => import("./pages/student/Homework"));
const StudentExams = lazy(() => import("./pages/student/Exams"));
const StudentResults = lazy(() => import("./pages/student/Results"));
const StudentFees = lazy(() => import("./pages/student/Fees"));
const StudentNotices = lazy(() => import("./pages/student/Notices"));
const StudentLibrary = lazy(() => import("./pages/student/Library"));
const StudentTransport = lazy(() => import("./pages/student/Transport"));
const StudentDocuments = lazy(() => import("./pages/student/Documents"));
const StudentHostel = lazy(() => import("./pages/student/Hostel"));
const StudentEvents = lazy(() => import("./pages/student/Events"));
const StudentAchievements = lazy(() => import("./pages/student/Achievements"));
const StudentLeave = lazy(() => import("./pages/student/Leave"));
const StudentNotifications = lazy(() => import("./pages/student/Notifications"));
const StudentStudyMaterials = lazy(() => import("./pages/student/StudyMaterials"));
const StudentSyllabus = lazy(() => import("./pages/student/Syllabus"));
const StaffDashboard = lazy(() => import("./pages/StaffDashboard"));
const MyAttendance = lazy(() => import("./pages/MyAttendance"));
const Notifications = lazy(() => import("./pages/Notifications"));
const MyProfile = lazy(() => import("./pages/staff/MyProfile"));
const AccountantDashboard = lazy(() => import("./pages/staff/AccountantDashboard"));
const Fees = lazy(() => import("./pages/staff/Fees"));
const LibrarianDashboard = lazy(() => import("./pages/staff/LibrarianDashboard"));
const Books = lazy(() => import("./pages/staff/Books"));
const Circulation = lazy(() => import("./pages/staff/Circulation"));
const TransportDashboard = lazy(() => import("./pages/staff/TransportDashboard"));
const BusRoutes = lazy(() => import("./pages/staff/BusRoutes"));
const Allocations = lazy(() => import("./pages/staff/Allocations"));
const ReceptionDashboard = lazy(() => import("./pages/staff/ReceptionDashboard"));
const Enquiries = lazy(() => import("./pages/staff/Enquiries"));
const StudentLookup = lazy(() => import("./pages/staff/StudentLookup"));
const ReceptionNotices = lazy(() => import("./pages/staff/ReceptionNotices"));
const PlatformDashboard = lazy(() => import("./pages/platform/PlatformDashboard"));
const SchoolOnboarding = lazy(() => import("./pages/platform/SchoolOnboarding"));
const SchoolsManagement = lazy(() => import("./pages/platform/SchoolsManagement"));
const SchoolDetail = lazy(() => import("./pages/platform/SchoolDetail"));
const PlatformUsers = lazy(() => import("./pages/platform/PlatformUsers"));
const AuditLogs = lazy(() => import("./pages/platform/AuditLogs"));
const PlatformReports = lazy(() => import("./pages/platform/PlatformReports"));
const PlatformSettings = lazy(() => import("./pages/platform/PlatformSettings"));
const Users = lazy(() => import("./pages/Users"));
const ManageSchool = lazy(() => import("./pages/ManageSchool"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Account = lazy(() => import("./pages/Account"));
const SchoolSettings = lazy(() => import("./pages/SchoolSettings"));
const Teachers = lazy(() => import("./pages/Teachers"));
const Plans = lazy(() => import("./pages/Plans"));
const Subscriptions = lazy(() => import("./pages/Subscriptions"));
const CounsellorWorkspace = lazy(() => import("./pages/CounsellorWorkspace"));
const StudentCompleteProfile = lazy(() => import("./pages/StudentCompleteProfile"));
const StaffCompleteProfile = lazy(() => import("./pages/StaffCompleteProfile"));
const Achievements = lazy(() => import("./pages/Achievements"));
import {
  selectIsAuthenticated,
  selectRole,
  selectUser,
  selectSchool,
} from "./store/selectors";
import { hasPermission, legacyRole } from "./lib/permissions";
import { resolvePersona } from "./lib/persona";
import SplashScreen from "./components/SplashScreen";
import NavProgress from "./components/NavProgress";

// Shown when a non-super_admin lands in a suspended school. Never redirects
// into /subscription (that route requires school:settings and would loop
// teachers/staff/students back here).
function SchoolSuspendedScreen() {
  const dispatch = useDispatch();
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-line p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-alert/10 flex items-center justify-center">
          <Ban size={22} className="text-alert" />
        </div>
        <h1 className="text-xl font-bold text-ink">School account suspended</h1>
        <p className="text-sm text-slate-text">
          This school account has been suspended. Please contact support or the
          school administrator to restore access.
        </p>
        <button
          type="button"
          onClick={() => dispatch(logout())}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-ink text-white text-sm font-semibold hover:opacity-90 transition-opacity dark:bg-slate-200 dark:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function ProtectedLayout() {
  const isAuth = useSelector(selectIsAuthenticated);
  const school = useSelector(selectSchool);
  const rawRole = useSelector(selectRole);
  const role = legacyRole(rawRole);
  // Load the school's active grading scale once per auth so grade previews
  // (marks entry, report fallbacks) use the configured bands, not defaults.
  useEffect(() => {
    if (isAuth) loadActiveGradingScale();
  }, [isAuth]);
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  // Block suspended schools from accessing the app (except super_admin).
  // school_admin may reach /subscription to upgrade; everyone else gets a
  // non-looping notice (the old blanket redirect looped via RequirePermission).
  if (
    school?.status === "suspended" &&
    role !== "super_admin"
  ) {
    if (role === "school_admin") {
      return <Navigate to="/subscription" replace />;
    }
    return <SchoolSuspendedScreen />;
  }
  return <Layout />;
}

function RequireRole({ roles, children, fallback = "/" }) {
  const role = useSelector(selectRole);
  if (!roles.includes(legacyRole(role))) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

function RequirePermission({ permission, children, fallback = "/" }) {
  const user = useSelector(selectUser);
  if (!hasPermission(user, permission)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

// Admission Counsellors are a Staff designation — the workspace is only
// reachable by a staff account explicitly marked as one.
function RequireCounsellor({ children, fallback = "/" }) {
  const user = useSelector(selectUser);
  const isCounsellor =
    user?.role === "staff" && user?.designation === "admission_counsellor";
  if (!isCounsellor) return <Navigate to={fallback} replace />;
  return children;
}

// Staff designations get persona-restricted workspaces (Accountant, Librarian,
// Transport Coordinator, Receptionist). Designation is UI-only: the backend
// still enforces role + permission + tenant scope on every API call.
function RequirePersona({ designation, children, fallback = "/" }) {
  const user = useSelector(selectUser);
  const isPersona = user?.role === "staff" && user?.designation === designation;
  if (!isPersona) return <Navigate to={fallback} replace />;
  return children;
}

// Admin-style school modules are not meant for students — they have their own
// portal under /student/*. Prevent direct-URL access entirely.
function RequireNotStudent({ children, fallback = "/student-dashboard" }) {
  const role = useSelector(selectRole);
  if (role === "student") {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

// Teacher attendance management lives under /teacher/attendance with
// class-scoped APIs. The admin /attendance page shows school-wide data that
// should not be accessible to teachers via direct URL navigation.
function RequireNotTeacher({ children, fallback = "/teacher-dashboard" }) {
  const role = useSelector(selectRole);
  if (role === "teacher") {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

// The fleet map is an operator surface: it lists every route in the school,
// including driver contacts and assigned rosters. Parents hold transport:read
// for their own children only, via the /parent-dashboard bus panel.
function RequireStaff({ children, fallback = "/parent-dashboard" }) {
  const role = legacyRole(useSelector(selectRole));
  if (role !== "school_admin" && role !== "super_admin" && role !== "staff") {
    return <Navigate to={fallback} replace />;
  }
  return children;
}

function HomeRedirect() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  // Normalise the legacy "admin" token so it resolves to the school_admin
  // branch below instead of falling through to a route it cannot pass.
  const role = legacyRole(user?.role) || "school_admin";
  if (role === "super_admin") return <Navigate to="/platform" replace />;
  // Suspended school admins land on the subscription page
  if (role === "school_admin" && school?.status === "suspended") {
    return <Navigate to="/subscription" replace />;
  }
  if (role === "teacher") return <Navigate to="/teacher-dashboard" replace />;
  if (role === "student") return <Navigate to="/student-dashboard" replace />;
  if (role === "parent") return <Navigate to="/parent-dashboard" replace />;
  if (role === "staff") {
    const persona = resolvePersona(user);
    if (persona && persona.landing !== "/staff-dashboard") {
      return <Navigate to={persona.landing} replace />;
    }
    return <Navigate to="/staff-dashboard" replace />;
  }
  // school_admin lands on the guarded /dashboard route (inside ProtectedLayout)
  // so the app shell — sidebar, topbar, suspended-school gate — is applied.
  return <Navigate to="/dashboard" replace />;
}

// Public landing page gate: visitors on `/` see the marketing site; signed-in
// users are routed to their role home exactly as HomeRedirect used to do.
function LandingGate() {
  const isAuth = useSelector(selectIsAuthenticated);
  return isAuth ? <HomeRedirect /> : <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SplashScreen />
      {/* Outside <Routes> so it survives navigation and can report the wait
          that startTransition otherwise hides. */}
      <NavProgress />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingGate />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route element={<ProtectedLayout />}>
          {/* Dev tool for choosing sidebar icons. Remove this route and
              pages/IconPicker.jsx once the final picks are applied. */}
          <Route path="/dev/icon-picker" element={<IconPicker />} />
          <Route
            path="/platform"
            element={
              <RequireRole
                roles={["super_admin"]}
                fallback="/student-dashboard"
              >
                <PlatformDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/platform/onboarding"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <SchoolOnboarding />
              </RequireRole>
            }
          />
          <Route
            path="/platform/schools"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <SchoolsManagement />
              </RequireRole>
            }
          />
          <Route
            path="/platform/schools/:id"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <SchoolDetail />
              </RequireRole>
            }
          />
          <Route
            path="/platform/users"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <PlatformUsers />
              </RequireRole>
            }
          />
          <Route
            path="/platform/audit"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <AuditLogs />
              </RequireRole>
            }
          />
          <Route
            path="/platform/reports"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <PlatformReports />
              </RequireRole>
            }
          />
          <Route
            path="/platform/settings"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <PlatformSettings />
              </RequireRole>
            }
          />
          <Route
            path="/platform/plans"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <Plans />
              </RequireRole>
            }
          />
          <Route
            path="/platform/subscriptions"
            element={
              <RequireRole roles={["super_admin"]} fallback="/">
                <Subscriptions />
              </RequireRole>
            }
          />
          <Route
            path="/users"
            element={
              <RequirePermission permission="users:manage">
                <Users />
              </RequirePermission>
            }
          />
          <Route
            path="/manage-school"
            element={
              <RequirePermission permission="users:manage">
                <ManageSchool />
              </RequirePermission>
            }
          />
          <Route
            path="/subscription"
            element={
              <RequirePermission permission="school:settings">
                <Subscription />
              </RequirePermission>
            }
          />
          <Route path="/profile" element={<Account />} />
          <Route path="/settings" element={<SchoolSettings />} />
          <Route
            path="/teachers"
            element={
              <RequirePermission permission="staff:write">
                <Teachers />
              </RequirePermission>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireRole roles={["school_admin"]}>
                <Dashboard />
              </RequireRole>
            }
          />
          <Route
            path="/teacher-dashboard"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/my-class"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherMyClass />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/attendance"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherAttendance />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/timetable"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherTimetable />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/homework"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherHomework />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/exams"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherExams />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/performance"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherPerformance />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/notices"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherNotices />
              </RequireRole>
            }
          />
          <Route
            path="/teacher/profile"
            element={
              <RequireRole roles={["teacher"]}>
                <TeacherProfile />
              </RequireRole>
            }
          />
          <Route
            path="/student-dashboard"
            element={
              <RequireRole roles={["student"]}>
                <StudentDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/student/profile"
            element={
              <RequireRole roles={["student"]}>
                <StudentProfile />
              </RequireRole>
            }
          />
          <Route
            path="/student/attendance"
            element={
              <RequireRole roles={["student"]}>
                <StudentAttendance />
              </RequireRole>
            }
          />
          <Route
            path="/student/timetable"
            element={
              <RequireRole roles={["student"]}>
                <StudentTimetable />
              </RequireRole>
            }
          />
          <Route
            path="/student/homework"
            element={
              <RequireRole roles={["student"]}>
                <StudentHomework />
              </RequireRole>
            }
          />
          <Route
            path="/student/exams"
            element={
              <RequireRole roles={["student"]}>
                <StudentExams />
              </RequireRole>
            }
          />
          <Route
            path="/student/results"
            element={
              <RequireRole roles={["student"]}>
                <StudentResults />
              </RequireRole>
            }
          />
          <Route
            path="/student/fees"
            element={
              <RequireRole roles={["student"]}>
                <StudentFees />
              </RequireRole>
            }
          />
          <Route
            path="/student/notices"
            element={
              <RequireRole roles={["student"]}>
                <StudentNotices />
              </RequireRole>
            }
          />
          <Route
            path="/student/library"
            element={
              <RequireRole roles={["student"]}>
                <StudentLibrary />
              </RequireRole>
            }
          />
          <Route
            path="/student/transport"
            element={
              <RequireRole roles={["student"]}>
                <StudentTransport />
              </RequireRole>
            }
          />
          <Route
            path="/student/documents"
            element={
              <RequireRole roles={["student"]}>
                <StudentDocuments />
              </RequireRole>
            }
          />
          <Route
            path="/student/hostel"
            element={
              <RequireRole roles={["student"]}>
                <StudentHostel />
              </RequireRole>
            }
          />
          <Route
            path="/student/events"
            element={
              <RequireRole roles={["student"]}>
                <StudentEvents />
              </RequireRole>
            }
          />
          <Route
            path="/student/achievements"
            element={
              <RequireRole roles={["student"]}>
                <StudentAchievements />
              </RequireRole>
            }
          />
          <Route
            path="/student/leave"
            element={
              <RequireRole roles={["student"]}>
                <StudentLeave />
              </RequireRole>
            }
          />
          <Route
            path="/student/notifications"
            element={
              <RequireRole roles={["student"]}>
                <StudentNotifications />
              </RequireRole>
            }
          />
          <Route
            path="/student/study-materials"
            element={
              <RequireRole roles={["student"]}>
                <StudentStudyMaterials />
              </RequireRole>
            }
          />
          <Route
            path="/student/syllabus"
            element={
              <RequireRole roles={["student"]}>
                <StudentSyllabus />
              </RequireRole>
            }
          />
          <Route
            path="/staff-dashboard"
            element={
              <RequireRole roles={["staff"]}>
                <StaffDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/staff/my-attendance"
            element={
              <RequireRole roles={["staff", "teacher"]}>
                <MyAttendance />
              </RequireRole>
            }
          />
          <Route
            path="/staff/profile"
            element={
              <RequireRole roles={["staff"]}>
                <MyProfile />
              </RequireRole>
            }
          />
          <Route path="/notifications" element={<Notifications />} />
          <Route
            path="/accountant"
            element={
              <RequirePersona designation="accountant">
                <AccountantDashboard />
              </RequirePersona>
            }
          />
          <Route
            path="/accountant/fees"
            element={
              <RequirePersona designation="accountant">
                <Fees />
              </RequirePersona>
            }
          />
          <Route
            path="/librarian"
            element={
              <RequirePersona designation="librarian">
                <LibrarianDashboard />
              </RequirePersona>
            }
          />
          <Route
            path="/librarian/books"
            element={
              <RequirePersona designation="librarian">
                <Books />
              </RequirePersona>
            }
          />
          <Route
            path="/librarian/circulation"
            element={
              <RequirePersona designation="librarian">
                <Circulation />
              </RequirePersona>
            }
          />
          <Route
            path="/transport"
            element={
              <RequirePersona designation="transport">
                <TransportDashboard />
              </RequirePersona>
            }
          />
          <Route
            path="/transport/routes"
            element={
              <RequirePersona designation="transport">
                <BusRoutes />
              </RequirePersona>
            }
          />
          <Route
            path="/transport/allocations"
            element={
              <RequirePersona designation="transport">
                <Allocations />
              </RequirePersona>
            }
          />
          <Route
            path="/reception"
            element={
              <RequirePersona designation="receptionist">
                <ReceptionDashboard />
              </RequirePersona>
            }
          />
          <Route
            path="/reception/enquiries"
            element={
              <RequirePersona designation="receptionist">
                <Enquiries />
              </RequirePersona>
            }
          />
          <Route
            path="/reception/student-lookup"
            element={
              <RequirePersona designation="receptionist">
                <StudentLookup />
              </RequirePersona>
            }
          />
          <Route
            path="/reception/notices"
            element={
              <RequirePersona designation="receptionist">
                <ReceptionNotices />
              </RequirePersona>
            }
          />
          <Route
            path="/attendance"
            element={
              <RequirePermission permission="attendance:read">
                <RequireNotStudent>
                  <RequireNotTeacher>
                    <Attendance />
                  </RequireNotTeacher>
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/timetable"
            element={
              <RequirePermission permission="timetable:read">
                <RequireNotStudent>
                  <Timetable />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/homework"
            element={
              <RequirePermission permission="homework:read">
                <RequireNotStudent>
                  <Homework />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/examination"
            element={
              <RequirePermission permission="exams:read">
                <RequireNotStudent>
                  <Examination />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/marks-entry"
            element={
              <RequirePermission permission="marks:write">
                <RequireNotStudent>
                  <MarksEntry />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/promotions"
            element={
              <RequirePermission permission="promotion:read">
                <RequireNotStudent>
                  <Promotions />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/transfers"
            element={
              <RequirePermission permission="transfer:read">
                <RequireNotStudent>
                  <Transfers />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/rollover"
            element={
              <RequirePermission permission="rollover:read">
                <RequireNotStudent>
                  <Rollover />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/academic-sessions"
            element={
              <RequirePermission permission="sessions:read">
                <RequireNotStudent>
                  <AcademicSessions />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/report-card"
            element={
              <RequirePermission permission="marks:read">
                <RequireNotStudent>
                  <ReportCard />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
            <Route
              path="/grading-scales"
              element={
                <RequirePermission permission="exams:read">
                  <RequireNotStudent>
                    <GradingScales />
                  </RequireNotStudent>
                </RequirePermission>
              }
            />
            <Route
              path="/branches"
              element={
                <RequirePermission permission="branches:read">
                  <RequireNotStudent>
                    <Branches />
                  </RequireNotStudent>
                </RequirePermission>
              }
            />
          <Route
            path="/study-materials"
            element={
              <RequirePermission permission="homework:read">
                <RequireNotStudent>
                  <StudyMaterials />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/syllabus"
            element={
              <RequirePermission permission="homework:read">
                <RequireNotStudent>
                  <SyllabusManage />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/students"
            element={
              <RequirePermission permission="students:read">
                <RequireNotStudent>
                  <Students />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/admission-enquiry"
            element={
              <RequirePermission permission="admissions:read">
                <AdmissionEnquiry />
              </RequirePermission>
            }
          />
          
          <Route
            path="/notice-board"
            element={
              <RequirePermission permission="notices:read">
                <RequireNotStudent>
                  <NoticeBoard />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/parent-dashboard"
            element={
              <RequireRole roles={["parent"]}>
                <ParentDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/diary"
            element={
              <RequirePermission permission="notices:read">
                <Diary />
              </RequirePermission>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireRole
                roles={["student", "parent", "teacher", "staff", "school_admin", "super_admin"]}
              >
                <Messages />
              </RequireRole>
            }
          />
          <Route
            path="/broadcast"
            element={
              <RequirePermission permission="notices:publish">
                <Broadcast />
              </RequirePermission>
            }
          />
          <Route
            path="/events"
            element={
              <RequirePermission permission="events:read">
                <RequireNotStudent>
                  <Events />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/fees-collection"
            element={
              <RequirePermission permission="fees:collect">
                <FeesCollection />
              </RequirePermission>
            }
          />
          <Route
            path="/online-payment"
            element={
              <RequirePermission permission="fees:read">
                <RequireNotStudent>
                  <OnlinePayment />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/payment-gateway"
            element={
              <RequirePermission permission="payments:settings">
                <RequireNotStudent>
                  <PaymentGateway />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/inventory"
            element={
              <RequirePermission permission="inventory:read">
                <Inventory />
              </RequirePermission>
            }
          />
          <Route
            path="/accounting"
            element={
              <RequirePermission permission="accounting:read">
                <Accounting />
              </RequirePermission>
            }
          />
          <Route
            path="/bus-tracking"
            element={
              <RequirePermission permission="transport:read">
                <RequireStaff>
                  <BusTracking />
                </RequireStaff>
              </RequirePermission>
            }
          />
          <Route
            path="/reports"
            element={
              <RequirePermission permission="reports:view">
                <Reports />
              </RequirePermission>
            }
          />
          <Route
            path="/achievements"
            element={
              <RequirePermission permission="achievements:read">
                <RequireNotStudent>
                  <Achievements />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/library"
            element={
              <RequirePermission permission="library:read">
                <RequireNotStudent>
                  <Library />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/leave"
            element={
              <RequirePermission permission="leaves:apply">
                <RequireNotStudent>
                  <Leave />
                </RequireNotStudent>
              </RequirePermission>
            }
          />
          <Route
            path="/hostel"
            element={
              <RequirePermission permission="hostel:read">
                <Hostel />
              </RequirePermission>
            }
          />
          <Route
            path="/payroll"
            element={
              <RequirePermission permission="payroll:view">
                <Payroll />
              </RequirePermission>
            }
          />
          <Route
            path="/addstudent"
            element={
              <RequirePermission permission="students:write">
                <AddStudent />
              </RequirePermission>
            }
          />
          <Route
            path="/students/complete/:id"
            element={
              <RequirePermission permission="students:write">
                <StudentCompleteProfile />
              </RequirePermission>
            }
          />
          <Route
            path="/staff/complete/:id"
            element={
              <RequirePermission permission="staff:write">
                <StaffCompleteProfile />
              </RequirePermission>
            }
          />
          <Route
            path="/admission-counsellor"
            element={
              <RequireCounsellor>
                <CounsellorWorkspace />
              </RequireCounsellor>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
