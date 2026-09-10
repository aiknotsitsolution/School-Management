import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import SupportChatbot from "../components/SupportChatbot";
import { selectSchool } from "../store/selectors";

const titles = {
  "/": "Dashboard",
  "/teacher-dashboard": "Class Teacher Dashboard",
  "/teacher/my-class": "My Class",
  "/teacher/attendance": "Attendance",
  "/teacher/timetable": "Timetable",
  "/teacher/homework": "Homework & Assignments",
  "/teacher/exams": "Examinations",
  "/teacher/performance": "Class Performance",
  "/teacher/notices": "Notices",
  "/teacher/profile": "My Profile",
  "/student-dashboard": "Student / Parent Dashboard",
  "/student/profile": "My Profile",
  "/student/attendance": "My Attendance",
  "/student/timetable": "My Timetable",
  "/student/homework": "Homework & Assignments",
  "/student/exams": "Examinations",
  "/student/results": "Results & Report Card",
  "/student/fees": "Fees & Payments",
  "/student/notices": "Notices",
  "/student/library": "My Library",
  "/student/transport": "My Transport",
  "/attendance": "Attendance",
  "/timetable": "Timetable",
  "/homework": "Homework",
  "/examination": "Examination",
  "/report-card": "Report Card",
  "/students": "Student Database",
  "/admission-enquiry": "Admission Enquiry",
  "/notice-board": "Notice Board",
  "/events": "Events",
  "/fees-collection": "Fees Collection",
  "/online-payment": "Online Fees Payment",
  "/inventory": "Inventory Management",
  "/bus-tracking": "Bus Tracking",
  "/reports": "Reports & Analytics",
  "/platform": "Platform Dashboard",
  "/platform/onboarding": "School Onboarding",
  "/platform/schools": "Schools Management",
  "/platform/users": "Users & Access",
  "/platform/audit": "Audit Logs",
  "/platform/reports": "Platform Reports",
  "/platform/settings": "Platform Settings",
  "/platform/plans": "Plans & Pricing",
  "/platform/subscriptions": "Subscriptions",
"/staff-dashboard": "Staff Dashboard",
  "/staff/my-attendance": "My Attendance",
  "/staff/profile": "My Profile",
  "/notifications": "Notifications",
  "/accountant": "Accountant Dashboard",
  "/accountant/fees": "Manage Fees",
  "/librarian": "Librarian Dashboard",
  "/librarian/books": "Library Catalogue",
  "/librarian/circulation": "Circulation",
  "/transport": "Transport Dashboard",
  "/transport/routes": "Bus Routes",
  "/transport/allocations": "Student Allocations",
  "/reception": "Reception Dashboard",
  "/reception/enquiries": "Admission Enquiries",
  "/reception/student-lookup": "Student Lookup",
  "/reception/notices": "Notice Board",
  "/leave": "Leave Management",
};

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const school = useSelector(selectSchool);
  const title = titles[location.pathname] || "Brightwood ERP";

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
          {school && (
            <div className="flex items-center gap-2 mb-4 text-[11.5px] text-slate-text/70">
              <span className="font-semibold truncate">
                {school.name} · {school.code}
              </span>
              {school.session && (
                <>
                  <span className="text-slate-text/40">·</span>
                  <span>Session {school.session}</span>
                </>
              )}
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <SupportChatbot />
    </div>
  );
}
