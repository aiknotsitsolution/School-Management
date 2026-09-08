// Staff persona architecture: maps authentication identity (role + designation)
// to a persona workspace. Designation is NOT the authorization mechanism
// (that remains role + permission + tenant scope); this resolver only decides
// which workspace UI and navigation a user lands in.

export const STAFF_PERSONAS = {
  counsellor: {
    key: "counsellor",
    designation: "admission_counsellor",
    label: "Admission Counsellor",
    landing: "/admission-counsellor",
  },
  classTeacher: {
    key: "classTeacher",
    designation: null,
    label: "Class Teacher",
    landing: "/teacher-dashboard",
  },
  accountant: {
    key: "accountant",
    designation: "accountant",
    label: "Accountant",
    landing: "/accountant",
  },
  librarian: {
    key: "librarian",
    designation: "librarian",
    label: "Librarian",
    landing: "/librarian",
  },
  receptionist: {
    key: "receptionist",
    designation: "receptionist",
    label: "Receptionist",
    landing: "/reception",
  },
  transport: {
    key: "transport",
    designation: "transport",
    label: "Transport Coordinator",
    landing: "/transport",
  },
  staffGeneric: {
    key: "staffGeneric",
    designation: null,
    label: "Staff",
    landing: "/staff-dashboard",
  },
};

export const PERSONA_BY_DESIGNATION = Object.values(STAFF_PERSONAS).reduce(
  (acc, p) => {
    if (p.designation) acc[p.designation] = p;
    return acc;
  },
  {},
);

// Which staff designations get a persona-restricted workspace.
const PERSONA_DESIGNATIONS = ["accountant", "librarian", "receptionist", "transport"];

export function isPersonaStaff(user) {
  return (
    user?.role === "staff" &&
    PERSONA_DESIGNATIONS.includes(user?.designation)
  );
}

export function resolvePersona(user) {
  if (!user) return null;
  if (user.role === "class_teacher") return STAFF_PERSONAS.classTeacher;
  if (user.role === "staff") {
    if (PERSONA_BY_DESIGNATION[user.designation]) {
      return PERSONA_BY_DESIGNATION[user.designation];
    }
    return STAFF_PERSONAS.staffGeneric;
  }
  return null;
}

export function personaLabel(user) {
  const p = resolvePersona(user);
  return p?.label || "Staff";
}

export function cap(value) {
  if (!value) return "—";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}