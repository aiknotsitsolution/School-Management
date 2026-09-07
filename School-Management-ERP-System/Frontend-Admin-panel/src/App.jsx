import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
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
import AddStudent from "./pages/AddStudent";

function ProtectedLayout() {
  if (!localStorage.getItem("erp_access_token")) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/homework" element={<Homework />} />
          <Route path="/examination" element={<Examination />} />
          <Route path="/report-card" element={<ReportCard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/admission-enquiry" element={<AdmissionEnquiry />} />
          <Route path="/communication" element={<Communication />} />
          <Route path="/notice-board" element={<NoticeBoard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/fees-collection" element={<FeesCollection />} />
          <Route path="/online-payment" element={<OnlinePayment />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/bus-tracking" element={<BusTracking />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/library" element={<Library />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/hostel" element={<Hostel />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/addstudent" element={<AddStudent />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
