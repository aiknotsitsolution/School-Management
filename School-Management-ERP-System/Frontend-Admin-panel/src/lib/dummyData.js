// Shared dummy data for role-based dashboards.
// All data is self-contained — no API calls required.

function makeAvatar(name) {
  const encoded = encodeURIComponent(name || "Student");
  return `https://ui-avatars.com/api/?name=${encoded}&background=16213E&color=fff&bold=true`;
}

// ─── Class Teacher Dashboard Data ────────────────────────────────────────────

export const TEACHER = {
  name: "Anjali Verma",
  class: "8",
  section: "A",
  subjects: ["Science", "Physics"],
  employeeId: "EMP-1024",
};

export const CLASS_STUDENTS = [
  { id: "STU-001", name: "Aarav Sharma", roll: 1, gender: "Male", attendance: 96, feeStatus: "Paid", parentContact: "+91 98765 43210", bloodGroup: "A+" },
  { id: "STU-002", name: "Diya Patel", roll: 2, gender: "Female", attendance: 98, feeStatus: "Paid", parentContact: "+91 98765 43211", bloodGroup: "B+" },
  { id: "STU-003", name: "Rohan Gupta", roll: 3, gender: "Male", attendance: 82, feeStatus: "Pending", parentContact: "+91 98765 43212", bloodGroup: "O+" },
  { id: "STU-004", name: "Sneha Iyer", roll: 4, gender: "Female", attendance: 94, feeStatus: "Paid", parentContact: "+91 98765 43213", bloodGroup: "AB+" },
  { id: "STU-005", name: "Kabir Singh", roll: 5, gender: "Male", attendance: 88, feeStatus: "Partially Paid", parentContact: "+91 98765 43214", bloodGroup: "A-" },
  { id: "STU-006", name: "Meera Nair", roll: 6, gender: "Female", attendance: 97, feeStatus: "Paid", parentContact: "+91 98765 43215", bloodGroup: "B-" },
  { id: "STU-007", name: "Arjun Reddy", roll: 7, gender: "Male", attendance: 74, feeStatus: "Pending", parentContact: "+91 98765 43216", bloodGroup: "O-" },
  { id: "STU-008", name: "Ananya Das", roll: 8, gender: "Female", attendance: 91, feeStatus: "Paid", parentContact: "+91 98765 43217", bloodGroup: "A+" },
  { id: "STU-009", name: "Vivaan Joshi", roll: 9, gender: "Male", attendance: 85, feeStatus: "Paid", parentContact: "+91 98765 43218", bloodGroup: "B+" },
  { id: "STU-010", name: "Ishita Menon", roll: 10, gender: "Female", attendance: 93, feeStatus: "Paid", parentContact: "+91 98765 43219", bloodGroup: "O+" },
  { id: "STU-011", name: "Vihaan Kumar", roll: 11, gender: "Male", attendance: 68, feeStatus: "Pending", parentContact: "+91 98765 43220", bloodGroup: "AB-" },
  { id: "STU-012", name: "Prisha Agarwal", roll: 12, gender: "Female", attendance: 99, feeStatus: "Paid", parentContact: "+91 98765 43221", bloodGroup: "A+" },
  { id: "STU-013", name: "Aditya Bose", roll: 13, gender: "Male", attendance: 77, feeStatus: "Paid", parentContact: "+91 98765 43222", bloodGroup: "B+" },
  { id: "STU-014", name: "Navya Kulkarni", roll: 14, gender: "Female", attendance: 90, feeStatus: "Paid", parentContact: "+91 98765 43223", bloodGroup: "O+" },
  { id: "STU-015", name: "Reyansh Chauhan", roll: 15, gender: "Male", attendance: 86, feeStatus: "Partially Paid", parentContact: "+91 98765 43224", bloodGroup: "A-" },
  { id: "STU-016", name: "Kiara Malhotra", roll: 16, gender: "Female", attendance: 95, feeStatus: "Paid", parentContact: "+91 98765 43225", bloodGroup: "B+" },
  { id: "STU-017", name: "Advait Thakur", roll: 17, gender: "Male", attendance: 71, feeStatus: "Pending", parentContact: "+91 98765 43226", bloodGroup: "O+" },
  { id: "STU-018", name: "Saanvi Bhat", roll: 18, gender: "Female", attendance: 92, feeStatus: "Paid", parentContact: "+91 98765 43227", bloodGroup: "AB+" },
  { id: "STU-019", name: "Dhruv Saxena", roll: 19, gender: "Male", attendance: 89, feeStatus: "Paid", parentContact: "+91 98765 43228", bloodGroup: "A+" },
  { id: "STU-020", name: "Myra Choudhary", roll: 20, gender: "Female", attendance: 97, feeStatus: "Paid", parentContact: "+91 98765 43229", bloodGroup: "B-" },
];

// Today's attendance status for each student
export const TODAY_ATTENDANCE = {
  "STU-001": "present", "STU-002": "present", "STU-003": "absent",
  "STU-004": "present", "STU-005": "present", "STU-006": "present",
  "STU-007": "leave",   "STU-008": "present", "STU-009": "present",
  "STU-010": "present", "STU-011": "absent",  "STU-012": "present",
  "STU-013": "present", "STU-014": "present", "STU-015": "present",
  "STU-016": "present", "STU-017": "late",    "STU-018": "present",
  "STU-019": "present", "STU-020": "present",
};

export const PENDING_HOMEWORK = [
  { id: "HW-001", title: "Science Lab Report: Photosynthesis", subject: "Science", dueDate: "2026-09-10", submissions: 12, total: 20 },
  { id: "HW-002", title: "Physics Worksheet — Newton's Laws", subject: "Physics", dueDate: "2026-09-11", submissions: 5, total: 20 },
  { id: "HW-003", title: "Read Chapter 8: Chemistry in Everyday Life", subject: "Science", dueDate: "2026-09-12", submissions: 0, total: 20 },
];

export const UPCOMING_EXAMS = [
  { id: "EX-001", name: "Unit Test 3 — Science", date: "2026-09-15", time: "10:00 AM – 11:30 AM", maxMarks: 50 },
  { id: "EX-002", name: "Physics Lab Practical", date: "2026-09-18", time: "02:00 PM – 03:30 PM", maxMarks: 30 },
  { id: "EX-003", name: "Mid-Term — Science", date: "2026-09-25", time: "09:00 AM – 12:00 PM", maxMarks: 100 },
];

export const TEACHER_NOTICES = [
  { id: "N-001", title: "Science Fair Registration Open", date: "2026-09-05", category: "Academic", pinned: true },
  { id: "N-002", title: "PTM Scheduled for Class 8 — Sept 20", date: "2026-09-03", category: "Event", pinned: false },
  { id: "N-003", title: "Revised Bell Timing for Navratri Week", date: "2026-09-01", category: "Holiday", pinned: false },
];

export const TEACHER_TIMETABLE_TODAY = [
  { period: "09:00 – 09:40", subject: "Science", type: "class" },
  { period: "09:40 – 10:20", subject: "Science", type: "class" },
  { period: "10:20 – 11:00", subject: "Physics", type: "class" },
  { period: "11:00 – 11:20", subject: "Break", type: "break" },
  { period: "11:20 – 12:00", subject: "Science (8-B)", type: "class" },
  { period: "12:00 – 12:40", subject: "Physics (8-B)", type: "class" },
  { period: "12:40 – 01:20", subject: "Lab Period", type: "lab" },
  { period: "01:20 – 02:00", subject: "Free / Prep", type: "free" },
];

export const STUDENT_LEAVE_REQUESTS = [
  { id: "LR-001", studentName: "Rohan Gupta", roll: 3, fromDate: "2026-09-08", toDate: "2026-09-09", reason: "Medical appointment — dentist", status: "Pending" },
  { id: "LR-002", studentName: "Vihaan Kumar", roll: 11, fromDate: "2026-09-09", toDate: "2026-09-09", reason: "Family function out of town", status: "Pending" },
  { id: "LR-003", studentName: "Advait Thakur", roll: 17, fromDate: "2026-09-07", toDate: "2026-09-08", reason: "Unwell — fever", status: "Approved" },
];

export const PERFORMANCE_TOP = [
  { name: "Prisha Agarwal", roll: 12, avg: 94.5 },
  { name: "Diya Patel", roll: 2, avg: 92.0 },
  { name: "Aarav Sharma", roll: 1, avg: 91.2 },
  { name: "Myra Choudhary", roll: 20, avg: 90.8 },
];

export const PERFORMANCE_NEEDS_ATTENTION = [
  { name: "Vihaan Kumar", roll: 11, avg: 58.0 },
  { name: "Advait Thakur", roll: 17, avg: 61.5 },
  { name: "Arjun Reddy", roll: 7, avg: 65.0 },
  { name: "Aditya Bose", roll: 13, avg: 68.2 },
];

export const TEACHER_ATTENDANCE_TREND = [
  { month: "Apr", attendance: 93 },
  { month: "May", attendance: 89 },
  { month: "Jun", attendance: 91 },
  { month: "Jul", attendance: 88 },
  { month: "Aug", attendance: 94 },
  { month: "Sep", attendance: 92 },
];

// ─── Student / Parent Dashboard Data ────────────────────────────────────────

export const STUDENT = {
  id: "STU-001",
  name: "Aarav Sharma",
  class: "8",
  section: "A",
  roll: 1,
  admissionNo: "AD-2024-001",
  dob: "2014-03-15",
  bloodGroup: "A+",
  gender: "Male",
  parentName: "Rajesh Sharma",
  parentContact: "+91 98765 43210",
  busRoute: "R-03",
  busStop: "Sector 5 Market",
};

export const STUDENT_ATTENDANCE = {
  present: 156,
  absent: 5,
  late: 3,
  leave: 2,
  total: 166,
  percentage: 94,
  monthly: [
    { month: "Apr", percentage: 96 },
    { month: "May", percentage: 92 },
    { month: "Jun", percentage: 95 },
    { month: "Jul", percentage: 88 },
    { month: "Aug", percentage: 97 },
    { month: "Sep", percentage: 94 },
  ],
  // Days present/absent for the current month calendar
  calendarDays: [
    { day: 1, status: "present" }, { day: 2, status: "present" }, { day: 3, status: "present" },
    { day: 4, status: "present" }, { day: 5, status: "present" }, { day: 6, status: "absent" },
    { day: 7, status: "present" }, { day: 8, status: "present" }, { day: 9, status: "present" },
    { day: 10, status: "late" }, { day: 11, status: "present" }, { day: 12, status: "present" },
    { day: 13, status: "present" }, { day: 14, status: "present" }, { day: 15, status: "leave" },
    { day: 16, status: "present" }, { day: 17, status: "present" }, { day: 18, status: "present" },
    { day: 19, status: "present" }, { day: 20, status: "present" }, { day: 21, status: "present" },
    { day: 22, status: "present" }, { day: 23, status: "present" }, { day: 24, status: "present" },
    { day: 25, status: "present" }, { day: 26, status: "present" }, { day: 27, status: "absent" },
    { day: 28, status: "present" }, { day: 29, status: "present" }, { day: 30, status: "present" },
  ],
};

export const STUDENT_TIMETABLE = [
  { period: "09:00 – 09:40", subject: "Mathematics", teacher: "Suresh Kulkarni" },
  { period: "09:40 – 10:20", subject: "English", teacher: "Priya Nair" },
  { period: "10:20 – 11:00", subject: "Science", teacher: "Anjali Verma" },
  { period: "11:00 – 11:20", subject: "Break", teacher: "" },
  { period: "11:20 – 12:00", subject: "Social Science", teacher: "Kavita Joshi" },
  { period: "12:00 – 12:40", subject: "Hindi", teacher: "Ramesh Iyer" },
  { period: "12:40 – 01:20", subject: "Computer Science", teacher: "Manish Gupta" },
  { period: "01:20 – 02:00", subject: "Physical Education", teacher: "Arun Chauhan" },
];

export const STUDENT_EXAMS = [
  { id: "EX-001", name: "Unit Test 2 — Mathematics", date: "2026-08-12", status: "Completed", marks: 42, maxMarks: 50 },
  { id: "EX-002", name: "Unit Test 2 — English", date: "2026-08-14", status: "Completed", marks: 45, maxMarks: 50 },
  { id: "EX-003", name: "Unit Test 2 — Science", date: "2026-08-16", status: "Completed", marks: 47, maxMarks: 50 },
  { id: "EX-004", name: "Unit Test 3 — Science", date: "2026-09-15", status: "Upcoming", maxMarks: 50 },
  { id: "EX-005", name: "Mid-Term — Mathematics", date: "2026-09-25", status: "Upcoming", maxMarks: 100 },
];

export const STUDENT_SUBJECT_MARKS = [
  { subject: "Mathematics", marks: 42, maxMarks: 50, percentage: 84 },
  { subject: "English", marks: 45, maxMarks: 50, percentage: 90 },
  { subject: "Science", marks: 47, maxMarks: 50, percentage: 94 },
  { subject: "Hindi", marks: 38, maxMarks: 50, percentage: 76 },
  { subject: "Social Science", marks: 41, maxMarks: 50, percentage: 82 },
  { subject: "Computer Science", marks: 44, maxMarks: 50, percentage: 88 },
];

export const STUDENT_HOMEWORK = [
  { id: "HW-001", title: "Mathematics: Algebra Worksheet Ch.4", subject: "Mathematics", dueDate: "2026-09-08", status: "Submitted", submittedOn: "2026-09-07" },
  { id: "HW-002", title: "English: Essay on Environmental Pollution", subject: "English", dueDate: "2026-09-10", status: "Pending" },
  { id: "HW-003", title: "Science: Lab Report — Chemical Reactions", subject: "Science", dueDate: "2026-09-10", status: "Pending" },
  { id: "HW-004", title: "Hindi: पर्यावरण पर निबंध", subject: "Hindi", dueDate: "2026-09-12", status: "Pending" },
  { id: "HW-005", title: "Computer Science: HTML Project — My School Website", subject: "Computer Science", dueDate: "2026-09-15", status: "Pending" },
  { id: "HW-006", title: "Social Science: Map Work — Indian Freedom Movement", subject: "Social Science", dueDate: "2026-09-06", status: "Graded", grade: "A" },
];

export const STUDENT_FEES = {
  total: 45000,
  paid: 30000,
  pending: 15000,
  status: "Partially Paid",
  nextDue: "2026-09-20",
  nextAmount: 15000,
  history: [
    { id: "INV-001", label: "Q1 Tuition Fee", amount: 15000, paidOn: "2026-04-05", status: "Paid", receiptNo: "RCPT-20240405-01" },
    { id: "INV-002", label: "Q2 Tuition Fee", amount: 15000, paidOn: "2026-07-03", status: "Paid", receiptNo: "RCPT-20240703-02" },
    { id: "INV-003", label: "Q3 Tuition Fee", amount: 15000, paidOn: null, status: "Pending", receiptNo: "" },
  ],
};

export const STUDENT_LIBRARY = [
  { id: "LIB-001", title: "A Brief History of Time", author: "Stephen Hawking", issuedOn: "2026-08-25", dueDate: "2026-09-08", status: "Issued" },
  { id: "LIB-002", title: "The Discovery of India", author: "Jawaharlal Nehru", issuedOn: "2026-09-01", dueDate: "2026-09-15", status: "Issued" },
];

export const STUDENT_NOTICES = [
  { id: "N-001", title: "Science Fair Registration Open", date: "2026-09-05", category: "Academic", pinned: true },
  { id: "N-002", title: "PTM Scheduled for Class 8 — Sept 20", date: "2026-09-03", category: "Event", pinned: false },
  { id: "N-003", title: "Revised Bell Timing for Navratri Week", date: "2026-09-01", category: "Holiday", pinned: false },
  { id: "N-004", title: "Inter-School Cricket Tournament — Oct 2", date: "2026-09-06", category: "Sports", pinned: false },
];

export const STUDENT_EVENTS = [
  { id: "EVT-001", title: "Annual Day Rehearsals Begin", date: "2026-09-12", venue: "Main Auditorium" },
  { id: "EVT-002", title: "Science Fair — Class 8-10", date: "2026-09-20", venue: "Science Block" },
];

export const STUDENT_TRANSPORT = {
  busNo: "Bus R-03",
  driverName: "Hari Prasad",
  driverContact: "+91 99887 76655",
  route: "Vasant Vihar → Sector 5 → School",
  pickupTime: "07:45 AM",
  dropTime: "02:45 PM",
};
