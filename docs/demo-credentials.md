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
| Teacher — class teacher of Nursery-A | `classteacher1.demoschool1@edu.in` | `Demo@1234` |
| Teacher — class teacher of LKG-A | `classteacher2.demoschool1@edu.in` | `Demo@1234` |
| Teacher — English in LKG-A | `teacher3.demoschool1@edu.in` | `Demo@1234` |
| Teacher — English in Nursery-A | `demo.class.teacher.i.demoschool1@edu.in` | `Demo@1234` |
| Staff — accountant | `accountant1.demoschool1@edu.in` | `Demo@1234` |
| Staff — librarian | `librarian1.demoschool1@edu.in` | `Demo@1234` |
| Staff — receptionist | `receptionist1.demoschool1@edu.in` | `Demo@1234` |
| Staff — transport | `transport1.demoschool1@edu.in` | `Demo@1234` |
| Staff — admission counsellor | `counsellor1.demoschool1@edu.in` | `Demo@1234` |
| Student — Nursery-A | `student1.demoschool1@edu.in` | `Demo@1234` |
| Student — Nursery-A | `student2.demoschool1@edu.in` | `Demo@1234` |
| Student — LKG-A | `student3.demoschool1@edu.in` | `Demo@1234` |
| Student — LKG-A | `student4.demoschool1@edu.in` | `Demo@1234` |

Demo School 2 uses the same pattern with `@demoschool2.edu.in`.

`seed-demo-users.js` / `seed-demo-users-api.js` create the base accounts. The
accounts added by `scripts/backfill-demo-school-1.js` (see below) are
`demo.class.teacher.i`, `ravi.kumar`, `neha.sharma`, `suresh.rao`,
`kavita.nair`, `aarav.mehta`, `diya.patel` and `vivaan.singh`, all under
`@demoschool1.edu.in`.

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

| Employee ID | Name | Role | Designation | Login |
| --- | --- | --- | --- | --- |
| `DS1N-TCH01` | Ravi Kumar | teacher | Class Teacher - UKG A | `ravi.kumar.demoschool1@edu.in` |
| `DS1N-TCH02` | Neha Sharma | teacher | TGT Science | `neha.sharma.demoschool1@edu.in` |
| `DS1N-ADM01` | Suresh Rao | staff | Front Office | `suresh.rao.demoschool1@edu.in` |
| `DS1N-LIB01` | Kavita Nair | staff | Librarian | `kavita.nair.demoschool1@edu.in` |

All four have a linked login under password `Demo@1234` (added by
`scripts/backfill-demo-school-1.js`). The account's `designation` — not the
staff record's — is what resolves permissions, so Suresh Rao's account carries
`receptionist` and Kavita Nair's carries `librarian`.

Ravi Kumar is the active class teacher of **both UKG-A and UKG-B** for session
`2026`.

### Students

| Admission No | Name | Class | Section | Login |
| --- | --- | --- | --- | --- |
| `DS1NUKG001` | Aarav Mehta | UKG | A | `aarav.mehta.demoschool1@edu.in` |
| `DS1NUKG002` | Diya Patel | UKG | A | `diya.patel.demoschool1@edu.in` |
| `DS1NUKG003` | Vivaan Singh | UKG | B | `vivaan.singh.demoschool1@edu.in` |

All three carry a linked login under password `Demo@1234`.

## Demo School 1 — data backfill

`Backend-server/scripts/backfill-demo-school-1.js` audits Demo School 1 and
backfills everything a live demo needs. Reads go direct to Mongo so the audit
can see every field; **every write goes through the public API as the school's
own admin**, so the application's rules (profile derivation, ID-card issue,
assignment conflicts, academic reference checks, account linking) decide each
change.

```bash
node scripts/backfill-demo-school-1.js            # audit + plan — writes nothing
node scripts/backfill-demo-school-1.js --apply    # execute the plan
node scripts/backfill-demo-school-1.js --verify   # walk the demo personas (12 checks)
```

It fills the profile-completion fields (`dob`, `gender`, `contact`, `address`
for staff; `dob`, `address`, `parentContact`, `motherName` for students) so
every record reaches `profileStatus: complete` and is issued an ID card,
appoints a class teacher for every class-section that holds students, gives the
subject teachers a teaching row, moves `DS1LKG001` back to LKG-A, and creates
the missing login accounts. It is idempotent: re-running reports
`PLAN 0 action(s)` once the school is complete.

Test rows (`Modal Test Student`, `Student three`, `Test Staff A`) are cleared:
the two students and their account are soft-deleted (recoverable), while the
staff row is purged outright together with its single test attendance record —
but only after `personHistory()` confirms nothing else in the fleet references
it. Any other history makes the purge refuse and leave the row in place.

## Staff roles

A staff record has exactly two role values: `teacher` and `staff`. What a person
does is carried by `designation`, not by a third role — permissions resolve in
`shared/src/utils/permissions.js` from the linked user's `role` plus
`designation`.

`admin-staff` and `support` were collapsed into `staff` by
`scripts/migrate-staff-roles.js`. Run that script (dry run first) if you are
migrating a database created before the change.