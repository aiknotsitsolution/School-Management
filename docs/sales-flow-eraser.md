// ============================================================
// SCHOOL MANAGEMENT SYSTEM — SALES FLOW DIAGRAMS
// Format: Eraser.io Native Diagram-as-Code
// Paste each diagram block separately into Eraser.io
// ============================================================


// ============================================================
// DIAGRAM 1: COMPLETE PLATFORM OVERVIEW
// The big picture — from Platform Owner to every module
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "School Management System — Complete Flow"

SuperAdmin [shape: oval, icon: user, color: blue, label: "Super Admin\nPlatform Owner"]
PlatformDash [icon: monitor, color: blue, label: "Platform Dashboard\nSchools · Revenue · MRR"]
OnboardWizard [icon: plus-circle, color: blue, label: "School Onboarding\n4-Step Wizard"]
SchoolCreated [shape: oval, icon: check-circle, color: green, label: "School Created\nAdmin Account Ready"]
SchoolAdmin [shape: oval, icon: user, color: orange, label: "School Admin\nLogin"]
SchoolDash [icon: home, color: orange, label: "School Dashboard\nOverview of All Operations"]

SuperAdmin > PlatformDash: "manages"
PlatformDash > OnboardWizard: "onboard new school"
OnboardWizard > SchoolCreated: "launch"
SchoolCreated > SchoolAdmin: "handoff"
SchoolAdmin > SchoolDash: "logs in"

// School Setup
ManageSchool [icon: settings, color: purple, label: "Manage School\nClasses · Sections · Subjects\nFee Types · Leave Types"]
SchoolDash > ManageSchool: "first: setup"

// Admission Pipeline
Enquiry [icon: phone, color: teal, label: "Admission Enquiry\nKanban Pipeline"]
Admission [icon: check-square, color: green, label: "Admission Confirmed\nStudent Record Created"]
ManageSchool > Enquiry: "then: receive leads"
Enquiry > Admission: "convert"

// Student Onboarding
UsersAccess [icon: users, color: teal, label: "Users & Access\nCreate Accounts"]
OnboardStudent [icon: user-plus, color: green, label: "Onboard Student\nComplete Profile"]
IDCard [icon: credit-card, color: green, label: "Student ID Card\nPreview & Print"]
Admission > UsersAccess: "create student account"
UsersAccess > OnboardStudent: "fill profile"
OnboardStudent > IDCard: "issue"

// Staff
RegisterStaff [icon: user-plus, color: yellow, label: "Register Teacher / Staff\n3-Step Wizard"]
AssignTeacher [icon: target, color: yellow, label: "Assign Teacher\nto Class & Subject"]
UsersAccess > RegisterStaff: "create staff account"
RegisterStaff > AssignTeacher: "assign"

// Academics
Timetable [icon: calendar, color: cyan, label: "Timetable\nWeekly Schedule"]
Attendance [icon: check-square, color: cyan, label: "Attendance\nDaily Student & Staff"]
Homework [icon: book, color: cyan, label: "Homework\nAssign & Track"]
Exams [icon: clipboard, color: purple, label: "Examinations\nSchedule & Publish"]
Marks [icon: edit, color: purple, label: "Marks Entry\nAuto-Compute Grades"]
ReportCard [icon: file-text, color: purple, label: "Report Card\nPrint with Branding"]
AssignTeacher > Timetable: "build schedule"
Timetable > Attendance: "daily flow"
Attendance > Homework > Exams > Marks > ReportCard: "academic cycle"

// Finance
Fees [icon: credit-card, color: red, label: "Fees Collection\nStructure · Invoice · Collect"]
OnlinePay [icon: credit-card, color: red, label: "Online Payment\nRazorpay Gateway"]
Payroll [icon: credit-card, color: pink, label: "Payroll\nSalary · Payslips"]
Marks > Fees: "fees per class"
Fees > OnlinePay: "online option"
Fees > Payroll: "staff salary"

// Communication
Notices [icon: mail, color: amber, label: "Notice Board\nPublish · Pin · Target"]
Events [icon: calendar, color: amber, label: "Events\nCalendar · Categories"]
ReportCard > Notices: "communicate"
Notices > Events: "schedule"

// Operations
Library [icon: book, color: teal, label: "Library\nBooks · Issue · Return"]
Transport [icon: truck, color: teal, label: "Bus Tracking\nLive Map · Routes"]
Hostel [icon: home, color: teal, label: "Hostel\nRooms · Allocation"]
Inventory [icon: package, color: teal, label: "Inventory\nStock · Alerts"]
Events > Library > Transport > Hostel > Inventory: "operations"

// HR & Insights
Behavior [icon: shield, color: indigo, label: "Behavior Log\nIncidents · Warnings"]
Achievements [icon: star, color: indigo, label: "Achievements\nAcademic · Sports · Arts"]
Leave [icon: file-text, color: indigo, label: "Leave Management\nApply · Approve"]
Reports [icon: bar-chart, color: purple, label: "Reports & Analytics\nCharts · CSV Export"]
Inventory > Behavior > Achievements > Leave > Reports: "insights"

legend {
    [color: blue, label: "Platform Level"]
    [color: orange, label: "School Admin"]
    [color: green, label: "Student Flow"]
    [color: yellow, label: "Staff Flow"]
    [color: cyan, label: "Academics"]
    [color: purple, label: "Exams & Reports"]
    [color: red, label: "Finance"]
    [color: amber, label: "Communication"]
    [color: teal, label: "Operations"]
    [color: indigo, label: "HR & Insights"]
}


// ============================================================
// DIAGRAM 2: SUPER ADMIN JOURNEY
// Platform Owner — what they see and do
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "Super Admin — Platform Owner Journey"

SALogin [shape: oval, icon: user, color: blue, label: "Super Admin Login"]
PADash [icon: monitor, color: blue, label: "Platform Dashboard\nTotal Schools · MRR · Revenue"]
SALogin > PADash

// School Management
SchoolOnboard [icon: plus-circle, color: blue, label: "School Onboarding"]
SchoolList [icon: building, color: blue, label: "Schools Management\nList · Search · Suspend"]
SchoolDetail [icon: building, color: blue, label: "School Detail\nProfile · Users · Subscription"]
PADash > SchoolOnboard
PADash > SchoolList
SchoolList > SchoolDetail: "view"

// Onboarding Steps
Step1 [shape: oval, icon: file-text, color: cyan, label: "Step 1: School Profile\nName · Code · Address"]
Step2 [shape: oval, icon: user, color: cyan, label: "Step 2: Admin Account\nName · Email · Password"]
Step3 [shape: oval, icon: credit-card, color: cyan, label: "Step 3: Subscription\nSelect Plan"]
Step4 [shape: oval, icon: send, color: green, label: "Step 4: Launch\nReview & Launch"]
SchoolOnboard > Step1 > Step2 > Step3 > Step4

// Other pages
PlatformUsers [icon: users, color: blue, label: "Platform Users\nManage All Users"]
Plans [icon: credit-card, color: blue, label: "Plans & Pricing\nCreate · Edit Plans"]
Subscriptions [icon: credit-card, color: blue, label: "Subscriptions\nView · Pause · Resume"]
AuditLogs [icon: file-text, color: blue, label: "Audit Logs\nTrack All Actions"]
Reports [icon: bar-chart, color: blue, label: "Platform Reports\nRevenue · Growth"]
Settings [icon: settings, color: blue, label: "Platform Settings\nGeneral · Security · Billing"]
PADash > PlatformUsers
PADash > Plans
PADash > Subscriptions
PADash > AuditLogs
PADash > Reports
PADash > Settings

legend {
    [color: blue, label: "Platform Level"]
    [color: cyan, label: "Onboarding Steps"]
    [color: green, label: "Launch"]
}


// ============================================================
// DIAGRAM 3: SCHOOL ADMIN COMPLETE JOURNEY
// Everything the school administrator does
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "School Admin — Complete Journey"

SALogin [shape: oval, icon: user, color: orange, label: "School Admin Login"]
Dash [icon: home, color: orange, label: "School Dashboard\nStudents · Attendance · Fees · Staff"]
SALogin > Dash

// ──── ADMISSIONS ────
Admissions [color: teal] {
    Enquiry [icon: phone, color: teal, label: "Admission Enquiry\nKanban Pipeline"]
    Pipeline [shape: diamond, icon: git-branch, color: teal, label: "Pipeline Stage?"]
    NewLead [shape: oval, icon: user-plus, color: cyan, label: "New Lead"]
    Contacted [shape: oval, icon: phone, color: cyan, label: "Contacted"]
    CampusVisit [shape: oval, icon: home, color: cyan, label: "Campus Visit"]
    Confirmed [shape: oval, icon: check-circle, color: green, label: "Confirmed"]
    Declined [shape: oval, icon: x-circle, color: red, label: "Declined"]
}

Dash > Enquiry: "receive leads"
Enquiry > Pipeline
Pipeline > NewLead: "new"
NewLead > Contacted: "follow up"
Contacted > CampusVisit: "schedule visit"
CampusVisit > Confirmed: "admit"
CampusVisit > Declined: "not interested"

// ──── STUDENT ONBOARDING ────
StudentFlow [color: green] {
    UsersAccess [icon: users, color: teal, label: "Users & Access\nCreate Student Account"]
    OnboardStudent [icon: user-plus, color: green, label: "Onboard Student\nComplete Profile"]
    IDCard [icon: credit-card, color: green, label: "ID Card\nPreview & Print"]
}

Confirmed > UsersAccess: "create account"
UsersAccess > OnboardStudent: "fill profile"
OnboardStudent > IDCard: "issue card"

// ──── STAFF ────
StaffFlow [color: yellow] {
    RegisterTeacher [icon: user-plus, color: yellow, label: "Register Teacher\n3-Step Wizard"]
    AssignClass [icon: target, color: yellow, label: "Assign Teacher\nto Class & Subject"]
}

Dash > RegisterTeacher: "add staff"
RegisterTeacher > AssignClass: "assign"

// ──── ACADEMICS ────
Academics [color: cyan] {
    Timetable [icon: calendar, color: cyan, label: "Timetable"]
    Attendance [icon: check-square, color: cyan, label: "Attendance"]
    Homework [icon: book, color: cyan, label: "Homework"]
    Exams [icon: clipboard, color: purple, label: "Exams"]
    Marks [icon: edit, color: purple, label: "Marks Entry"]
    ReportCard [icon: file-text, color: purple, label: "Report Card"]
    Promotions [icon: arrow-up, color: purple, label: "Promotions"]
    Sessions [icon: calendar, color: purple, label: "Academic Sessions"]
}

AssignClass > Timetable: "build schedule"
Timetable > Attendance > Homework > Exams > Marks > ReportCard: "daily cycle"
ReportCard > Promotions > Sessions: "end of year"

// ──── FINANCE ────
Finance [color: red] {
    Fees [icon: credit-card, color: red, label: "Fees Collection"]
    OnlinePay [icon: credit-card, color: red, label: "Online Payment\nRazorpay"]
    Payroll [icon: credit-card, color: pink, label: "Payroll"]
}

Dash > Fees: "manage finance"
Fees > OnlinePay: "online option"
Fees > Payroll: "staff salary"

// ──── COMMUNICATION ────
Communication [color: amber] {
    Notices [icon: mail, color: amber, label: "Notice Board"]
    Events [icon: calendar, color: amber, label: "Events"]
}

Dash > Notices: "communicate"
Notices > Events: "schedule"

// ──── OPERATIONS ────
Operations [color: teal] {
    Library [icon: book, color: teal, label: "Library"]
    Transport [icon: truck, color: teal, label: "Bus Tracking"]
    Hostel [icon: home, color: teal, label: "Hostel"]
    Inventory [icon: package, color: teal, label: "Inventory"]
}

Dash > Library > Transport > Hostel > Inventory: "operations"

// ──── HR ────
HR [color: indigo] {
    Leave [icon: file-text, color: indigo, label: "Leave"]
    Behavior [icon: shield, color: indigo, label: "Behavior Log"]
    Achievements [icon: star, color: indigo, label: "Achievements"]
}

Dash > Leave > Behavior > Achievements: "human resources"

// ──── REPORTS ────
Reports [icon: bar-chart, color: purple, label: "Reports & Analytics"]
Dash > Reports: "insights"

legend {
    [color: orange, label: "School Admin"]
    [color: teal, label: "Admissions"]
    [color: green, label: "Student Flow"]
    [color: yellow, label: "Staff"]
    [color: cyan, label: "Academics"]
    [color: purple, label: "Exams & Reports"]
    [color: red, label: "Finance"]
    [color: amber, label: "Communication"]
    [color: teal, label: "Operations"]
    [color: indigo, label: "HR"]
}


// ============================================================
// DIAGRAM 4: TEACHER JOURNEY
// What teachers see and do after their account is created
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "Teacher Journey"

TeacherLogin [shape: oval, icon: user, color: green, label: "Teacher Login"]
TDash [icon: home, color: green, label: "Teacher Dashboard\nMy Classes · Students · Attendance"]
TeacherLogin > TDash

// My Teaching
MyTeaching [color: green] {
    MyClass [icon: users, color: green, label: "My Class\nView Students"]
    MarkAttendance [icon: check-square, color: green, label: "Student Attendance\nMark P / A / HD / L"]
    MyTimetable [icon: calendar, color: green, label: "Timetable\nMy Schedule"]
    MyHomework [icon: book, color: green, label: "Homework\nAssign & Track"]
    MyExams [icon: clipboard, color: green, label: "Examinations\nView Scheduled"]
    Performance [icon: bar-chart, color: green, label: "Class Performance\nAnalytics"]
    MyNotices [icon: mail, color: green, label: "Notices\nView School Notices"]
}

TDash > MyClass > MarkAttendance > MyTimetable > MyHomework > MyExams > Performance > MyNotices: "teaching tools"

// Student Management (scoped to assigned classes)
StudentMgmt [color: yellow] {
    BehaviorLog [icon: shield, color: yellow, label: "Behavior Log\nRecord Incidents"]
    AchieveRec [icon: star, color: yellow, label: "Achievements\nRecord Achievements"]
}

TDash > BehaviorLog > AchieveRec: "student records"

// My Account
MyAccount [color: cyan] {
    MyAttendance [icon: check-square, color: cyan, label: "My Attendance\nCheck In / Out"]
    LeaveRequest [icon: file-text, color: cyan, label: "Leave Request\nApply for Leave"]
    MyPayroll [icon: credit-card, color: cyan, label: "Payroll\nView Payslips"]
    MyProfile [icon: user, color: cyan, label: "My Profile"]
}

TDash > MyAttendance > LeaveRequest > MyPayroll > MyProfile: "self service"

legend {
    [color: green, label: "Teaching Tools"]
    [color: yellow, label: "Student Records"]
    [color: cyan, label: "Self Service"]
}


// ============================================================
// DIAGRAM 5: STUDENT JOURNEY
// From admission to daily use
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "Student Journey"

Admission [shape: oval, icon: user-plus, color: orange, label: "Admission Confirmed\nby School Admin"]
Account [shape: oval, icon: user, color: teal, label: "Account Created\nvia Users & Access"]
Profile [shape: oval, icon: user-plus, color: green, label: "Profile Completed\nvia Onboarding Form"]
Active [shape: oval, icon: check-circle, color: green, label: "Account Active\nLogin Ready"]
Admission > Account > Profile > Active

StuLogin [shape: oval, icon: user, color: cyan, label: "Student Login"]
SDash [icon: home, color: cyan, label: "Student Dashboard\nMy Academic Overview"]
Active > StuLogin > SDash

// My Academics
Academics [color: cyan] {
    SProfile [icon: user, color: cyan, label: "My Profile"]
    SAttendance [icon: check-square, color: cyan, label: "My Attendance"]
    STimetable [icon: calendar, color: cyan, label: "My Timetable"]
    SAchievements [icon: star, color: cyan, label: "My Achievements"]
    SBehavior [icon: shield, color: cyan, label: "My Behavior Log"]
}

SDash > SProfile > SAttendance > STimetable > SAchievements > SBehavior: "academics"

// Learning
Learning [color: purple] {
    SHomework [icon: book, color: purple, label: "Homework"]
    SExams [icon: clipboard, color: purple, label: "Examinations"]
    SResults [icon: bar-chart, color: purple, label: "Results & Report Card"]
    StudyMat [icon: book, color: purple, label: "Study Materials"]
    Syllabus [icon: file-text, color: purple, label: "Syllabus"]
}

SDash > SHomework > SExams > SResults > StudyMat > Syllabus: "learning"

// School Services
Services [color: amber] {
    SFees [icon: credit-card, color: red, label: "Fees & Payments"]
    SLeave [icon: file-text, color: amber, label: "Leave Request"]
    SNotices [icon: mail, color: amber, label: "Notices"]
    SLibrary [icon: book, color: teal, label: "My Library"]
    STransport [icon: truck, color: teal, label: "My Transport"]
    SDocuments [icon: file-text, color: amber, label: "My Documents"]
    SHostel [icon: home, color: teal, label: "My Hostel"]
    SEvents [icon: calendar, color: amber, label: "Events"]
}

SDash > SFees > SLeave > SNotices > SLibrary > STransport > SDocuments > SHostel > SEvents: "services"

legend {
    [color: cyan, label: "Academics"]
    [color: purple, label: "Learning"]
    [color: amber, label: "School Services"]
}


// ============================================================
// DIAGRAM 6: STAFF PERSONAS
// Different staff types see different workspaces
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "Staff Personas"

StaffLogin [shape: oval, icon: user, color: purple, label: "Staff Login"]
StaffType [shape: diamond, icon: help-circle, color: purple, label: "Staff Type?"]
StaffLogin > StaffType

// Accountant
Accountant [color: orange] {
    AccDash [icon: home, color: orange, label: "Accountant Dashboard"]
    AccFees [icon: credit-card, color: orange, label: "Manage Fees\nStructure · Invoice · Collect"]
    AccReports [icon: bar-chart, color: orange, label: "Fee Reports"]
}
StaffType > AccDash: "Accountant"
AccDash > AccFees > AccReports

// Librarian
Librarian [color: green] {
    LibDash [icon: home, color: green, label: "Librarian Dashboard"]
    LibBooks [icon: book, color: green, label: "Books\nAdd · Edit · Search"]
    LibCirc [icon: refresh-ccw, color: green, label: "Circulation\nIssue · Return · Overdue"]
}
StaffType > LibDash: "Librarian"
LibDash > LibBooks > LibCirc

// Receptionist
Receptionist [color: cyan] {
    RecDash [icon: home, color: cyan, label: "Reception Dashboard"]
    RecEnq [icon: phone, color: cyan, label: "Enquiries\nTrack Leads"]
    RecLookup [icon: search, color: cyan, label: "Student Lookup\nQuick Search"]
    RecNotices [icon: mail, color: cyan, label: "Notices"]
}
StaffType > RecDash: "Receptionist"
RecDash > RecEnq > RecLookup > RecNotices

// Transport
TransportStaff [color: yellow] {
    TransDash [icon: home, color: yellow, label: "Transport Dashboard"]
    TransRoutes [icon: map, color: yellow, label: "Bus Routes\nManage Routes"]
    TransAlloc [icon: truck, color: yellow, label: "Allocations\nAssign Students"]
}
StaffType > TransDash: "Transport"
TransDash > TransRoutes > TransAlloc

// Generic Staff
GenericStaff [color: purple] {
    GenDash [icon: home, color: purple, label: "Staff Dashboard"]
    GenAtt [icon: check-square, color: purple, label: "My Attendance"]
    GenLeave [icon: file-text, color: purple, label: "Leave Request"]
    GenPay [icon: credit-card, color: purple, label: "Payroll"]
}
StaffType > GenDash: "Generic"
GenDash > GenAtt > GenLeave > GenPay

legend {
    [color: orange, label: "Accountant"]
    [color: green, label: "Librarian"]
    [color: cyan, label: "Receptionist"]
    [color: yellow, label: "Transport"]
    [color: purple, label: "Generic Staff"]
}


// ============================================================
// DIAGRAM 7: SALES DEMO JOURNEY (HIGHLIGHTED)
// The recommended path for a live product demo
// ============================================================

direction down
colorMode bold
styleMode shadow
typeface clean

title "Sales Demo Journey — Recommended Path"

// Phase 1: Platform
P1 [color: blue] {
    Demo1 [shape: oval, icon: user, color: blue, label: "1. Super Admin Login"]
    Demo2 [shape: oval, icon: plus-circle, color: blue, label: "2. Onboard a School\n4-Step Wizard"]
    Demo3 [shape: oval, icon: check-circle, color: blue, label: "3. School Created\nAdmin Account Ready"]
}
Demo1 > Demo2 > Demo3

// Phase 2: Setup
P2 [color: orange] {
    Demo4 [shape: oval, icon: user, color: orange, label: "4. School Admin Login"]
    Demo5 [shape: oval, icon: settings, color: orange, label: "5. Manage School\nSetup Classes & Sections"]
}
Demo3 > Demo4: "handoff"
Demo4 > Demo5

// Phase 3: Admission
P3 [color: teal] {
    Demo6 [shape: oval, icon: phone, color: teal, label: "6. Add Admission Enquiry"]
    Demo7 [shape: oval, icon: check-circle, color: teal, label: "7. Confirm Admission"]
    Demo8 [shape: oval, icon: users, color: teal, label: "8. Create Student Account"]
    Demo9 [shape: oval, icon: user-plus, color: green, label: "9. Onboard Student\nComplete Profile"]
    Demo10 [shape: oval, icon: credit-card, color: green, label: "10. Issue ID Card"]
}
Demo5 > Demo6
Demo6 > Demo7 > Demo8 > Demo9 > Demo10

// Phase 4: Staff
P4 [color: yellow] {
    Demo11 [shape: oval, icon: user-plus, color: yellow, label: "11. Register Teacher"]
    Demo12 [shape: oval, icon: target, color: yellow, label: "12. Assign Teacher\nto Class & Subject"]
}
Demo10 > Demo11
Demo11 > Demo12

// Phase 5: Academics
P5 [color: cyan] {
    Demo13 [shape: oval, icon: calendar, color: cyan, label: "13. Build Timetable"]
    Demo14 [shape: oval, icon: check-square, color: cyan, label: "14. Mark Attendance"]
}
Demo12 > Demo13 > Demo14

// Phase 6: Finance
P6 [color: red] {
    Demo15 [shape: oval, icon: credit-card, color: red, label: "15. Create Fee Structure"]
    Demo16 [shape: oval, icon: credit-card, color: red, label: "16. Generate Invoices"]
    Demo17 [shape: oval, icon: credit-card, color: red, label: "17. Collect Fees\nPrint Receipt"]
}
Demo14 > Demo15 > Demo16 > Demo17

// Phase 7: Exams
P7 [color: purple] {
    Demo18 [shape: oval, icon: clipboard, color: purple, label: "18. Schedule Exam"]
    Demo19 [shape: oval, icon: edit, color: purple, label: "19. Enter Marks"]
    Demo20 [shape: oval, icon: file-text, color: purple, label: "20. Print Report Card"]
}
Demo17 > Demo18 > Demo19 > Demo20

// Phase 8: Wrap up
P8 [color: indigo] {
    Demo21 [shape: oval, icon: mail, color: amber, label: "21. Publish Notice"]
    Demo22 [shape: oval, icon: bar-chart, color: purple, label: "22. View Reports"]
    DemoEND [shape: oval, icon: check-circle, color: green, label: "DEMO COMPLETE"]
}
Demo20 > Demo21 > Demo22 > DemoEND

legend {
    [color: blue, label: "1. Platform"]
    [color: orange, label: "2. Setup"]
    [color: teal, label: "3. Admission"]
    [color: yellow, label: "4. Staff"]
    [color: cyan, label: "5. Academics"]
    [color: red, label: "6. Finance"]
    [color: purple, label: "7. Exams"]
    [color: indigo, label: "8. Wrap Up"]
}


// ============================================================
// DIAGRAM 8: ADMISSION PIPELINE (KANBAN)
// How enquiries flow through the pipeline
// ============================================================

direction right
colorMode pastel
styleMode shadow
typeface clean

title "Admission Pipeline — Kanban Flow"

NewLead [shape: oval, icon: user-plus, color: blue, label: "New Leads\nChild Name\nClass Applied\nParent Phone"]
Contacted [shape: oval, icon: phone, color: orange, label: "Contacted\nFollow-up Done\nDetails Shared"]
CampusVisit [shape: oval, icon: home, color: purple, label: "Campus Visit\nVisit Scheduled\nTour Complete"]
Confirmed [shape: oval, icon: check-circle, color: green, label: "Confirmed\nAdmission Done\nStudent Created"]
Declined [shape: oval, icon: x-circle, color: red, label: "Declined\nNot Interested\nLost Lead"]

NewLead > Contacted: "follow up"
Contacted > CampusVisit: "schedule visit"
CampusVisit > Confirmed: "confirm"
CampusVisit > Declined: "not interested"
Contacted > Declined: "decline"

// What happens after confirmation
Onboard [shape: oval, icon: user-plus, color: green, label: "Students Added\nvia User & Access"]
Profile [shape: oval, icon: user-plus, color: green, label: "Complete Profile\nOnboarding Form"]
ID [shape: oval, icon: credit-card, color: green, label: "ID Card\nPrint & Issue"]
Confirmed > Onboard > Profile > ID

legend {
    [color: blue, label: "New Lead"]
    [color: orange, label: "Contacted"]
    [color: purple, label: "Campus Visit"]
    [color: green, label: "Confirmed"]
    [color: red, label: "Declined"]
}


// ============================================================
// DIAGRAM 9: FEE COLLECTION FLOW
// From structure to receipt
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "Fee Collection Flow"

FeeStructure [shape: oval, icon: settings, color: red, label: "Fee Structure\nDefine per Class\nTuition · Transport · Hostel"]
GenerateInv [shape: oval, icon: file-text, color: red, label: "Generate Invoices\nBulk per Class/Section"]
Invoice [shape: oval, icon: credit-card, color: red, label: "Invoice Created\nStudent-wise"]
FeeStructure > GenerateInv > Invoice

PaymentChoice [shape: diamond, icon: help-circle, color: purple, label: "Payment Mode?"]
Invoice > PaymentChoice

Offline [shape: oval, icon: credit-card, color: orange, label: "Record Payment\nCash / Card / UPI\nNet Banking / Cheque"]
Online [shape: oval, icon: credit-card, color: blue, label: "Razorpay\nOnline Payment Gateway"]
PaymentChoice > Offline: "offline"
PaymentChoice > Online: "online"

Receipt [shape: oval, icon: file-text, color: green, label: "Receipt Generated\nPrint & Share"]
Offline > Receipt
Online > Receipt

Reports [shape: oval, icon: bar-chart, color: purple, label: "Fee Reports\nCollected · Pending · Partial"]
Receipt > Reports

legend {
    [color: red, label: "Fee Setup"]
    [color: orange, label: "Offline Payment"]
    [color: blue, label: "Online Payment"]
    [color: green, label: "Receipt"]
    [color: purple, label: "Reports"]
}


// ============================================================
// DIAGRAM 10: ROLE-BASED ACCESS OVERVIEW
// What each role can access
// ============================================================

direction right
colorMode pastel
styleMode shadow
typeface clean

title "Role-Based Access Overview"

SA [shape: oval, icon: crown, color: blue, label: "Super Admin\nPlatform Owner"]
SCHA [shape: oval, icon: shield, color: orange, label: "School Admin\nAdministrator"]
TCH [shape: oval, icon: graduation-cap, color: green, label: "Teacher\nClass Teacher"]
STF [shape: oval, icon: briefcase, color: purple, label: "Staff\nAccountant · Librarian\nReceptionist · Transport"]
STU [shape: oval, icon: book-open, color: cyan, label: "Student"]

// Super Admin access
SA_Access [color: blue] {
    SA1 [icon: monitor, color: blue, label: "Platform Dashboard"]
    SA2 [icon: plus-circle, color: blue, label: "School Onboarding"]
    SA3 [icon: credit-card, color: blue, label: "Plans & Pricing"]
    SA4 [icon: credit-card, color: blue, label: "Subscriptions"]
    SA5 [icon: file-text, color: blue, label: "Audit Logs"]
}
SA > SA_Access: "access"

// School Admin access
SC_Access [color: orange] {
    SC1 [icon: home, color: orange, label: "All School Modules"]
    SC2 [icon: users, color: orange, label: "Users & Access"]
    SC3 [icon: settings, color: orange, label: "Manage School"]
    SC4 [icon: credit-card, color: orange, label: "Fee Collection"]
}
SCHA > SC_Access: "access"

// Teacher access
T_Access [color: green] {
    T1 [icon: users, color: green, label: "My Class"]
    T2 [icon: check-square, color: green, label: "Mark Attendance"]
    T3 [icon: book, color: green, label: "Homework"]
    T4 [icon: calendar, color: green, label: "Timetable"]
}
TCH > T_Access: "access"

// Staff access
SF_Access [color: purple] {
    SF1 [icon: home, color: purple, label: "Designation Dashboard"]
    SF2 [icon: credit-card, color: purple, label: "Fees / Books / Routes"]
}
STF > SF_Access: "access"

// Student access
SU_Access [color: cyan] {
    SU1 [icon: user, color: cyan, label: "My Profile"]
    SU2 [icon: check-square, color: cyan, label: "My Attendance"]
    SU3 [icon: book, color: cyan, label: "Homework"]
    SU4 [icon: bar-chart, color: cyan, label: "Results"]
    SU5 [icon: credit-card, color: cyan, label: "Fees"]
}
STU > SU_Access: "access"

legend {
    [color: blue, label: "Super Admin"]
    [color: orange, label: "School Admin"]
    [color: green, label: "Teacher"]
    [color: purple, label: "Staff"]
    [color: cyan, label: "Student"]
}


// ============================================================
// DIAGRAM 11: COMPLETE MODULE MAP
// Every module in the system
// ============================================================

direction down
colorMode pastel
styleMode shadow
typeface clean

title "Complete Module Map"

Root [shape: hexagon, color: blue, label: "School Management System"]

// Admissions
Root > ModAdmission [icon: phone, color: teal, label: "Admissions"]
ModAdmission > AE1 [icon: phone, color: teal, label: "Enquiry Pipeline"]
ModAdmission > AE2 [icon: user, color: teal, label: "Counsellor Workspace"]

// Students
Root > ModStudent [icon: users, color: green, label: "Students"]
ModStudent > ST1 [icon: users, color: green, label: "Database"]
ModStudent > ST2 [icon: user-plus, color: green, label: "Onboarding"]
ModStudent > ST3 [icon: credit-card, color: green, label: "ID Card"]

// Staff
Root > ModStaff [icon: user, color: yellow, label: "Staff"]
ModStaff > SF1 [icon: graduation-cap, color: yellow, label: "Teachers"]
ModStaff > SF2 [icon: briefcase, color: yellow, label: "Other Staff"]
ModStaff > SF3 [icon: target, color: yellow, label: "Assignments"]

// Academics
Root > ModAcademic [icon: book, color: cyan, label: "Academics"]
ModAcademic > AC1 [icon: calendar, color: cyan, label: "Timetable"]
ModAcademic > AC2 [icon: check-square, color: cyan, label: "Attendance"]
ModAcademic > AC3 [icon: book, color: cyan, label: "Homework"]
ModAcademic > AC4 [icon: calendar, color: purple, label: "Sessions"]

// Exams
Root > ModExam [icon: clipboard, color: purple, label: "Exams & Marks"]
ModExam > EX1 [icon: clipboard, color: purple, label: "Examinations"]
ModExam > EX2 [icon: edit, color: purple, label: "Marks Entry"]
ModExam > EX3 [icon: file-text, color: purple, label: "Report Card"]
ModExam > EX4 [icon: arrow-up, color: purple, label: "Promotions"]

// Finance
Root > ModFinance [icon: credit-card, color: red, label: "Finance"]
ModFinance > FN1 [icon: credit-card, color: red, label: "Fees Collection"]
ModFinance > FN2 [icon: credit-card, color: red, label: "Online Payment"]
ModFinance > FN3 [icon: credit-card, color: pink, label: "Payroll"]

// Communication
Root > ModComms [icon: mail, color: amber, label: "Communication"]
ModComms > CM1 [icon: mail, color: amber, label: "Notice Board"]
ModComms > CM2 [icon: calendar, color: amber, label: "Events"]

// Operations
Root > ModOps [icon: settings, color: teal, label: "Operations"]
ModOps > OP1 [icon: book, color: teal, label: "Library"]
ModOps > OP2 [icon: truck, color: teal, label: "Transport"]
ModOps > OP3 [icon: home, color: teal, label: "Hostel"]
ModOps > OP4 [icon: package, color: teal, label: "Inventory"]

// HR
Root > ModHR [icon: shield, color: indigo, label: "Human Resources"]
ModHR > HR1 [icon: file-text, color: indigo, label: "Leave"]
ModHR > HR2 [icon: shield, color: indigo, label: "Behavior"]
ModHR > HR3 [icon: star, color: indigo, label: "Achievements"]

// Reports
Root > ModReports [icon: bar-chart, color: purple, label: "Reports"]
ModReports > RP1 [icon: bar-chart, color: purple, label: "Analytics"]
ModReports > RP2 [icon: download, color: purple, label: "CSV Export"]

legend {
    [color: teal, label: "Admissions"]
    [color: green, label: "Students"]
    [color: yellow, label: "Staff"]
    [color: cyan, label: "Academics"]
    [color: purple, label: "Exams & Reports"]
    [color: red, label: "Finance"]
    [color: amber, label: "Communication"]
    [color: teal, label: "Operations"]
    [color: indigo, label: "HR"]
}
