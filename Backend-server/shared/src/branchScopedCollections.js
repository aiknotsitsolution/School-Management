// Single source of truth for which MongoDB collections become branch-scoped.
//
// Every service owns its own database, so there is no cross-service join to lean
// on: `auth-service` owns the Branch documents and the other services store a
// plain `branchId` ObjectId. This map is what scripts/backfill-branches.js
// stamps, what scripts/backup-before-branch-backfill.js dumps, and what
// `withBranchScope()` filters once BRANCH_SCOPE is on.
//
// Keys are database names; values are the Mongoose collection names inside them.
// A collection listed here MUST have a `branchId` field on its schema, and
// scripts/audit-branch-models.js enforces that.
//
// Deliberately ABSENT (one-per-school, shared by every campus), matching the
// school-wide masters in shared/src/master-data:
//   examtypes, gradingscales, coscholastics  - assessment policy, not a campus thing
//   notices, events                          - the whole school must read these
//   books, digitalbooks                      - one school library catalogue;
//                                              IssueRecord IS listed, since an issue
//                                              belongs to a student
//   accounting: accounts, journal entries and the trial-balance / income-expense
//     / balance-sheet reports are a single consolidated ledger for the whole
//     school (confirmed product decision). erp_accounting is not in
//     DB_URI_ENV_VAR either, so there is no separate ledger database.
//
// Rows in those collections were still stamped by the first backfill run; the
// extra field is simply unused, which is why re-running the backfill is a no-op.
const BRANCH_SCOPED_COLLECTIONS = {
  erp_student: {
    students: "students",
    studentdocuments: "studentdocuments",
    transfercertificates: "transfercertificates",
    admissionenquiries: "admissionenquiries",
  },
  erp_staff: {
    staffs: "staffs",
    teacherassignments: "teacherassignments",
    staffattendances: "staffattendances",
    payrolls: "payrolls",
    leaves: "leaves",
  },
  erp_academic: {
    schoolclasses: "schoolclasses",
    schoolsections: "schoolsections",
    schoolsubjects: "schoolsubjects",
    timetables: "timetables",
    attendances: "attendances",
    exams: "exams",
    homeworks: "homeworks",
    homeworksubmissions: "homeworksubmissions",
    marks: "marks",
    studymaterials: "studymaterials",
    syllabuses: "syllabuses",
    rooms: "rooms",
    substitutions: "substitutions",
    achievements: "achievements",
    behaviorrecords: "behaviorrecords",
    studentacademicrecords: "studentacademicrecords",
  },
  erp_fee: {
    feestructures: "feestructures",
    feeinvoices: "feeinvoices",
    studentfeeplans: "studentfeeplans",
    concessions: "concessions",
    feereminders: "feereminders",
    payments: "payments",
    paymentorders: "paymentorders",
  },
  erp_facility: {
    busroutes: "busroutes",
    hostels: "hostels",
    inventoryitems: "inventoryitems",
  },
  erp_library: {
    issuerecords: "issuerecords",
  },
};

// Database name -> connection string env var. Kept next to the collection map so
// migration/backup scripts cannot drift apart about which URI backs which db.
const DB_URI_ENV_VAR = {
  erp_auth: "AUTH_MONGODB_URI",
  erp_student: "STUDENT_MONGODB_URI",
  erp_staff: "STAFF_MONGODB_URI",
  erp_academic: "ACADEMIC_MONGODB_URI",
  erp_fee: "FEE_MONGODB_URI",
  erp_communication: "COMMUNICATION_MONGODB_URI",
  erp_library: "LIBRARY_MONGODB_URI",
  erp_facility: "FACILITY_MONGODB_URI",
};

const uriForDb = (dbName) => process.env[DB_URI_ENV_VAR[dbName] || ""] || null;

module.exports = { BRANCH_SCOPED_COLLECTIONS, DB_URI_ENV_VAR, uriForDb };
