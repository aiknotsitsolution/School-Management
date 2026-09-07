
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SEED_ONLY = process.argv.includes("--seed-only");
const BASE =
  process.env.MONGO_URI || process.env.MONGO_URI_BASE || "mongodb://localhost:27017";

function dbURI(db) {
  try {
    const u = new URL(BASE);
    u.pathname = "/" + db;
    u.search = "";
    return u.toString();
  } catch (e) {
    console.error(`[config] invalid MONGO_URI/MONGO_URI_BASE: ${BASE}`);
    process.exit(1);
  }
}

const DB_FOR = {
  auth: "erp_auth",
  student: "erp_student",
  staff: "erp_staff",
  academic: "erp_academic",
  fee: "erp_fee",
  communication: "erp_communication",
  library: "erp_library",
  facility: "erp_facility",
};

function connect(name) {
  const conn = mongoose.createConnection(dbURI(DB_FOR[name]));
  conn.asPromise().then(() => console.log(`[db] ${name} connected -> ${dbURI(DB_FOR[name])}`));
  const models = {};
  COLLECTIONS[name].forEach((c) => {
    models[c] = conn.model(c, new mongoose.Schema({}, { strict: false }), c);
  });
  return conn.asPromise().then(() => ({ conn, models }));
}

function hash(pass) {
  return bcrypt.hash(pass, 10);
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

const addDays = (IsoDate, n) => {
  const d = new Date(IsoDate);
  d.setDate(d.getDate() + n);
  return d;
};

const ISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const schoolDays = (start, end) => {
  const out = [];
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(d.getTime()));
  }
  return out;
};

const rng = (i, mod) => (i * 17 + 5) % mod;

const COLLECTIONS = {
  auth: ["schools", "users", "plans", "subscriptions", "billinginvoices"],
  student: ["students", "admissionenquiries"],
  staff: ["staffs", "leaves", "payrolls"],
  academic: ["attendances", "exams", "homeworks", "marks", "timetables"],
  fee: ["feestructures", "feeinvoices", "payments"],
  communication: ["notices", "events"],
  library: ["books", "issuerecords"],
  facility: ["busroutes", "hostels", "inventoryitems"],
};

const accounts = []; // credential dump { school, name, email, password, role, designation, class, section }

// ---------------------------------------------------------------------------
// Realistic name pools
// ---------------------------------------------------------------------------
const BOYS = [
  "Aarav Sharma", "Advait Kulkarni", "Aarush Deshmukh", "Dhruv Patel", "Ishaan Iyer",
  "Kabir Khanna", "Kiaan Joshi", "Arjun Nair", "Vihaan Kapoor", "Reyansh Pillai",
  "Shaurya Malhotra", "Yash Bhatt", "Rohan Mehta", "Dev Mishra", "Aryan Desai",
  "Siddharth Rao", "Nakul Kamat", "Tanish Agrawal", "Utkarsh Tiwari", "Parth Saxena",
  "Aditya Chauhan", "Harsh Vora", "Rudra Singh", "Manav Gupta", "Om Sharma",
];
const GIRLS = [
  "Ananya Iyer", "Diya Kapoor", "Saanvi Joshi", "Aarohi Deshmukh", "Myra Bhatt",
  "Pari Malhotra", "Ira Kulkarni", "Navya Shinde", "Aadya Nair", "Anika Rao",
  "Sara Khan", "Kiara Fernandes", "Riya Patil", "Vanya Mishra", "Suhani Agarwal",
  "Tara Menon", "Ishita Bansal", "Avni Trivedi", "Meera Pillai", "Tanvi Mehta",
  "Shanaya Khanna", "Anushka Verma", "Ridhi Jain", "Gauri Deshpande",
];
const SURNAMES = [
  "Sharma", "Mehra", "Kapoor", "Iyer", "Pillai", "Deshmukh", "Patil", "Kulkarni",
  "Joshi", "Malhotra", "Verma", "Bhatt", "Rao", "Mishra", "Desai", "Nair",
  "Chauhan", "Agrawal", "Tiwari", "Saxena", "Jain", "Gupta", "Kamat", "Shinde",
];
const TEACHER_NAMES = [
  "Ms. Kavita Rao", "Mr. Suresh Patil", "Ms. Anjali Desai", "Mr. Rakesh Tiwari",
  "Mr. Nikhil Joshi", "Ms. Meera Nair", "Mr. Vikram Singh", "Ms. Pooja Sharma",
];
const CT_FIRST = [
  { name: "Sneha Iyer", female: true },
  { name: "Vikram Joshi", female: false },
  { name: "Farhan Qureshi", female: false },
];
const DESTAFF = ["admission_counsellor", "accountant", "librarian", "receptionist", "transport"];
const DESTAFF_META = {
  admission_counsellor: { designation: "Admission Counsellor", department: "Admissions", role: "admin-staff" },
  accountant: { designation: "Accountant", department: "Accounts", role: "admin-staff" },
  librarian: { designation: "Librarian", department: "Library", role: "admin-staff" },
  receptionist: { designation: "Receptionist", department: "Front Office", role: "admin-staff" },
  transport: { designation: "Transport Coordinator", department: "Transport", role: "support" },
};

const PERIODS = [
  { subject: "English", teacherName: "Ms. Kavita Rao", startTime: "09:00", endTime: "09:40" },
  { subject: "Maths", teacherName: "Mr. Suresh Patil", startTime: "09:40", endTime: "10:20" },
  { subject: "Break", startTime: "10:20", endTime: "10:35" },
  { subject: "Science", teacherName: "Ms. Anjali Desai", startTime: "10:35", endTime: "11:15" },
  { subject: "Hindi", teacherName: "Mr. Rakesh Tiwari", startTime: "11:15", endTime: "11:55" },
  { subject: "Computer", teacherName: "Mr. Nikhil Joshi", startTime: "11:55", endTime: "12:35" },
  { subject: "Social Science", teacherName: "Ms. Meera Nair", startTime: "12:35", endTime: "13:15" },
  { subject: "PE", teacherName: "Mr. Vikram Singh", startTime: "13:15", endTime: "13:45" },
];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SUBJECTS = ["Maths", "Science", "English", "Hindi", "Social Science", "Computer"];

// ---------------------------------------------------------------------------
// School profiles
// ---------------------------------------------------------------------------
const SCHOOLS = [
  {
    code: "lotus-valley",
    name: "Lotus Valley International School",
    shortName: "LVIS",
    domain: "lotusvalley.edu.in",
    city: "Mumbai",
    address: "12, Lake View Road, Andheri West, Mumbai, Maharashtra 400058",
    phone: "+91 22 4023 8800",
    email: "contact@lotusvalley.edu.in",
    plan: "premium",
    session: "2026-27",
    principal: { name: "Rohit Mehra", email: "principal@lotusvalley.edu.in", pass: "Admin@321" },
    classes: [
      { c: "5", s: "A", n: 24 },
      { c: "6", s: "A", n: 18 },
      { c: "7", s: "A", n: 15 },
    ],
    routeStops: [
      { name: "Andheri Station", time: "07:20" },
      { name: "Lokhandwala Market", time: "07:35" },
      { name: "Four Bungalows", time: "07:45" },
      { name: "Versova Bridge", time: "07:55" },
    ],
  },
  {
    code: "greenwood",
    name: "Greenwood Public School",
    shortName: "GPS",
    domain: "greenwood.ac.in",
    city: "Indore",
    address: "45, Vijay Nagar, Indore, Madhya Pradesh 452010",
    phone: "+91 731 402 5566",
    email: "contact@greenwood.ac.in",
    plan: "standard",
    session: "2026-27",
    principal: { name: "Meenakshi Raghavan", email: "principal@greenwood.ac.in", pass: "Admin@321" },
    classes: [
      { c: "5", s: "A", n: 24 },
      { c: "6", s: "A", n: 18 },
      { c: "7", s: "A", n: 15 },
    ],
    routeStops: [
      { name: "Vijay Nagar Square", time: "07:25" },
      { name: "Sapna Sangeeta", time: "07:40" },
      { name: "Palasia Square", time: "07:55" },
      { name: "Rajwada Gate", time: "08:10" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Wipe (default) — everything except super_admin platform owner
// ---------------------------------------------------------------------------
async function wipe(m) {
  console.log("\n[wipe] clearing all service collections…");
  const removed = await m.auth.models.users.deleteMany({ role: { $ne: "super_admin" } });
  await m.auth.models.schools.deleteMany({});
  await m.auth.models.plans.deleteMany({});
  await m.auth.models.subscriptions.deleteMany({});
  await m.auth.models.billinginvoices.deleteMany({});
  let killed = 5;
  const dropIndexes = async (svc, coll) => {
    try {
      await m[svc].models[coll].collection.dropIndexes();
    } catch (e) {
      if (!/ns not found|index not found/i.test(String(e.message))) throw e;
    }
  };
  // Legacy unique indexes (e.g. standalone student admissionNo / attendance
  // studentId+date) survive deleteMany and would block cross-school inserts.
  // Dropped here; the running services rebuild their schema indexes on restart.
  for (const name of ["student", "staff", "academic", "fee", "communication", "library", "facility"]) {
    for (const c of COLLECTIONS[name]) {
      await m[name].models[c].deleteMany({});
      await dropIndexes(name, c);
    }
    killed++;
  }
  console.log(`[wipe] done (kept super_admin users, cleared ${killed} collections, removed ${removed.deletedCount} users).`);
}

// ---------------------------------------------------------------------------
// Seed one school + all its domain data
// ---------------------------------------------------------------------------
async function seedSchool(school, m) {
  const tag = school.code;
  console.log(`\n=== ${school.name} (${school.code}) ===`);
  const counts = {};

  // -- School ---------------------------------------------------------------
  const schoolDoc = await m.auth.models.schools.findOneAndUpdate(
    { code: school.code },
    { $set: {
        name: school.name, shortName: school.shortName, code: school.code,
        address: school.address, city: school.city, phone: school.phone,
        email: school.email, session: school.session, plan: school.plan,
        status: "active", settings: { board: "CBSE", medium: "English" },
      } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const schoolId = schoolDoc._id;
  counts.schools = 1;

  // -- School admin (principal) ----------------------------------------------
  const adminPass = await hash(school.principal.pass);
  const adminUser = await m.auth.models.users.findOneAndUpdate(
    { email: school.principal.email.toLowerCase() },
    { $set: {
        name: school.principal.name, email: school.principal.email.toLowerCase(),
        password: adminPass, role: "school_admin", schoolId, isActive: true,
      } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  counts.admins = 1;
  accounts.push({ school: school.code, name: school.principal.name, email: school.principal.email.toLowerCase(), password: school.principal.pass, role: "school_admin" });

  // -- Class teachers + staff (create Staff docs first, then users) ----------
  const staffDocs = [];
  const staffUserKeys = []; // { key, user }
  for (let ci = 0; ci < school.classes.length; ci++) {
    const { c, s } = school.classes[ci];
    const ct = CT_FIRST[ci % CT_FIRST.length];
    const email = `ct-${c}${s}@${school.domain}`.toLowerCase();
    const staffDoc = await m.staff.models.staffs.findOneAndUpdate(
      { schoolId, employeeId: `T-${c}${s}-${tag}` },
      { $set: {
          schoolId,
          employeeId: `T-${c}${s}-${tag}`,
          name: ct.name,
          designation: `Teacher - Class ${c}-${s}`,
          department: "Academics",
          role: "teacher",
          subjects: [SUBJECTS[ci % SUBJECTS.length], SUBJECTS[(ci + 2) % SUBJECTS.length]],
          classesAssigned: [{ class: c, section: s }],
          qualification: "B.Ed., M.A.",
          joiningDate: new Date("2024-06-10"),
          contact: `+91 9820 0${40000 + ci * 1111}`,
          email,
          salary: 42000,
          status: "Active",
        } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    staffDocs.push(staffDoc);
    staffUserKeys.push({ key: `ct-${c}${s}`, email, user: await m.auth.models.users.findOneAndUpdate(
      { email },
      { $set: { name: ct.name, email, password: await hash("Teacher@123"), role: "class_teacher", schoolId, class: c, section: s, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )});
    accounts.push({ school: school.code, name: ct.name, email, password: "Teacher@123", role: "class_teacher", class: c, section: s });
  }

  const destaffNames = {
    admission_counsellor: "Priyanka Khatri",
    accountant: "Nilesh Agarwal",
    librarian: "Sneha Kulkarni",
    receptionist: "Ritu Sharma",
    transport: "Sanjay Rane",
  };
  for (const des of DESTAFF) {
    const meta = DESTAFF_META[des];
    const baseEmail = `${des.replace("_", "")}@${school.domain}`;
    const staffDoc = await m.staff.models.staffs.findOneAndUpdate(
      { schoolId, employeeId: `${des}-${tag}` },
      { $set: {
          schoolId,
          employeeId: `${des}-${tag}`,
          name: destaffNames[des],
          designation: meta.designation,
          department: meta.department,
          role: meta.role,
          joiningDate: new Date("2023-09-01"),
          contact: `+91 9820 0${50000 + rng(staffDocs.length, 9000)}`,
          email: baseEmail,
          salary: des === "accountant" ? 36000 : 30000,
          status: "Active",
        } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    staffDocs.push(staffDoc);
    const user = await m.auth.models.users.findOneAndUpdate(
      { email: baseEmail },
      { $set: { name: destaffNames[des], email: baseEmail, password: await hash("Staff@123"), role: "staff", designation: des, schoolId, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    staffUserKeys.push({ key: des, email: baseEmail, user });
    accounts.push({ school: school.code, name: destaffNames[des], email: baseEmail, password: "Staff@123", role: "staff", designation: des });
  }

  // link staff.userId + user.refId
  for (const { user, email } of staffUserKeys) {
    const doc = staffDocs.find((s) => String(s.email) === email);
    if (doc) {
      await m.staff.models.staffs.updateOne({ _id: doc._id }, { $set: { userId: String(user._id) } });
      await m.auth.models.users.updateOne({ _id: user._id }, { $set: { refId: String(doc._id) } });
    }
  }
  counts.staff = staffDocs.length;

  // -- Students ----------------------------------------------------------------
  const studentsByKey = {}; // key c+s+pad3 -> student doc
  const studentDocs = [];
  for (const cls of school.classes) {
    const names = [];
    for (let i = 0; i < cls.n; i++) {
      names.push(i % 2 === 0 ? BOYS[i % BOYS.length] : GIRLS[i % GIRLS.length]);
    }
    for (let i = 0; i < cls.n; i++) {
      const name = names[i];
      const admissionNo = `STU-${cls.c}${cls.s}-${pad3(i + 1)}`;
      const existingStu = await m.student.models.students.findOne({ schoolId, admissionNo });
      if (existingStu) {
        studentsByKey[`${cls.c}${cls.s}-${pad3(i + 1)}`] = existingStu;
        studentDocs.push(existingStu);
        continue;
      }
      const stu = await m.student.models.students.create({
        schoolId, admissionNo, name,
        dob: new Date(`${2015 - (Number(cls.c) - 5)}-${pad3(((i * 3) % 12) + 1)}-${pad3(((i * 7) % 27) + 1)}`),
        gender: i % 2 === 0 ? "Male" : "Female",
        class: cls.c, section: cls.s, rollNo: String(i + 1),
        bloodGroup: ["O+", "A+", "B+", "AB+", "O-", "B-"][i % 6],
        address: `${100 + i * 7}, ${school.city}`,
        parentName: `${name.split(" ").pop()} ${name.split(" ")[0]}`,
        parentContact: `+91 98${pad3(((i * 17 + 100) % 999))}${pad3(((i * 31 + 200) % 999))}`,
        parentEmail: `parent.${name.split(" ")[0].toLowerCase()}@${school.domain}`,
        admissionDate: new Date(`2026-06-${pad3(1 + ((i * 3) % 28))}`),
        feeCategory: "Regular", status: "Active",
      });
      studentsByKey[`${cls.c}${cls.s}-${pad3(i + 1)}`] = stu;
      studentDocs.push(stu);
    }
  }
  counts.students = studentDocs.length;

  // student users (4 in the first class + 2 more from later classes); emails must
  // be unique, so skip any name whose derived email is already used.
  const studentUserSlots = [];
  const usedStuEmails = new Set();
  for (const stu of studentDocs) {
    if (studentUserSlots.length >= 6) break;
    const email = `${stu.name.split(" ")[0].toLowerCase()}.${stu.name.split(" ")[1].toLowerCase()}@${school.domain}`;
    if (usedStuEmails.has(email)) continue;
    usedStuEmails.add(email);
    studentUserSlots.push({ stu, email });
  }
  for (const slot of studentUserSlots) {
    if (!slot) continue;
    const { stu, email } = slot;
    const user = await m.auth.models.users.findOneAndUpdate(
      { email },
      { $set: { name: stu.name, email, password: await hash("Student@123"), role: "student", schoolId, class: stu.class, section: stu.section, refId: stu.admissionNo, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    await m.student.models.students.updateOne({ _id: stu._id }, { $set: { userId: String(user._id) } });
    accounts.push({ school: school.code, name: stu.name, email, password: "Student@123", role: "student", class: stu.class, section: stu.section, admissionNo: stu.admissionNo });
  }
  counts.studentUsers = studentUserSlots.filter(Boolean).length;

  // -- Attendance (11 working days Aug 24 → Sep 7 2026) --------------------------
  const attDays = schoolDays("2026-08-24", "2026-09-07");
  const attBulk = [];
  for (const cls of school.classes) {
    const classStudents = studentDocs.filter((s) => s.class === cls.c && s.section === cls.s);
    attDays.forEach((day, di) => {
      classStudents.forEach((stu, si) => {
        const r = (si * 7 + di * 5 + Number(cls.c)) % 23;
        const status = r === 0 ? "Absent" : r === 1 ? "Late" : r === 2 ? "Half Day" : r === 3 ? "Leave" : "Present";
        attBulk.push({ schoolId, studentId: stu.admissionNo, class: cls.c, section: cls.s, date: day, status, markedBy: `ct-${cls.c}${cls.s}` });
      });
    });
  }
  await m.academic.models.attendances.insertMany(attBulk, { ordered: false });
  counts.attendance = attBulk.length;

  // -- Timetable -----------------------------------------------------------------
  for (const cls of school.classes) {
    for (const day of WEEKDAYS) {
      await m.academic.models.timetables.create({
        schoolId, class: cls.c, section: cls.s, day, periods: PERIODS,
      });
    }
  }
  counts.timetable = school.classes.length * WEEKDAYS.length;

  // -- Homework ------------------------------------------------------------------
  const hw = [
    { subject: "Maths", title: "Fractions worksheet — Q1 to Q15", description: "Solve Exercise 7.2 from the textbook. Show working steps.", assignedBy: "Sneha Iyer", assignedDate: new Date("2026-09-03"), dueDate: new Date("2026-09-12") },
    { subject: "Science", title: "Plants & their parts — diagram", description: "Draw and label the parts of a flowering plant.", assignedBy: "Sneha Iyer", assignedDate: new Date("2026-09-04"), dueDate: new Date("2026-09-15") },
    { subject: "English", title: "Essay: My Dream School", description: "Write 250 words about your dream school.", assignedBy: "Sneha Iyer", assignedDate: new Date("2026-09-05"), dueDate: new Date("2026-09-18") },
    { subject: "Hindi", title: "पौराणिक कथा — सारांश", description: "Write a summary of the story taught in class.", assignedBy: "Sneha Iyer", assignedDate: new Date("2026-09-06"), dueDate: new Date("2026-09-22") },
  ];
  for (const cls of school.classes) {
    for (const it of hw) {
      await m.academic.models.homeworks.create({ schoolId, class: cls.c, section: cls.s, ...it });
    }
  }
  counts.homework = school.classes.length * hw.length;

  // -- Exams (Term 1 past + Mid Term upcoming) for first class -------------------
  const first = school.classes[0];
  const exams = [];
  const term1 = [
    { subject: "Maths", date: "2026-08-20" },
    { subject: "Science", date: "2026-08-22" },
    { subject: "English", date: "2026-08-24" },
    { subject: "Hindi", date: "2026-08-26" },
    { subject: "Social Science", date: "2026-08-27" },
    { subject: "Computer", date: "2026-08-29" },
  ];
  for (const ex of term1) {
    exams.push(await m.academic.models.exams.create({
      schoolId, examName: "Term 1", class: first.c, subject: ex.subject, date: new Date(ex.date), startTime: "09:00", endTime: "11:30", room: "Hall B", maxMarks: 100, passingMarks: 33,
    }));
  }
  const midterm = [
    { subject: "Maths", date: "2026-09-21" },
    { subject: "Science", date: "2026-09-23" },
  ];
  for (const ex of midterm) {
    exams.push(await m.academic.models.exams.create({
      schoolId, examName: "Mid Term", class: first.c, subject: ex.subject, date: new Date(ex.date), startTime: "09:00", endTime: "10:30", room: "Room 12", maxMarks: 100, passingMarks: 33,
    }));
  }
  counts.exams = exams.length;

  // -- Marks (Term 1) --------------------------------------------------------------
  const marksBulk = [];
  const term1Exams = exams.filter((e) => e.examName === "Term 1");
  const classStudents = studentDocs.filter((s) => s.class === first.c && s.section === first.s);
  term1Exams.forEach((ex, ei) => {
    classStudents.forEach((stu, si) => {
      const obtained = 38 + ((si * 7 + ei * 13 + Number(first.c)) % 61);
      const pct = obtained / 100;
      const grade = pct >= 0.9 ? "A+" : pct >= 0.8 ? "A" : pct >= 0.7 ? "B+" : pct >= 0.6 ? "B" : pct >= 0.5 ? "C" : pct >= 0.33 ? "D" : "F";
      marksBulk.push({ schoolId, studentId: stu.admissionNo, examId: ex._id, examName: ex.examName, class: first.c, subject: ex.subject, marksObtained: obtained, maxMarks: 100, grade, remarks: "Satisfactory" });
    });
  });
  await m.academic.models.marks.insertMany(marksBulk, { ordered: false });
  counts.marks = marksBulk.length;

  // -- Fees ------------------------------------------------------------------------
  for (const cls of school.classes) {
    for (const [feeType, amount, frequency] of [
      ["Tuition", 9500, "Monthly"],
      ["Transport", 15000, "Annually"],
      ["Exam", 700, "One-time"],
      ["SmartClass", 6500, "One-time"],
    ]) {
      await m.fee.models.feestructures.create({
        schoolId, class: cls.c, session: school.session, feeType, amount, frequency,
        dueDate: new Date("2026-10-05"),
      });
    }
  }
  counts.feeStructures = school.classes.length * 4;

  const invoiceBulk = [];
  const paymentBulk = [];
  let rc = 0;
  for (const stu of studentDocs) {
    const paid = rng(stu.rollNo ? Number(stu.rollNo) : 1, 3);
    const payStatus = paid === 0 ? "Unpaid" : paid === 1 ? "Paid" : "Partial";
    invoiceBulk.push({
      schoolId, studentId: stu.admissionNo, class: stu.class, feeType: "Tuition",
      session: school.session, amount: 85500, paidAmount: payStatus === "Paid" ? 85500 : payStatus === "Partial" ? 47500 : 0,
      dueDate: new Date("2026-10-05"), status: payStatus, receiptNo: payStatus !== "Unpaid" ? `RCP-${school.shortName}-${String(++rc).padStart(4, "0")}` : undefined,
    });
    if (payStatus === "Paid" || payStatus === "Partial") {
      paymentBulk.push({
        schoolId, studentId: stu.admissionNo, amount: payStatus === "Paid" ? 85500 : 47500,
        mode: ["UPI", "Net Banking", "Card"][rng(Number(stu.rollNo || 1), 3)],
        transactionId: `TXN${school.shortName}${String(rc * 100 + 1)}`,
        receiptNo: `RCP-${school.shortName}-${String(rc).padStart(4, "0")}`,
        paidOn: new Date("2026-07-08"), collectedBy: "accounts",
      });
    }
    const tPaid = rng(Number(stu.rollNo || 1) + 1, 2);
    invoiceBulk.push({
      schoolId, studentId: stu.admissionNo, class: stu.class, feeType: "Transport",
      session: school.session, amount: 15000, paidAmount: tPaid === 0 ? 15000 : 0,
      dueDate: new Date("2026-10-15"), status: tPaid === 0 ? "Paid" : "Unpaid",
      receiptNo: tPaid === 0 ? `RCP-${school.shortName}-${String(++rc).padStart(4, "0")}` : undefined,
    });
    if (tPaid === 0) {
      paymentBulk.push({
        schoolId, studentId: stu.admissionNo, amount: 15000, mode: "Cash",
        transactionId: null, receiptNo: `RCP-${school.shortName}-${String(rc).padStart(4, "0")}`, paidOn: new Date("2026-07-10"), collectedBy: "accounts",
      });
    }
    invoiceBulk.push({
      schoolId, studentId: stu.admissionNo, class: stu.class, feeType: "Exam",
      session: school.session, amount: 700, paidAmount: 700, dueDate: new Date("2026-08-15"),
      status: "Paid", receiptNo: `RCP-${school.shortName}-${String(++rc).padStart(4, "0")}`,
    });
    paymentBulk.push({
      schoolId, studentId: stu.admissionNo, amount: 700, mode: "UPI",
      transactionId: `TXN${school.shortName}${String(rc * 3 + 1)}`,
      receiptNo: `RCP-${school.shortName}-${String(rc).padStart(4, "0")}`, paidOn: new Date("2026-08-10"), collectedBy: "accounts",
    });
  }
  await m.fee.models.feeinvoices.insertMany(invoiceBulk, { ordered: false });
  await m.fee.models.payments.insertMany(paymentBulk, { ordered: false });
  counts.fees = invoiceBulk.length;
  counts.payments = paymentBulk.length;

  // -- Payroll -----------------------------------------------------------------------
  const payrollBulk = [];
  for (const st of staffDocs) {
    for (let mOff = 2; mOff >= 0; mOff--) {
      const d = new Date(2026, 8 - mOff, 1);
      const monthName = d.toLocaleString("en", { month: "long" });
      const paid = mOff > 0;
      payrollBulk.push({
        schoolId, staffId: st._id, month: monthName, year: 2026,
        basic: st.salary, allowances: 12000, deductions: 4000,
        netPay: st.salary + 12000 - 4000,
        status: paid ? "Paid" : "Pending",
        paidOn: paid ? new Date(2026, 8 - mOff, 28) : null,
      });
    }
  }
  await m.staff.models.payrolls.insertMany(payrollBulk, { ordered: false });
  counts.payroll = payrollBulk.length;

  // -- Leaves --------------------------------------------------------------------------
  const leaves = [
    { staff: "ct-5A", leaveType: "Casual", from: "2026-09-14", to: "2026-09-15", reason: "Annual medical check-up", status: "Pending", approvedBy: school.principal.name },
    { staff: "accountant", leaveType: "Sick", from: "2026-09-09", to: "2026-09-10", reason: "Viral fever", status: "Approved", approvedBy: school.principal.name },
    { staff: "receptionist", leaveType: "Casual", from: "2026-09-25", to: "2026-09-25", reason: "Family function", status: "Approved", approvedBy: school.principal.name },
    { staff: "librarian", leaveType: "Earned", from: "2026-09-28", to: "2026-09-30", reason: "Vacation planned", status: "Rejected", approvedBy: school.principal.name },
  ];
  const staffKeyToId = {};
  staffUserKeys.forEach((k) => { staffKeyToId[k.key] = k.user; });
  const staffEmailToId = {};
  staffDocs.forEach((s) => { staffEmailToId[s.email] = s._id; });
  for (const l of leaves) {
    const email = `${l.staff.startsWith("ct-") ? l.staff : l.staff.replace("_", "")}@${school.domain}`;
    const staffId = staffEmailToId[email];
    if (staffId) {
      await m.staff.models.leaves.create({
        schoolId, staffId, leaveType: l.leaveType, fromDate: new Date(l.from), toDate: new Date(l.to),
        reason: l.reason, status: l.status, approvedBy: l.approvedBy,
      });
    }
  }
  counts.leaves = leaves.length;

  // -- Library -------------------------------------------------------------------------
  const booksData = [
    ["978-93-272-1001", "Charlotte's Web", "E. B. White", "Fiction", 4],
    ["978-93-272-1002", "The Jungle Book", "Rudyard Kipling", "Fiction", 3],
    ["978-93-272-1003", "Panchtantra Stories", "Vishnu Sharma", "Mythology", 5],
    ["978-93-272-1004", "Malala's Magic Pencil", "Malala Yousafzai", "Biography", 2],
    ["978-93-272-1005", "Harry Potter and the Philosopher's Stone", "J. K. Rowling", "Fiction", 6],
    ["978-93-272-1006", "Wonder", "R. J. Palacio", "Fiction", 4],
    ["978-93-272-1007", "The Secret of the Old Clock", "Carolyn Keene", "Mystery", 3],
    ["978-93-272-1008", "A Brief History of Time", "Stephen Hawking", "Science", 2],
  ];
  const bookIds = [];
  for (const [isbn, title, author, category, copies] of booksData) {
    const b = await m.library.models.books.findOneAndUpdate(
      { schoolId, isbn },
      { $set: { schoolId, isbn, title, author, category, totalCopies: copies, availableCopies: copies } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    bookIds.push(b._id);
  }
  counts.books = bookIds.length;
  const issues = [
    { adm: "STU-5A-001", book: 0, due: "2026-09-20", status: "Issued" },
    { adm: "STU-5A-003", book: 4, due: "2026-09-27", status: "Issued" },
    { adm: "STU-5A-002", book: 2, due: "2026-08-30", status: "Returned", returnDate: "2026-09-02" },
  ];
  for (const iss of issues) {
    const b = bookIds[iss.book];
    await m.library.models.issuerecords.create({
      schoolId, bookId: b, borrowerId: iss.adm, borrowerType: "student",
      issueDate: new Date("2026-09-01"), dueDate: new Date(iss.due),
      returnDate: iss.returnDate ? new Date(iss.returnDate) : null,
      fine: 0, status: iss.status,
    });
  }
  counts.issues = issues.length;

  // -- Transport ------------------------------------------------------------------------
  for (const [routeNo, clsFilter] of [
    [`R-${first.s}-01`, (s) => s.class === first.c && s.section === first.s],
    [`R-${school.classes[1].s}-02`, (s) => s.class === school.classes[1].c && s.section === school.classes[1].s],
  ]) {
    const riders = studentDocs.filter(clsFilter).map((s) => s.admissionNo);
    await m.facility.models.busroutes.create({
      schoolId, routeNo,
      driverName: `Driver ${routeNo.split("-")[1]}`, driverContact: `+91 98 7654 2${pad3(100 + riders.length)}`,
      vehicleNo: `MH ${school.code === "greenwood" ? "09" : "02"} XY 12${pad3(riders.length % 100)}`,
      stops: school.routeStops,
      assignedStudents: riders,
    });
  }
  counts.routes = 2;

  // -- Hostel -----------------------------------------------------------------------------
  const hostelStudents = studentDocs.filter((s) => (s.class === "6" || s.class === "7"));
  const roomBoys = hostelStudents.filter((s) => s.gender === "Male").slice(0, 3);
  const roomGirls = hostelStudents.filter((s) => s.gender === "Female").slice(0, 3);
  await m.facility.models.hostels.create({ schoolId, roomNo: "B-101", block: "Bhagirath", floor: 1, wing: "Boys", capacity: 6, occupants: roomBoys.map((s) => s.admissionNo), warden: "Mr. D. K. Yadav" });
  await m.facility.models.hostels.create({ schoolId, roomNo: "G-204", block: "Ganga", floor: 2, wing: "Girls", capacity: 6, occupants: roomGirls.map((s) => s.admissionNo), warden: "Ms. S. Verma" });
  counts.hostel = 2;

  // -- Inventory -----------------------------------------------------------------------------
  const inventory = [
    ["A4 Paper Ream", "Stationery", 120, 20, "ream", "Campus Stationers"],
    ["Whiteboard Markers", "Stationery", 80, 15, "pcs", "Campus Stationers"],
    ["Football", "Sports", 12, 4, "pcs", "Sportsworld"],
    ["Cricket Bat", "Sports", 8, 2, "pcs", "Sportsworld"],
    ["Lab Beakers 250ml", "Lab", 60, 10, "pcs", "SciLab Supplies"],
    ["LED Bulbs", "Maintenance", 30, 8, "pcs", "ElectroMart"],
  ];
  for (const [itemName, category, quantity, reorderLevel, unit, supplier] of inventory) {
    await m.facility.models.inventoryitems.create({ schoolId, itemName, category, quantity, reorderLevel, unit, supplier, purchaseDate: new Date("2026-06-20") });
  }
  counts.inventory = inventory.length;

  // -- Notices & Events ------------------------------------------------------------------------
  const notices = [
    { title: "Mid Term Examinations announced", description: "Mid Term exams start from 21 September. Check the schedule on the notice board.", category: "Academic", audience: ["student", "class_teacher"], pinned: true },
    { title: "Uniform reminder", description: "Full winter uniform is compulsory from 15 October. Blazers will be available in the school store.", category: "General", audience: ["student"] },
    { title: "Staff meeting — September", description: "All staff to attend the monthly review meeting on 12 September at 4 PM in the conference hall.", category: "Meeting", audience: ["staff"], pinned: true },
    { title: "Scholarship forms available", description: "Merit-cum-means scholarship forms are available at the accounts office till 20 September.", category: "Academic", audience: ["student"] },
  ];
  for (const n of notices) {
    await m.communication.models.notices.create({ schoolId, title: n.title, description: n.description, category: n.category, pinned: n.pinned || false, audience: n.audience, postedBy: school.principal.name });
  }
  const events = [
    { title: "Parent-Teacher Meeting", description: "Term 1 progress reviews with class teachers.", category: "Academic", date: new Date("2026-09-26"), time: "10:00 AM - 02:00 PM", venue: "Block C Classrooms", audience: ["all"] },
    { title: "Annual Sports Day", description: "Inter-house athletics, races and march-past. Parents welcome.", category: "Sports", date: new Date("2026-10-02"), time: "09:00 AM - 01:00 PM", venue: "School Ground", audience: ["all"] },
    { title: "Annual Day & Cultural Night", description: "Dramatics, music and dance by students of all grades.", category: "Cultural", date: new Date("2026-11-14"), time: "06:00 PM - 09:30 PM", venue: "Main Auditorium", audience: ["all"] },
  ];
  for (const e of events) {
    await m.communication.models.events.create({ schoolId, title: e.title, description: e.description, category: e.category, date: e.date, time: e.time, venue: e.venue, audience: e.audience, createdBy: school.principal.name });
  }
  counts.notices = notices.length;
  counts.events = events.length;

  // -- Admission enquiries -----------------------------------------------------------------------
  const enquiries = [
    { childName: "Aanya Gupta", parentName: "Rohit Gupta", classApplied: "1", contact: "+91 90000 11111", email: "rgupta@example.com", source: "Website", status: "New" },
    { childName: "Vivaan Kohli", parentName: "Sanjay Kohli", classApplied: "3", contact: "+91 90000 22222", email: "skohli@example.com", source: "Referral", status: "Contacted", followUpDate: new Date("2026-09-15") },
    { childName: "Mira Nawathe", parentName: "Aditya Nawathe", classApplied: "5", contact: "+91 90000 33333", email: "anawathe@example.com", source: "Walk-in", status: "Campus Visit Scheduled", followUpDate: new Date("2026-09-18") },
    { childName: "Krishan Pal", parentName: "Devendra Pal", classApplied: "6", contact: "+91 90000 44444", email: "dpal@example.com", source: "Phone", status: "Admitted" },
    { childName: "Sai Bapat", parentName: "Ninad Bapat", classApplied: "2", contact: "+91 90000 55555", email: "nbapat@example.com", source: "Other", status: "Rejected", notes: "Travelling distance too far." },
  ];
  for (const q of enquiries) {
    await m.student.models.admissionenquiries.create({ schoolId, ...q });
  }
  counts.enquiries = enquiries.length;

  console.log(`  seeded: ${JSON.stringify(counts)}`);
}

// ---------------------------------------------------------------------------
// Platform billing defaults: plans, one current subscription per school, and a
// sample invoice. Idempotent — mirrors auth-service ensureBillingDefaults.
// ---------------------------------------------------------------------------
const BILLING_PLANS = [
  {
    name: "Trial", code: "trial", description: "Free trial to explore the platform",
    price: 0, currency: "INR", billingCycle: "monthly", trialDays: 14,
    features: ["Up to 50 students", "Core modules", "Email support"],
    limits: { students: 50, staff: 10, teachers: 5, adminUsers: 2, branches: 1, storageGB: 5 },
    isActive: true, isPublic: true, sortOrder: 1,
  },
  {
    name: "Basic", code: "basic", description: "For growing schools",
    price: 999, currency: "INR", billingCycle: "monthly", trialDays: 14,
    features: ["Up to 500 students", "All core modules", "1 branch", "Standard support"],
    limits: { students: 500, staff: 60, teachers: 40, adminUsers: 5, branches: 1, storageGB: 50 },
    isActive: true, isPublic: true, sortOrder: 2,
  },
  {
    name: "Standard", code: "standard", description: "For established schools (multi-branch)",
    price: 2499, currency: "INR", billingCycle: "monthly", trialDays: 14,
    features: ["Up to 2,000 students", "All core modules", "Up to 3 branches", "Priority support"],
    limits: { students: 2000, staff: 250, teachers: 150, adminUsers: 10, branches: 3, storageGB: 200 },
    isActive: true, isPublic: true, sortOrder: 3,
  },
  {
    name: "Premium", code: "premium", description: "For large institutions & chains",
    price: 4999, currency: "INR", billingCycle: "monthly", trialDays: 14,
    features: ["Unlimited students", "All modules + event/transport", "Unlimited branches", "Dedicated success manager"],
    limits: { students: null, staff: null, teachers: null, adminUsers: null, branches: null, storageGB: null },
    isActive: true, isPublic: true, sortOrder: 4,
  },
];

async function seedBilling(m) {
  console.log("\n=== Platform Billing (plans / subscriptions / invoices) ===");
  const planDocs = {};
  for (const plan of BILLING_PLANS) {
    await m.auth.models.plans.updateOne(
      { code: plan.code },
      { $setOnInsert: plan },
      { upsert: true, setDefaultsOnInsert: true, new: true },
    );
    planDocs[plan.code] = await m.auth.models.plans.findOne({ code: plan.code }).lean();
  }

  const schools = await m.auth.models.schools.find({}).lean();
  let createdSubs = 0;
  let createdInvoices = 0;
  for (const school of schools) {
    const plan = planDocs[school.plan] || planDocs.trial;
    if (!plan) continue;
    const existing = await m.auth.models.subscriptions
      .findOne({ schoolId: school._id, status: { $in: ["trialing", "active", "past_due"] } })
      .lean();
    if (existing) continue;

    const start = new Date();
    const trialEnd = addDays(start, plan.trialDays || 0);
    const sub = await m.auth.models.subscriptions.create({
      schoolId: school._id,
      planId: plan._id,
      status: plan.trialDays > 0 ? "trialing" : "active",
      startDate: start,
      trialStartDate: plan.trialDays > 0 ? start : null,
      trialEndDate: plan.trialDays > 0 ? trialEnd : null,
      currentPeriodStart: start,
      currentPeriodEnd: trialEnd,
      nextBillingDate: trialEnd,
      billingCycle: plan.billingCycle,
      price: plan.price,
      currency: plan.currency,
      metadata: { source: "seed-full" },
    });
    createdSubs++;

    const inv = await m.auth.models.billinginvoices.create({
      invoiceNumber: `INV-${start.getUTCFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      schoolId: school._id,
      subscriptionId: sub._id,
      amount: plan.price || 0,
      currency: plan.currency,
      status: "issued",
      periodStart: start,
      periodEnd: trialEnd,
      dueDate: addDays(new Date(), 7),
    });
    if (inv) createdInvoices++;
  }
  console.log(`[billing] ${Object.keys(planDocs).length} plans, ${createdSubs} subscriptions, ${createdInvoices} invoices`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // connect to everything first
  await Promise.all(
    Object.keys(COLLECTIONS).map(async (name) => { m[name] = await connect(name); }),
  );

  if (!SEED_ONLY) await wipe(m);

  // platform owner (super_admin) — never deleted; create only if missing
  let platform = await m.auth.models.users.findOne({ role: "super_admin" });
  if (!platform) {
    const pass = await hash("Administrator@321");
    platform = await m.auth.models.users.create({
      name: "Aiknotsit Admin", email: "administrator@aiknotsit.com", password: pass,
      role: "super_admin", isActive: true,
    });
    console.log("[platform] created administrator@aiknotsit.com");
  } else {
    console.log(`[platform] kept existing super_admin: ${platform.email}`);
  }
  accounts.push({ school: "Platform", name: platform.name || "Platform Admin", email: platform.email, password: "Administrator@321", role: "super_admin", note: "password unchanged if pre-existing" });

  for (const school of SCHOOLS) await seedSchool(school, m);

  await seedBilling(m);

  // dump credentials
  const outPath = path.join(__dirname, "seed-accounts.json");
  fs.writeFileSync(outPath, JSON.stringify(accounts, null, 2));
  console.log(`\n[seed] accounts saved to ${path.relative(process.cwd(), outPath)}`);
  console.log("\n===================== LOGIN CREDENTIALS =====================");
  console.table(accounts.map((a) => ({ School: a.school, Role: a.role, "Designation": a.designation || a.class && `${a.class}-${a.section}` || "—", Email: a.email, Password: a.password })));
  console.log("\n[seed] DONE ✔");
  await Promise.all(Object.keys(COLLECTIONS).map((k) => m[k].conn.close()));
  process.exit(0);
}

const m = {};
main().catch(async (err) => {
  console.error("\n[seed] FAILED:", err.message);
  console.error(err.stack?.split("\n").slice(0, 4).join("\n"));
  process.exit(1);
});