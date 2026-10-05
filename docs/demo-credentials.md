# Demo Credentials

Seeded logins for local development. Every demo user shares the same password, so
you only have to remember `Demo@1234`.

> These are development-only accounts. Never reuse this password on a deployed
> environment, and never seed demo data against production.

## Platform

| Role | Email | Password |
| --- | --- | --- |
| Super admin | `administrator@aiknotsit.com` | `Administrator@321` |

The super admin is the only account that can create schools and manage plans
across tenants.

## Demo School 1

| Role | Email | Password |
| --- | --- | --- |
| School admin | `schooladmin1.demoschool1@edu.in` | `Demo@1234` |
| Teacher (class teacher) | `classteacher1.demoschool1@edu.in` | `Demo@1234` |
| Student | `student1.demoschool1@edu.in` | `Demo@1234` |

The seed also creates `classteacher2`, `teacher3`, `accountant1`, `librarian1`,
`receptionist1`, `transport1`, `counsellor1`, and `student2`–`student4` under the
same password. Demo School 2 uses the same pattern with `@demoschool2.edu.in`.

### Note on the admin email

`seed-demo-users.js` builds `schooladmin.demoschool1@edu.in` (no `1`) while
`seed-demo-users-api.js` builds `schooladmin1.demoschool1@edu.in`. The seeded
account in the database is the `schooladmin1` one — logging in with the
un-suffixed address returns 401.

## Demo School 1 — North Campus

A second branch of Demo School 1, created to exercise branch scoping.

| Field | Value |
| --- | --- |
| Name | Demo School 1 - North Campus |
| Code | `ds1-north` |
| Branch ID | `6abe248295e40c3ea6dd0cc6` |

The parent school's head office is `demo-school-1`
(`6abc705709044be1d90e67ae`).

Writes are stamped with the branch from the `X-Branch-Id` request header, so
set it to `6abe248295e40c3ea6dd0cc6` to land data in North Campus. Branch
filtering itself is controlled by `BRANCH_SCOPE` in `Backend-server/.env`
(currently `off`), which is independent of the header stamping.

### Staff

| Employee ID | Name | Role | Designation |
| --- | --- | --- | --- |
| `DS1N-TCH01` | Ravi Kumar | teacher | Teacher |
| `DS1N-TCH02` | Neha Sharma | teacher | Teacher |
| `DS1N-ADM01` | Suresh Rao | staff | Administrative Officer |
| `DS1N-LIB01` | Kavita Nair | staff | Librarian |

These four are staff records only — no linked login accounts. Email them
`ravi.kumar.north@edu.in`, `neha.sharma.north@edu.in`,
`suresh.rao.north@edu.in` and `kavita.nair.north@edu.in`.

### Students

| Admission No | Name | Class | Section |
| --- | --- | --- | --- |
| `DS1NUKG001` | Aarav Mehta | UKG | A |
| `DS1NUKG002` | Diya Patel | UKG | A |
| `DS1NUKG003` | Vivaan Singh | UKG | B |

Student records do not carry a password; a login is created separately via
Users & Access.

## Staff roles

A staff record has exactly two role values: `teacher` and `staff`. What a person
does is carried by `designation`, not by a third role — permissions resolve in
`shared/src/utils/permissions.js` from the linked user's `role` plus
`designation`.

`admin-staff` and `support` were collapsed into `staff` by
`scripts/migrate-staff-roles.js`. Run that script (dry run first) if you are
migrating a database created before the change.