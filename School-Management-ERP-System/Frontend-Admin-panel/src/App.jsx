import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { useSelector } from "react-redux";
import Layout from "./layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Attendance from "./pages/Attendance";
import Timetable from "./pages/Timetable";
import Homework from "./pages/Homework";
import Examination from "./pages/Examination";
import ReportCard from "./pages/ReportCard";
import Students from "./pages/Students";
import AdmissionEnquiry from "./pages/AdmissionEnquiry";
import Communication from "./pages/Communication";
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
import ClassTeacherDashboard from "./pages/ClassTeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import Platform from "./pages/Platform";
import Users from "./pages/Users";
import Plans from "./pages/Plans";
import Subscriptions from "./pages/Subscriptions";
import {
  selectIsAuthenticated,
  selectRole,
  selectUser,
} from "./store/selectors";
import { hasPermission } from "./lib/permissions";

function ProtectedLayout() {
  const isAuth = useSelector(selectIsAuthenticated);
  if (!isAuth) {
    return <Navigate to="/login" replace />;
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

function HomeRedirect() {
  const user = useSelector(selectUser);
  const role = user?.role || "admin";
  if (role === "super_admin") return <Navigate to="/platform" replace />;
  if (role === "class_teacher" || role === "teacher")
    return <Navigate to="/teacher-dashboard" replace />;
  if (role === "student" || role === "parent")
    return <Navigate to="/student-dashboard" replace />;
  if (role === "staff") return <Navigate to="/staff-dashboard" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/platform"
            element={
              <RequireRole roles={["super_admin"]} fallback="/student-dashboard">
                <Platform />
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
            path="/teacher-dashboard"
            element={
              <RequireRole roles={["school_admin", "class_teacher"]}>
                <ClassTeacherDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/student-dashboard"
            element={
              <RequireRole roles={["school_admin", "student"]}>
                <StudentDashboard />
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
            path="/attendance"
            element={
              <RequirePermission permission="attendance:read">
                <Attendance />
              </RequirePermission>
            }
          />
          <Route
            path="/timetable"
            element={
              <RequirePermission permission="timetable:read">
                <Timetable />
              </RequirePermission>
            }
          />
          <Route
            path="/homework"
            element={
              <RequirePermission permission="homework:read">
                <Homework />
              </RequirePermission>
            }
          />
          <Route
            path="/examination"
            element={
              <RequirePermission permission="exams:read">
                <Examination />
              </RequirePermission>
            }
          />
          <Route
            path="/report-card"
            element={
              <RequirePermission permission="marks:read">
                <ReportCard />
              </RequirePermission>
            }
          />
          <Route
            path="/students"
            element={
              <RequirePermission permission="students:read">
                <Students />
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
            path="/communication"
            element={
              <RequireRole roles={["school_admin", "class_teacher", "staff", "super_admin"]}>
                <Communication />
              </RequireRole>
            }
          />
          <Route
            path="/notice-board"
            element={
              <RequirePermission permission="notices:read">
                <NoticeBoard />
              </RequirePermission>
            }
          />
          <Route
            path="/events"
            element={
              <RequirePermission permission="events:read">
                <Events />
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
                <OnlinePayment />
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
                <BusTracking />
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
            path="/library"
            element={
              <RequirePermission permission="library:read">
                <Library />
              </RequirePermission>
            }
          />
          <Route
            path="/leave"
            element={
              <RequirePermission permission="leaves:apply">
                <Leave />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}