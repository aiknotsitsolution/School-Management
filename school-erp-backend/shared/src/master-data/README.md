# Platform-Wide Master Data — Classification

Shared factory: `@school-erp/shared/src/master-data`. Adopted by the
academic-service via `createMasterController`.

## What a master is

A **master** is a small catalog record an admin fills in once and every other
module reads as a dropdown option: exam types, classes, sections, subjects,
time slots, rooms. They are the "reference data" layer underneath the
transactional modules (scheduling exams, entering marks, timetables).

## Classification rules

Every master is classified along three axes. A new master must declare all of
them in its `kindConfig` before it is added to a service.

### 1. Scope

| Scope        | Owner      | `schoolId` | Who can create | Can be deactivated |
| ------------ | ---------- | ---------- | -------------- | ------------------ |
| `tenant`     | one school | set        | school admin   | yes                |
| `global`     | platform   | null       | platform only  | no (immutable by tenants) |

Plain masters are strictly `tenant`. **Dual-scope masters** (`subjects`)
merge the platform `global` library with the school's tenant rows into one
list; duplicate checks span both scopes, and creation is always tenant-scoped
so a school can keep its own copy of a global subject.

### 2. Lifecycle field

| Convention                 | Models               | Inactive value |
| -------------------------- | -------------------- | -------------- |
| `active: Boolean`          | exam-types, classes, sections, time-slots, rooms | `active: false` |
| `status: "active"/"inactive"` | subjects (dual-scope) | `status: "inactive"` |

`list` filters active rows. `deactivate` flips the lifecycle field; rows are
never hard-deleted so historical snapshots (e.g. an Exam referencing a subject
snapshot string) keep resolving.

### 3. Uniqueness / duplicate detection

- Plain masters: `dupFilter(payload)` returns the uniqueness filter
  (`{ key }` or `{ className, key }`); a 409 with the label is returned on a hit.
- Dual-scope masters: `dupQuery(payload)` returns the cross-scope filter
  (currently `{ normalizedName }`); creation over a global or tenant match is a
  409 that also returns `{ existingId, name, scope }`.

Uniqueness is **case/whitespace-insensitive** via `normalizeKey` (lowercase +
collapse whitespace + trim), mirroring the `key`/`normalizedName` fields stored
by the models (`mkKey`).

## Seeding policy

- **Per-school defaults** (`seeds()`): provisioned lazily on the first `list`
  while the request is empty — but only when the caller has the write
  permission, so read-only roles see an honest empty state. Idempotent per
  school via a row count.
- **Global library** (`globalSeeds()`): seeded once platform-wide
  (`scope: "global"`), idempotent via a row count.

## Permission mapping

One `kind` registry maps to exactly two permissions:

- `readPermission` — powers `list` + `getById`.
- `writePermission` — powers `create`, `deactivate` and (implicitly) triggering
  the lazy per-school seed.

Route files apply `requirePermission(read|write)` per route; the factory never
re-checks roles itself beyond using the write permission to decide seeding.

## API contract (adopted by academic-service)

```
GET    /api/exam-masters/:kind            -> { success, count, data }
GET    /api/exam-masters/:kind/:id        -> { success, data }
POST   /api/exam-masters/:kind            -> 201 { success, data } | 409 duplicate | 400 invalid
PATCH  /api/exam-masters/:kind/:id/deactivate -> { success, data } | 404
```

Errors: 404 for unknown kind / missing row, 409 for duplicates, 400 for
validation failures (`httpError(400, ...)` from `build`).

## Adding a new master

1. Add the mongoose model that follows the scope + lifecycle-field rules above.
2. Add a `kindConfig` to the registry passed to `createMasterController`.
3. Mount the four routes in the service's router bound to the right permissions.