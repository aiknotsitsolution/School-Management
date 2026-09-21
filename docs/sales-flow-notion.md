# School Management System — Complete User Flow

> **Audience:** Sales Team · Sales Executives · Product Demonstrations
> **Purpose:** Understand the complete product journey — who logs in, where they go, what they do, and how the system works end-to-end.
> **Last Updated:** September 2026

---

## Table of Contents

1. [Platform Level (Super Admin)](#1-platform-level)
2. [School Admin Journey](#2-school-admin-journey)
3. [Teacher Journey](#3-teacher-journey)
4. [Student Journey](#4-student-journey)
5. [Staff Personas](#5-staff-personas)
6. [Recommended Sales Demo Journey](#6-recommended-sales-demo-journey)
7. [Module Navigation](#7-module-navigation)
8. [Who Uses What? — Permission Table](#8-who-uses-what)
9. [Key Handoffs Between Roles](#9-key-handoffs)
10. [Salesperson Explanation](#10-salesperson-explanation)

---

## 1. Platform Level

> **Who:** Super Admin / Platform Owner
> **Where:** `school-management.vercel.app` → Super Admin Login

### Platform Dashboard
- Total Schools (Active / Suspended / Trialing)
- Monthly Recurring Revenue (MRR)
- User Growth chart
- Schools at Risk (past due / suspended)
- Revenue trend

### Super Admin Workflow

```
Super Admin Login
    ↓
Platform Dashboard
    ↓
┌─────────────────────────────────────────────────┐
│                                                 │
│  School Onboarding (4-Step Wizard)              │
│  ├── Step 1: School Profile                     │
│  │   └── Name, Code, Short Name, Session Dates, │
│  │       Email, Phone, Address, City, State      │
│  ├── Step 2: School Admin Account               │
│  │   └── Admin Name, Email, Password             │
│  ├── Step 3: Subscription Plan                  │
│  │   └── Select Plan (Free / Starter / Pro)      │
│  └── Step 4: Launch                             │
│      └── Review & Launch School                  │
│                                                 │
│  ✅ School Created + Admin Account Ready         │
│                                                 │
└─────────────────────────────────────────────────┘
    ↓
School Admin Logs In (Handoff)
```

### Other Super Admin Pages

| Page | What It Does |
|------|-------------|
| Schools Management | List, search, suspend/activate all registered schools |
| School Detail | Full school profile, users, subscription, onboarding progress |
| Plans & Pricing | Create, edit, activate/deactivate subscription plans |
| Subscriptions | View all school subscriptions, pause/resume/cancel |
| Platform Users | Manage all platform-level and school-level user accounts |
| Audit Logs | Track all significant actions (login, changes, subscriptions) |
| Platform Reports | Revenue, growth, school performance reports |
| Platform Settings | Platform name, tagline, security, billing, notifications |

---

## 2. School Admin Journey

> **Who:** School Admin / Principal / Administrator
> **Where:** `school-management.vercel.app` → School Admin Login

### School Admin Dashboard

The dashboard shows a complete bird's-eye view:

- **Hero Banner** — Greeting, today's date, student/staff counts, attendance %
- **Quick Actions** — Add Student, Add Staff, Fee Collection, Publish Notice, New Event, Homework
- **Stat Cards** — Total Students, Today's Attendance %, Fees Collected, Enquiries, Teachers, Staff, Events, Buses
- **Charts** — Attendance Trend, Students by Section, Fee Collection vs Pending
- **Pinned Notices** — Recent pinned notices
- **Recent Enquiries** — Latest admission enquiries
- **Attendance Watchlist** — Low-attendance students
- **Bus Fleet Status** — Live bus tracking cards
- **Upcoming Events** — Future events

### Complete School Admin Workflow

```
School Admin Login
    ↓
Dashboard
    ↓
┌─────────────────────────────────────────────┐
│  SCHOOL SETUP                                │
│  ├── Manage School                           │
│  │   ├── School Profile (Name, Logo, Banner) │
│  │   ├── Classes (Nursery to Class 12)       │
│  │   ├── Sections (A, B, C per class)        │
│  │   ├── Subjects (Math, Science, etc.)      │
│  │   ├── Fee Types (Tuition, Transport, etc.)│
│  │   ├── Leave Types                         │
│  │   ├── Notice Categories                   │
│  │   └── Event Categories                    │
│  ├── Academic Sessions                       │
│  │   └── Create / Activate / End Sessions    │
│  └── School Settings                         │
│      └── Contact Details, Board, Recognition │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  ADMISSIONS & ENQUIRIES                      │
│  ├── Admission Enquiry (Kanban Pipeline)     │
│  │   ├── New Leads → Contacted → Visit       │
│  │   │   → Confirmed / Declined              │
│  │   └── Stats: Total, New, Confirmed, Rate  │
│  ├── Admission Counsellor Workspace          │
│  │   └── Pipeline Summary, Follow-ups        │
│  └── Confirm Admission                       │
│      └── Student Record Created              │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  USERS & ACCESS                              │
│  ├── Create Student Account                  │
│  │   └── Link to Admission Record            │
│  ├── Create Teacher Account                  │
│  │   └── Link to Staff Record                │
│  ├── Create Staff Account                    │
│  │   └── Link to Staff Record                │
│  ├── Activate / Deactivate Accounts          │
│  └── Reset Passwords                         │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  STUDENT ONBOARDING                          │
│  ├── Onboard Student (Onboarding Form)       │
│  │   ├── Basic: Name, Class, Section, DOB,   │
│  │   │   Gender, House, Blood Group, Medium  │
│  │   ├── Parent: Father, Mother, Phone,      │
│  │   │   Email, Address                      │
│  │   └── Live ID Card Preview                │
│  ├── Complete Student Profile                │
│  │   └── Fill remaining required fields      │
│  └── Issue Student ID Card                   │
│      └── Preview & Print                     │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  STAFF MANAGEMENT                            │
│  ├── Register Teacher / Staff                │
│  │   └── 3-Step Wizard:                     │
│  │       Basics → Role & Position → Subjects │
│  ├── Assign Teacher to Class/Section         │
│  ├── Class Teacher Assignment                │
│  ├── Complete Staff Profile                  │
│  └── Issue Staff ID Card                     │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  ACADEMICS                                   │
│  ├── Academic Setup                          │
│  │   ├── Classes & Sections                  │
│  │   └── Subjects                            │
│  ├── Timetable Builder                       │
│  │   └── Weekly schedule per class/section   │
│  ├── Student Attendance                      │
│  │   ├── Daily marking (P/A/HD/L)            │
│  │   ├── Bulk mark (All Present/Absent)      │
│  │   ├── Class/Section picker                │
│  │   ├── Attendance trend chart              │
│  │   └── CSV export                          │
│  ├── Staff Attendance                        │
│  │   ├── Daily staff check-in/out            │
│  │   └── Monthly summary report              │
│  ├── Homework / Assignments                  │
│  │   ├── Assign tasks with priorities        │
│  │   └── Track status (Pending/Completed)    │
│  ├── Examinations                            │
│  │   ├── Create exams (type, class, subject) │
│  │   ├── Set date, time, room, max marks     │
│  │   └── Publish (Draft → Reviewed → Published)│
│  ├── Marks Entry                             │
│  │   ├── Select exam                         │
│  │   ├── Enter marks per student             │
│  │   └── Auto-compute grades                 │
│  ├── Report Card                             │
│  │   ├── Select student & term               │
│  │   ├── Subject-wise marks + grades         │
│  │   ├── Attendance summary                  │
│  │   └── Print with school branding          │
│  ├── Promotions                              │
│  │   └── End-of-year: Promote / Detain       │
│  ├── Transfers                               │
│  │   └── Transfer between classes/sections   │
│  ├── Academic Rollover                       │
│  │   └── Session transition                  │
│  └── Academic Sessions                       │
│      └── Create / Activate / End sessions    │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  FINANCE                                     │
│  ├── Fee Collection                          │
│  │   ├── Fee Structures (per class)          │
│  │   │   └── Tuition, Transport, Hostel,     │
│  │   │       Exam, Library, Sports, Lab      │
│  │   ├── Generate Invoices (bulk)            │
│  │   ├── Record Payments                     │
│  │   │   └── Cash / Card / UPI / Net Banking │
│  │   └── Print Receipts                      │
│  ├── Online Fees Payment                     │
│  │   └── Razorpay Gateway Integration        │
│  └── Payroll                                 │
│      ├── Create Monthly Payslips             │
│      ├── Basic + Allowances - Deductions     │
│      └── Print Payslips                      │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  COMMUNICATION                               │
│  ├── Notice Board                            │
│  │   ├── Publish notices                     │
│  │   ├── Pin / Unpin                         │
│  │   ├── Target audiences                    │
│  │   │   (All, Parents, Staff, Class-specific)│
│  │   └── Categories: Academic, Holiday,      │
│  │       Sports, Fees, Event, Transport      │
│  └── Events                                  │
│      ├── Create events with categories       │
│      ├── Upload event images                 │
│      └── Categories: Sports, National,       │
│          Academic, Cultural, Holiday, Meeting │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  OPERATIONS                                  │
│  ├── Library                                 │
│  │   ├── Books catalog (Title, Author, ISBN) │
│  │   ├── Issue books to students             │
│  │   ├── Return books                        │
│  │   ├── Track overdue items                 │
│  │   └── Send overdue reminders              │
│  ├── Bus Tracking                            │
│  │   ├── Live map (Leaflet)                  │
│  │   ├── Route management                    │
│  │   ├── Bus cards with driver details       │
│  │   └── Status: On Route / Delayed / Arrived│
│  ├── Hostel Management                       │
│  │   ├── Rooms (Boys/Girls wings)            │
│  │   ├── Bed allocation                      │
│  │   └── Occupancy tracking                  │
│  └── Inventory Management                    │
│      ├── Track stock items                   │
│      ├── Categories: Books, Lab, Sports,     │
│      │   Stationery, IT, Medical, Furniture  │
│      └── Low-stock alerts                    │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  HUMAN RESOURCES                             │
│  ├── Leave Management                        │
│  │   ├── Apply for leave                     │
│  │   ├── Approve / Reject                    │
│  │   └── Types: Casual, Sick, Privilege,     │
│  │       Medical, Maternity, Emergency       │
│  ├── Behavior Log                            │
│  │   ├── Record incidents / warnings         │
│  │   ├── Severity: Low / Medium / High       │
│  │   └── Track resolution                    │
│  └── Achievements                            │
│      ├── Academic, Sports, Arts,             │
│      │   Citizenship, Attendance             │
│      └── Record student achievements         │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  INSIGHTS                                    │
│  ├── Reports & Analytics                     │
│  │   ├── Charts: Enrollment, Fees, Attendance│
│  │   ├── Generate CSV Reports                │
│  │   │   ├── Student Roster                  │
│  │   │   ├── Attendance Summary              │
│  │   │   ├── Fee Collection Report           │
│  │   │   └── Staff Directory                 │
│  │   └── Custom Report Builder               │
│  └── Subscription & Upgrade                  │
│      ├── View Current Plan                   │
│      ├── Compare Plans                       │
│      └── Upgrade / Downgrade                 │
└─────────────────────────────────────────────┘
```

---

## 3. Teacher Journey

> **Who:** Teacher / Class Teacher
> **Where:** `school-management.vercel.app` → Teacher Login

### Teacher Dashboard

- Greeting with class teacher badge
- Student count for assigned classes
- Active Class switcher (for teachers with multiple classes)
- Stat Cards: Students, Present Today, Upcoming Exams, Open Homework
- Mark Attendance (today's students with P/A/HD/L toggles)
- Today's Timetable
- Homework & Assignments
- Upcoming Exams
- Notices

### Complete Teacher Workflow

```
Teacher Login
    ↓
Teacher Dashboard
    ↓
┌──────────────────────────────────────────┐
│  MY TEACHING                              │
│  ├── My Class                             │
│  │   └── View assigned students           │
│  ├── Student Attendance                   │
│  │   ├── Mark Present/Absent/Leave/HalfDay│
│  │   └── Save Attendance                  │
│  ├── Timetable                            │
│  │   └── View my weekly schedule          │
│  ├── Homework & Assignments               │
│  │   ├── Create assignments               │
│  │   └── Track completion                 │
│  ├── Examinations                         │
│  │   └── View scheduled exams             │
│  ├── Class Performance                    │
│  │   └── Analytics for my classes         │
│  └── Notices                              │
│      └── View school notices              │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│  STUDENT MANAGEMENT (My Classes)          │
│  ├── Behavior Log                         │
│  │   └── Record incidents / warnings      │
│  └── Achievements                         │
│      └── Record student achievements      │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│  MY ACCOUNT                               │
│  ├── My Attendance (Check In/Out)         │
│  ├── Leave Request                        │
│  │   └── Apply for leave                  │
│  ├── Payroll (View Payslips)              │
│  └── My Profile                           │
└──────────────────────────────────────────┘
```

**Note:** `class_teacher` is an assignment responsibility (homeroom ownership), NOT a separate role. The teacher has the same permissions but acts on their assigned class specifically.

---

## 4. Student Journey

> **Who:** Student
> **Where:** `school-management.vercel.app` → Student Login

### Student Dashboard

- Greeting with class, admission number
- Attendance %, Average Marks %
- Stat Cards: Attendance, Homework, Exams, Fees Due
- Today's Classes (timetable)
- Attendance Overview (Present/Absent/Leave/Half Day)
- Homework & Assignments
- Upcoming Exams
- Recent Results
- Fees & Payments (Paid vs Outstanding)
- Notices

### Complete Student Workflow

```
Student Admission (via School Admin)
    ↓
Account Created (via Users & Access)
    ↓
Profile Completed (via Onboarding Form)
    ↓
Student Login
    ↓
Student Dashboard
    ↓
┌──────────────────────────────────────────┐
│  MY ACADEMICS                            │
│  ├── My Profile                           │
│  │   └── View / Edit own profile          │
│  ├── My Attendance                         │
│  │   └── View attendance history           │
│  ├── My Timetable                          │
│  │   └── View weekly class schedule        │
│  ├── My Achievements                       │
│  │   └── View own achievements             │
│  └── My Behavior Log                       │
│      └── View own behavior records         │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│  LEARNING                                 │
│  ├── Homework & Assignments               │
│  │   └── View assigned homework            │
│  ├── Examinations                         │
│  │   └── View upcoming exams               │
│  ├── Results & Report Card                │
│  │   └── View marks and grades             │
│  ├── Study Materials                       │
│  │   └── Access study resources            │
│  └── Syllabus                              │
│      └── View subject syllabus             │
└──────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────┐
│  SCHOOL SERVICES                          │
│  ├── Fees & Payments                       │
│  │   └── View invoices and payment status  │
│  ├── Leave Request                         │
│  │   └── Apply for leave                   │
│  ├── Notices                               │
│  │   └── View school notices               │
│  ├── Notifications                         │
│  │   └── System notifications              │
│  ├── My Library                            │
│  │   └── View issued books                 │
│  ├── My Transport                          │
│  │   └── View bus route details            │
│  ├── My Documents                          │
│  │   └── View/download documents           │
│  ├── My Hostel                             │
│  │   └── View hostel allocation            │
│  └── Events                                │
│      └── View school events                │
└──────────────────────────────────────────┘
```

---

## 5. Staff Personas

### 5A. Admission Counsellor

```
Admission Counsellor Login
    ↓
Counsellor Workspace
    ├── Pipeline Summary (Total, Follow-ups, Visits, Conversion)
    ├── Recent Enquiries
    └── Quick Actions
    ↓
Admission Enquiry Page
    ├── Add New Enquiry
    ├── Update Status (New → Contacted → Visit → Confirmed)
    ├── Schedule Follow-ups
    └── Convert to Admission
```

### 5B. Accountant

```
Accountant Login
    ↓
Accountant Dashboard
    ├── Fee Collection Overview
    ├── Pending Payments
    └── Quick Actions
    ↓
Manage Fees
    ├── Fee Structures (per class)
    ├── Generate Invoices
    ├── Record Payments
    └── Print Receipts
    ↓
My Account
    ├── My Attendance
    ├── Leave
    └── Payroll (View)
```

### 5C. Librarian

```
Librarian Login
    ↓
Librarian Dashboard
    ├── Total Books
    ├── Active Issues
    ├── Overdue Items
    └── Quick Actions
    ↓
Books
    ├── Add / Edit / Delete Books
    ├── Search by Title / Author / ISBN
    └── Categories & Copies
    ↓
Circulation
    ├── Issue Books to Students
    ├── Return Books
    └── Send Overdue Reminders
```

### 5D. Transport Coordinator

```
Transport Login
    ↓
Transport Dashboard
    ├── Total Buses
    ├── On Route / Delayed / Not Started
    └── Quick Actions
    ↓
Bus Routes
    ├── Add / Edit Routes
    └── Manage Stops
    ↓
Allocations
    ├── Assign Students to Buses
    └── Track Assignments
```

### 5E. Receptionist

```
Receptionist Login
    ↓
Reception Dashboard
    ├── Enquiry Stats
    ├── Follow-ups Due
    └── Quick Actions
    ↓
Enquiries
    ├── View All Enquiries
    ├── Update Status
    └── Schedule Visits
    ↓
Student Lookup
    └── Quick Search Students
    ↓
Notices
    └── View & Publish Notices
```

### 5F. Generic Staff

```
Staff Login
    ↓
Staff Dashboard
    ├── Profile Summary
    ├── Recent Attendance
    └── Quick Actions
    ↓
My Attendance (Check In/Out)
Leave Request
Payroll (View Payslips)
My Profile
```

---

## 6. Recommended Sales Demo Journey

> **Duration:** 20-30 minutes
> **Goal:** Show the complete school management lifecycle in one demo

### Step-by-Step Demo Path

| # | Step | Module | What to Show |
|---|------|--------|-------------|
| 1 | **Super Admin Login** | Platform | "This is the platform owner's view" |
| 2 | **Onboard a School** | School Onboarding | 4-step wizard: School → Admin → Plan → Launch |
| 3 | **School Admin Login** | Dashboard | "School admin sees their own dashboard" |
| 4 | **Manage School** | Settings | Setup classes, sections, subjects |
| 5 | **Add Admission Enquiry** | Admissions | Kanban pipeline — add a new enquiry |
| 6 | **Confirm Admission** | Admissions | Convert lead → confirmed student |
| 7 | **Create Student Account** | Users & Access | Link account to admission record |
| 8 | **Onboard Student** | Onboarding | Complete profile, upload photo, live ID card |
| 9 | **Issue ID Card** | ID Card | Preview and print the student ID card |
| 10 | **Register Teacher** | Staff | 3-step wizard: Basics → Role → Subjects |
| 11 | **Assign Teacher** | Staff | Assign to class and subject |
| 12 | **Build Timetable** | Academics | Create weekly schedule |
| 13 | **Mark Attendance** | Attendance | Daily attendance — mark students P/A/HD |
| 14 | **Create Fee Structure** | Fees | Set fee types per class |
| 15 | **Generate Invoices** | Fees | Bulk generate invoices |
| 16 | **Collect Fees** | Fees | Record payment, print receipt |
| 17 | **Schedule Exam** | Exams | Create exam with subject, date, max marks |
| 18 | **Enter Marks** | Marks | Enter marks, auto-compute grades |
| 19 | **Print Report Card** | Reports | Generate branded report card |
| 20 | **Publish Notice** | Communication | Targeted notice to parents/staff |
| 21 | **View Reports** | Analytics | Charts and CSV export |

### Demo Talking Points

1. **"One platform, everyone connected"** — Super admin manages the platform, school admin manages the school, teachers teach, students learn, parents stay informed.

2. **"From enquiry to report card"** — Show the complete lifecycle: a parent calls (enquiry), visits the school (campus visit), gets admitted, attends classes, takes exams, receives a report card.

3. **"Role-based security"** — Teachers only see their classes. Students only see their own data. Accountants only see finances. Everyone sees exactly what they need.

4. **"Ready out of the box"** — No setup required. Classes, sections, subjects, fee types — all pre-configured. School can start using it on day one.

5. **"Works on any device"** — Responsive design works on desktop, tablet, and mobile.

---

## 7. Module Navigation

### Quick Reference — Where to Find What

| Need | Go To | Permission Required |
|------|-------|-------------------|
| Add a new student | Onboard Student (`/addstudent`) | `students:write` |
| View all students | Student Database (`/students`) | `students:read` |
| Issue student ID card | Student Database → View → ID Card | `students:write` |
| Add a new teacher | Teachers (`/teachers`) → Add Staff | `staff:write` |
| Assign teacher to class | Teachers → View Profile → Assign | `staff:write` |
| Mark daily attendance | Attendance (`/attendance`) | `attendance:mark` |
| Build a timetable | Timetable (`/timetable`) | `timetable:write` |
| Create an exam | Examination (`/examination`) | `exams:write` |
| Enter marks | Marks Entry (`/marks-entry`) | `marks:write` |
| Print report card | Report Card (`/report-card`) | `marks:read` |
| Set up fee types | Manage School → Fee Types | `users:manage` |
| Create fee structures | Fees Collection (`/fees-collection`) | `fees:structure` |
| Generate invoices | Fees Collection → Invoices | `fees:collect` |
| Collect a payment | Fees Collection → Payments | `fees:collect` |
| Online payment | Online Payment (`/online-payment`) | `fees:read` |
| Publish a notice | Notice Board (`/notice-board`) | `notices:publish` |
| Create an event | Events (`/events`) | `events:publish` |
| Issue a book | Library → Circulation | `library:manage` |
| Track a bus | Bus Tracking (`/bus-tracking`) | `transport:read` |
| Create user account | Users & Access (`/users`) | `users:manage` |
| View reports | Reports (`/reports`) | `reports:view` |
| Manage school settings | Manage School (`/manage-school`) | `users:manage` |
| Upgrade subscription | Subscription (`/subscription`) | `school:settings` |

### Module Categories

| Category | Modules |
|----------|---------|
| **Admissions** | Admission Enquiry, Admission Counsellor Workspace |
| **Students** | Student Database, Onboard Student, Student Complete Profile, Student ID Card, Student Dashboard |
| **Staff** | Teachers/Staff Management, Staff Dashboard, Teacher Dashboard |
| **Academics** | Timetable, Attendance (Student + Staff), Homework, Examinations, Marks Entry, Report Card, Promotions, Transfers, Academic Sessions, Academic Rollover |
| **Finance** | Fees Collection, Online Fees Payment, Payroll |
| **Communication** | Notice Board, Events, Notifications |
| **Operations** | Library, Bus Tracking, Hostel, Inventory |
| **HR** | Leave Management, Behavior Log, Achievements |
| **Reports** | Reports & Analytics |
| **Administration** | Users & Access, Manage School, School Settings, Subscription |

---

## 8. Who Uses What?

### Permission Matrix — Module Access by Role

| Module | Super Admin | School Admin | Teacher | Student | Accountant | Librarian | Receptionist | Transport |
|--------|:-----------:|:------------:|:-------:|:-------:|:----------:|:---------:|:------------:|:---------:|
| **Platform Dashboard** | ✅ | — | — | — | — | — | — | — |
| **School Onboarding** | ✅ | — | — | — | — | — | — | — |
| **Plans & Pricing** | ✅ | — | — | — | — | — | — | — |
| **Subscriptions (Platform)** | ✅ | — | — | — | — | — | — | — |
| **Audit Logs** | ✅ | — | — | — | — | — | — | — |
| **Platform Reports** | ✅ | — | — | — | — | — | — | — |
| **Platform Settings** | ✅ | — | — | — | — | — | — | — |
| | | | | | | | | |
| **School Dashboard** | ✅ | ✅ | — | — | — | — | — | — |
| **Manage School** | ✅ | ✅ | — | — | — | — | — | — |
| **Users & Access** | ✅ | ✅ | — | — | — | — | — | — |
| **Subscription & Upgrade** | ✅ | ✅ | — | — | — | — | — | — |
| | | | | | | | | |
| **Admission Enquiry** | ✅ | ✅ | — | — | — | — | ✅ | — |
| **Student Database** | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| **Onboard Student** | ✅ | ✅ | — | — | — | — | — | — |
| **ID Card** | ✅ | ✅ | — | — | — | — | — | — |
| | | | | | | | | |
| **Register Teacher/Staff** | ✅ | ✅ | — | — | — | — | — | — |
| **Teacher Assignment** | ✅ | ✅ | — | — | — | — | — | — |
| | | | | | | | | |
| **Timetable** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **Student Attendance** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **Staff Attendance** | ✅ | ✅ | ✅ | — | — | — | — | — |
| **Homework** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **Examinations** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **Marks Entry** | ✅ | ✅ | — | — | — | — | — | — |
| **Marks (View)** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **Report Card** | ✅ | ✅ | — | ✅ | — | — | — | — |
| **Promotions** | ✅ | ✅ | ✅ | — | — | — | — | — |
| **Transfers** | ✅ | ✅ | ✅ | — | — | — | — | — |
| **Academic Sessions** | ✅ | ✅ | — | — | — | — | — | — |
| **Academic Rollover** | ✅ | ✅ | ✅ | — | — | — | — | — |
| | | | | | | | | |
| **Fee Structures** | ✅ | ✅ | — | — | ✅ | — | — | — |
| **Fee Collection** | ✅ | ✅ | — | — | ✅ | — | — | — |
| **Online Payment** | ✅ | ✅ | — | ✅ | — | — | — | — |
| **Payroll** | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ |
| | | | | | | | | |
| **Notice Board** | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | — |
| **Events** | ✅ | ✅ | — | ✅ | — | — | — | — |
| **Notifications** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | | | | | | | | |
| **Library** | ✅ | ✅ | — | ✅ | — | ✅ | — | — |
| **Bus Tracking** | ✅ | ✅ | — | ✅ | — | — | — | ✅ |
| **Hostel** | ✅ | ✅ | — | — | — | — | — | — |
| **Inventory** | ✅ | ✅ | — | — | — | — | — | — |
| | | | | | | | | |
| **Behavior Log** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **Achievements** | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| **Leave** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | | | | | | | | |
| **Reports & Analytics** | ✅ | ✅ | — | — | ✅ | — | — | — |
| **Study Materials** | — | — | — | ✅ | — | — | — | — |
| **Syllabus** | — | — | — | ✅ | — | — | — | — |
| **Documents** | — | — | — | ✅ | — | — | — | — |

**Legend:** ✅ = Has access | — = No access

---

## 9. Key Handoffs Between Roles

### Handoff 1: Super Admin → School Admin

```
Super Admin: Onboard School (4-step wizard)
    ↓
School Created + Admin Account Created
    ↓
School Admin: Receives login credentials
    ↓
School Admin: Logs in → Lands on Dashboard
```

**What transfers:** School profile, admin account, subscription plan

### Handoff 2: School Admin → Student

```
School Admin: Confirm Admission (from Enquiry Pipeline)
    ↓
Student Record Created (Admission ID assigned)
    ↓
School Admin: Users & Access → Create Student Account
    ↓
Student Account Created (Login credentials ready)
    ↓
School Admin: Onboard Student → Complete Profile
    ↓
Student: Profile Complete → Account Active
    ↓
Student: Can now log in
```

**What transfers:** Admission record → Student record → User account → Active login

### Handoff 3: School Admin → Teacher

```
School Admin: Teachers → Add Staff (3-step wizard)
    ↓
Staff Record Created (Employee ID assigned)
    ↓
School Admin: Users & Access → Create Teacher Account
    ↓
Teacher Account Created (Login credentials ready)
    ↓
School Admin: Assign Teacher to Class/Section/Subject
    ↓
Teacher: Can now log in and see assigned classes
```

**What transfers:** Staff record → User account → Teacher assignment → Active login

### Handoff 4: Teacher → Student (Academic)

```
Teacher: Marks Attendance → Student sees attendance
Teacher: Creates Homework → Student sees homework
Teacher: Schedules Exam → Student sees exam
Teacher: Enters Marks → Student sees results
Teacher: Records Behavior → Student sees behavior log
Teacher: Records Achievement → Student sees achievement
```

### Handoff 5: Admission Enquiry → Full Student

```
Reception/Counsellor: Add Enquiry (New Lead)
    ↓
Counsellor: Contact → Follow up → Schedule Visit
    ↓
Admin: Confirm Admission → Student Record Created
    ↓
Admin: Create Account → Onboard Student → ID Card
    ↓
Student: Active → Logs in → Dashboard
```

---

## 10. Salesperson Explanation

> **For sales team members with no technical background.**

1. **The journey starts with the Platform Owner** (that's us, or the school chain owner). They log in and see a dashboard showing all schools, revenue, and growth. From here, they onboard a new school using a simple 4-step wizard — enter school details, create the admin account, pick a subscription plan, and launch.

2. **Once the school is created, the School Admin logs in.** They see their own dashboard with student counts, attendance, fees, and everything happening in their school. This is their command center.

3. **First thing the School Admin does is set up the school.** They add classes (Nursery through Class 12), sections (A, B, C), subjects (Math, Science, English), and fee types (Tuition, Transport, etc.). This takes about 5 minutes.

4. **When a parent calls or visits**, the admin (or receptionist/counsellor) creates an admission enquiry. This goes into a Kanban pipeline — New Lead → Contacted → Campus Visit → Confirmed. They can track every prospective student.

5. **Once the parent confirms admission**, the admin creates a student record and a login account. Then they onboard the student — fill in the complete profile, upload a photo, and the system generates a professional ID card that can be printed immediately.

6. **Teachers are registered the same way** — create a staff record, create a login account, assign them to classes and subjects. The teacher can then log in and start using the system.

7. **Daily operations are simple.** Teachers mark attendance with one click per student. Homework is assigned with a title and due date. Exams are scheduled, marks are entered, and report cards are generated — all with the school's branding.

8. **Fees are managed end-to-end.** Define fee structures per class, generate invoices in bulk, collect payments (cash, card, UPI, or online via Razorpay), and print receipts. Parents can also pay online.

9. **Communication is built-in.** Publish notices to specific audiences (all parents, all staff, or specific classes). Create events. Everyone stays informed through the notice board and notifications.

10. **The system also handles library (book issue/return), transport (bus tracking), hostel (room allocation), inventory (stock management), payroll (salary and payslips), and leave management.** It's a complete school operating system.

11. **Every role has their own view.** Teachers see only their classes. Students see only their own data. Accountants see only finances. Librarians see only books. Nobody sees what they shouldn't.

12. **Reports and analytics give the school owner insights** — enrollment trends, fee collection, attendance patterns, staff strength — all exportable as CSV.

---

## Appendix: System Pages Reference

### All Frontend Routes (49 top-level pages + 42 role-based sub-pages)

| Route | Page | Role |
|-------|------|------|
| `/login` | Login | Public |
| `/forgot-password` | Forgot Password | Public |
| `/reset-password` | Reset Password | Public |
| `/platform` | Platform Dashboard | Super Admin |
| `/platform/onboarding` | School Onboarding | Super Admin |
| `/platform/schools` | Schools Management | Super Admin |
| `/platform/schools/:id` | School Detail | Super Admin |
| `/platform/users` | Platform Users | Super Admin |
| `/platform/plans` | Plans & Pricing | Super Admin |
| `/platform/subscriptions` | Subscriptions | Super Admin |
| `/platform/audit` | Audit Logs | Super Admin |
| `/platform/reports` | Platform Reports | Super Admin |
| `/platform/settings` | Platform Settings | Super Admin |
| `/` | Dashboard | School Admin |
| `/students` | Student Database | School Admin, Teacher |
| `/addstudent` | Onboard Student | School Admin |
| `/students/complete/:id` | Complete Student Profile | School Admin |
| `/teachers` | Teachers / Staff | School Admin |
| `/attendance` | Attendance | School Admin |
| `/timetable` | Timetable | School Admin, Teacher |
| `/homework` | Homework | School Admin, Teacher |
| `/examination` | Examination | School Admin, Teacher |
| `/marks-entry` | Marks Entry | School Admin |
| `/report-card` | Report Card | School Admin |
| `/promotions` | Promotions | School Admin, Teacher |
| `/transfers` | Transfers | School Admin, Teacher |
| `/academic-sessions` | Academic Sessions | School Admin |
| `/rollover` | Academic Rollover | School Admin, Teacher |
| `/fees-collection` | Fees Collection | School Admin, Accountant |
| `/online-payment` | Online Payment | School Admin |
| `/payroll` | Payroll | All Staff |
| `/notice-board` | Notice Board | School Admin |
| `/events` | Events | School Admin |
| `/library` | Library | School Admin |
| `/bus-tracking` | Bus Tracking | School Admin |
| `/hostel` | Hostel | School Admin |
| `/inventory` | Inventory | School Admin |
| `/behavior` | Behavior Log | School Admin, Teacher |
| `/achievements` | Achievements | School Admin, Teacher |
| `/leave` | Leave Management | All Staff + Student |
| `/reports` | Reports & Analytics | School Admin, Accountant |
| `/users` | Users & Access | School Admin |
| `/manage-school` | Manage School | School Admin |
| `/subscription` | Subscription & Upgrade | School Admin |
| `/settings` | School Settings | School Admin |
| `/notifications` | Notifications | All |
| `/admission-enquiry` | Admission Enquiry | School Admin, Receptionist |
| `/admission-counsellor` | Counsellor Workspace | Admission Counsellor |
| `/teacher-dashboard` | Teacher Dashboard | Teacher |
| `/teacher/my-class` | My Class | Teacher |
| `/teacher/attendance` | Student Attendance | Teacher |
| `/teacher/timetable` | Timetable | Teacher |
| `/teacher/homework` | Homework | Teacher |
| `/teacher/exams` | Examinations | Teacher |
| `/teacher/performance` | Class Performance | Teacher |
| `/teacher/notices` | Notices | Teacher |
| `/teacher/profile` | My Profile | Teacher |
| `/student-dashboard` | Student Dashboard | Student |
| `/student/profile` | My Profile | Student |
| `/student/attendance` | My Attendance | Student |
| `/student/timetable` | My Timetable | Student |
| `/student/homework` | Homework | Student |
| `/student/exams` | Examinations | Student |
| `/student/results` | Results & Report Card | Student |
| `/student/fees` | Fees & Payments | Student |
| `/student/notices` | Notices | Student |
| `/student/library` | My Library | Student |
| `/student/transport` | My Transport | Student |
| `/student/documents` | My Documents | Student |
| `/student/hostel` | My Hostel | Student |
| `/student/events` | Events | Student |
| `/student/achievements` | My Achievements | Student |
| `/student/behavior` | My Behavior Log | Student |
| `/student/leave` | Leave Request | Student |
| `/student/notifications` | Notifications | Student |
| `/student/study-materials` | Study Materials | Student |
| `/student/syllabus` | Syllabus | Student |
| `/staff-dashboard` | Staff Dashboard | Staff |
| `/staff/my-attendance` | My Attendance | Staff, Teacher |
| `/staff/profile` | My Profile | Staff |
| `/accountant` | Accountant Dashboard | Accountant |
| `/accountant/fees` | Manage Fees | Accountant |
| `/librarian` | Librarian Dashboard | Librarian |
| `/librarian/books` | Books | Librarian |
| `/librarian/circulation` | Circulation | Librarian |
| `/transport` | Transport Dashboard | Transport |
| `/transport/routes` | Bus Routes | Transport |
| `/transport/allocations` | Allocations | Transport |
| `/reception` | Reception Dashboard | Receptionist |
| `/reception/enquiries` | Enquiries | Receptionist |
| `/reception/student-lookup` | Student Lookup | Receptionist |
| `/reception/notices` | Notices | Receptionist |
