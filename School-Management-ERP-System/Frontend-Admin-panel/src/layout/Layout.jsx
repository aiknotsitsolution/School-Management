import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const titles = {
  "/": "Dashboard",
  "/teacher-dashboard": "Class Teacher Dashboard",
  "/student-dashboard": "Student / Parent Dashboard",
  "/attendance": "Attendance",
  "/timetable": "Timetable",
  "/homework": "Homework",
  "/examination": "Examination",
  "/report-card": "Report Card",
  "/students": "Student Database",
  "/admission-enquiry": "Admission Enquiry",
  "/communication": "Communication",
  "/notice-board": "Notice Board",
  "/events": "Events",
  "/fees-collection": "Fees Collection",
  "/online-payment": "Online Fees Payment",
  "/inventory": "Inventory Management",
  "/bus-tracking": "Bus Tracking",
  "/reports": "Reports & Analytics",
};

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const title = titles[location.pathname] || "Brightwood ERP";

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
