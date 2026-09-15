import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import Layout from "./layout/Layout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import Timetable from "./pages/Timetable";
import Homework from "./pages/Homework";
import Examination from "./pages/Examination";
import AcademicSessions from "./pages/AcademicSessions";
import ReportCard from "./pages/ReportCard";
import MarksEntry from "./pages/MarksEntry";
import Promotions from "./pages/Promotions";
import Transfers from "./pages/Transfers";
import Rollover from "./pages/Rollover";
import Students from "./pages/Students";
import AdmissionEnquiry from "./pages/AdmissionEnquiry";

import NoticeBoard from "./pages/NoticeBoard";
import Events from "./pages/Events";
import FeesCollection from "./pages/FeesCollection";
import OnlinePayment from "./pages/OnlinePayment";
import Inventory from "./pages/Inventory";
import BusTracking from "./pages/BusTracking";
import Reports from "./pages/Reports";
import Library from "./pages/Library";
import Leave from "./pages/Leave";
import Hostel from "./pages/Hostel";
import Payroll from "./pages/Payroll";
import AddStudent from "./pages/AddStudent";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherMyClass from "./pages/teacher/MyClass";
import TeacherAttendance from "./pages/teacher/Attendance";
import TeacherTimetable from "./pages/teacher/Timetable";
import TeacherHomework from "./pages/teacher/Homework";
import TeacherExams from "./pages/teacher/Exams";
import TeacherPerformance from "./pages/teacher/Performance";
import TeacherNotices from "./pages/teacher/Notices";
import TeacherProfile from "./pages/teacher/Profile";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfile from "./pages/student/Profile";
import StudentAttendance from "./pages/student/Attendance";
import StudentTimetable from "./pages/student/Timetable";
import StudentHomework from "./pages/student/Homework";
import StudentExams from "./pages/student/Exams";
import StudentResults from "./pages/student/Results";
import StudentFees from "./pages/student/Fees";
import StudentNotices from "./pages/student/Notices";
import StudentLibrary from "./pages/student/Library";
import StudentTransport from "./pages/student/Transport";
import StudentDocuments from "./pages/student/Documents";
import StudentHostel from "./pages/student/Hostel";
import StudentEvents from "./pages/student/Events";
import StudentAchievements from "./pages/student/Achievements";
import StudentBehavior from "./pages/student/Behavior";
import StudentLeave from "./pages/student/Leave";
import StudentNotifications from "./pages/student/Notifications";
import StudentStudyMaterials from "./pages/student/StudyMaterials";
import StudentSyllabus from "./pages/student/Syllabus";
import StaffDashboard from "./pages/StaffDashboard";
import MyAttendance from "./pages/MyAttendance";
import Notifications from "./pages/Notifications";
import MyProfile from "./pages/staff/MyProfile";
import AccountantDashboard from "./pages/staff/AccountantDashboard";
import Fees from "./pages/staff/Fees";
import LibrarianDashboard from "./pages/staff/LibrarianDashboard";
import Books from "./pages/staff/Books";
import Circulation from "./pages/staff/Circulation";
import TransportDashboard from "./pages/staff/TransportDashboard";
import BusRoutes from "./pages/staff/BusRoutes";
import Allocations from "./pages/staff/Allocations";
import ReceptionDashboard from "./pages/staff/ReceptionDashboard";
import Enquiries from "./pages/staff/Enquiries";
import StudentLookup from "./pages/staff/StudentLookup";
import ReceptionNotices from "./pages/staff/ReceptionNotices";
import PlatformDashboard from "./pages/platform/PlatformDashboard";
import SchoolOnboarding from "./pages/platform/SchoolOnboarding";
import SchoolsManagement from "./pages/platform/SchoolsManagement";
import SchoolDetail from "./pages/platform/SchoolDetail";
import PlatformUsers from "./pages/platform/PlatformUsers";
import AuditLogs from "./pages/platform/AuditLogs";
import PlatformReports from "./pages/platform/PlatformReports";
import PlatformSettings from "./pages/platform/PlatformSettings";
import Users from "./pages/Users";
import ManageSchool from "./pages/ManageSchool";
import Subscription from "./pages/Subscription";
import Account from "./pages/Account";
import SchoolSettings from "./pages/SchoolSettings";
import Teachers from "./pages/Teachers";
import Plans from "./pages/Plans";
import Subscriptions from "./pages/Subscriptions";
import CounsellorWorkspace from "./pages/CounsellorWorkspace";
import StudentCompleteProfile from "./pages/StudentCompleteProfile";
import BehaviorLog from "./pages/BehaviorLog";
import Achievements from "./pages/Achievements";
import {
  selectIsAuthenticated,
  selectRole,
  selectUser,
  selectSchool,
} from "./store/selectors";
import { hasPermission } from "./lib/permissions";
import { resolvePersona } from "./lib/persona";
import SplashScreen from "./components/SplashScreen";

function ProtectedLayout() {
  const isAuth = useSelector(selectIsAuthenticated);
  const school = useSelector(selectSchool);
  const role = useSelector(selectRole);
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  // Block suspended schools from accessing the app (except super_admin and
  // the subscription page itself so they can view/upgrade their plan).
  if (
    school?.status === "suspended" &&
    role !== "super_admin"
  ) {
    return <Navigate to="/subscription" replace />;
  }
  return <Layout />;
}

function RequireRole({ roles, children, fallback = "/" }) {
  const role = useSelector(selectRole);
  if (!roles.includes(role)) {
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

function HomeRedirect() {
  const user = useSelector(selectUser);
  const school = useSelector(selectSchool);
  const role = user?.role || "admin";
  if (role === "super_admin") return <Navigate to="/platform" replace />;
  // Suspended school admins land on the subscription page
  if (role === "school_admin" && school?.status === "suspended") {
    return <Navigate to="/subscription" replace />;
  }
  if (role === "teacher") return <Navigate to="/teacher-dashboard" replace />;
  if (role === "student") return <Navigate to="/student-dashboard" replace />;
  if (role === "staff") {
    const persona = resolvePersona(user);
    if (persona && persona.landing !== "/staff-dashboard") {
      return <Navigate to={persona.landing} replace />;
    }
    return <Navigate to="/staff-dashboard" replace />;
  }
  return <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SplashScreen />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<HomeRedirect />} />
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
            path="/student/behavior"
            element={
              <RequireRole roles={["student"]}>
                <StudentBehavior />
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
            path="/inventory"
            element={
              <RequirePermission permission="inventory:read">
                <Inventory />
              </RequirePermission>
            }
          />
          <Route
            path="/bus-tracking"
            element={
              <RequirePermission permission="transport:read">
                <RequireNotStudent>
                  <BusTracking />
                </RequireNotStudent>
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
            path="/behavior"
            element={
              <RequirePermission permission="conduct:read">
                <RequireNotStudent>
                  <BehaviorLog />
                </RequireNotStudent>
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
    </BrowserRouter>
  );
}
