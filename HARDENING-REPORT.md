# Hardening Report — School Management ERP (Phases 1–3)

Branch: `feature/jeet-ahirwar` · Date: 2026-09-08
Scope: `school-erp-backend/` (Backend + API Gateway) and `School-Management-ERP-System/Frontend-Admin-panel/` (Admin frontend).

Every backend change below was verified live against the running fleet and the
three regression suites (`phase1-verify`, `phase1-regress`, `p2-verify`) unless
stated otherwise. Frontend changes compile with `vite build` (0 errors).

---

## Phase 1 — Authentication & Authorization (complete, re-verified)

- Split the `school_admin` credential into a dedicated `principal@lotusvalley.edu.in` account.
- Dev/test accounts locked to the Lotus Valley tenant; tenant resolution is server-side (school id from JWT, active school, or `X-School-Id` for platform admins) — no client-trusted tenant field.
- Audit log entries added for auth, user management, and reset-link events (`writeAudit`).

## Phase 2 — Data Integrity (complete, re-verified)

- Server-side enforcement of invoice/payment/order fields (status, `paidAmount`, `receiptNo`, `_id`); client-set values are ignored.
- Regex metacharacter escaping in student and book search; strict ObjectId validation via `router.param` across 22 routers and 8 `middleware/objectId.js` copies; never-500 checks on resource ids.
- Payment `:id/confirm` blocked at the gateway (404) and the direct route returns 503 when no provider is configured.
- Internal notify endpoints hidden from the gateway; require the `INTERNAL_NOTIFY_KEY` header (401 otherwise, strict 32–64 char policy).

## Phase 3 — Hardening & Product Honesty (this pass)

### 12. Password recovery (admin-initiated, no fake email provider)

Backend (`auth-service`):
- `POST /api/auth/users/:id/reset-password` — authorised admin (platform owner or school admin with `users:manage`) generates a signed, 15-minute JWT (`purpose: "password-reset"`) and receives the `resetLink`. Role management guards reused from `loadManageableUser` (admins may not reset fellow/other-school admins).
- `POST /api/auth/reset-password` (public) — consumes `{ token, newPassword }`; enforces 8+ char policy; **single-use** via a `passwordChangedAt` watermark; rejects inactive/removed users and inactive tenants.
- Refresh tokens issued **at or before** the last password change/reset are rejected (`iat*1000 <= passwordChangedAt`), invalidating old sessions on both `changePassword` and reset.
- `User` model gains `passwordChangedAt`. New gateway rate limiters: `RATE_LIMIT_RESET_PASSWORD_MAX` (10) and `RATE_LIMIT_ADMIN_RESET_MAX` (20).
- No forgot-password endpoint exists (would require a delivery channel none of the providers offer).

Frontend:
- `src/lib/api.js`: `resetPassword(token, newPassword)` and `users.resetPassword(id)`.
- New `src/pages/ResetPassword.jsx` + `/reset-password` route in `App.jsx`.
- `Users.jsx`: "Reset password" action (row + User 360° drawer) copies the generated link to the clipboard with the 15-min expiry noted.
- `Login.jsx`: removed the dead "Forgot password?" link; now instructs users to contact their administrator.

Live verification (`p3-reset-verify.js`, 15/15): generation shape, teacher/self-reset denial, weak-password 400, single-use token replay 400, old password rejected, new password login, pre-reset refresh token invalidated, password restored afterwards.

### 13. Provider readiness — fail closed

- All 7 `services/*/src/config/imagekit.js` export `null` unless public key + private key + url endpoint are all present.
- Upload sites (student photo, document upload, document delete) check `imagekit` before use: 503 "Image provider is not configured" when unset, and SDK failures are returned as clean 502s — never an uncaught crash. `deleteFile` skips the ImageKit call when no `fileId` exists.
- Verified: `require` with env unset → module `=== null`; live uploads return 5xx (503/502) with a stable message.

### 14. Staff role permissions & validation hardening

- All 8 `utils/permissions.js` copies: generic `staff` role now grants `["staff:read","leaves:apply","payroll:view"]`; the staff/class_teacher lookup falls back to `ROLE_PERMISSIONS["staff"]` instead of `{}`.
- `leaveController.updateLeaveStatus` rejects statuses outside `["Approved","Rejected"]` (400).
- `staffAttendanceController.markAttendance`: validates status against `VALID_STATUSES` and enforces tenant-scoped `staffId` referential integrity for school admins (400 on unknown/other-tenant staff).

Frontend:
- `Leave.jsx`: fetches real leaves + staff, joins names, submits `api.leaves.create`, approves/rejects via `api.leaves.updateStatus`, removed the fake delete button; leave-type values mapped to the backend enum. Balance tab now states honestly that balances are maintained offline.
- `Payroll.jsx`: joins payroll rows to real staff records, filters by the selected month/year, creates entries via `api.payroll.create` (staff picker, basic/allowances/deductions), marks paid via `api.payroll.markPaid` (removed the fake "Unmark"), and the payslip header uses the actual school name instead of a hardcoded one.

Live verification (`p3-guards-verify.js`, 8/8): leave create, invalid-status 400, valid status accepted, pagination keys and limit honoured, upload fail-closed paths.

### 15. Dashboard honesty cleanups

- Admin `Dashboard.jsx` bus card: capacity removed (the `BusRoute` model has no capacity); occupancy shows real assigned-student count; ETA shows "Live/—" truthfully.
- `AccountantDashboard.jsx`: hardcoded `/2026` replaced with the current logged month/year.
- `ClassTeacherDashboard.jsx`: unused `Bell` import removed.

### 16. Pagination across the fleet

- Added `utils/pagination.js` to all 8 services (`paginate` default 500 / max 1000) and applied it to every list endpoint: students (+ `pages` key), staff, payroll, leaves, staff attendance (50/200), documents, invoices/payments/orders, books/issues, notices, events, notifications (100/500), homework, exams, attendance, homework submissions, routes, inventory items, hostel rooms, plans (internal 25/100), schools (50/200).
- Responses are **additive**: `{ success, count, total, page, limit, pages, data }` — existing UI keys unchanged.
- Verified overriding limits are clamped and pagination metadata is present/consistent on paged endpoints.

### 17. Remaining, honest gaps (BLOCKED BY EXTERNAL CONFIGURATION)

- **ImageKit**: uploads fail 5xx until real credentials are provided (the dev `.env` files contain placeholder values → 502 rather than 503; the null/503 path is proven).
- **Payment provider**: `PAYMENT_PROVIDER_ENABLED=true` + gateway credentials are required for online payment confirmation; consent/confirm stays 404/503 until then (safe default).
- **Email/SMS**: no provider exists, so password recovery is intentionally admin-initiated and delivered out-of-band.
- **Test-invoice cleanup**: 3 dev fixtures (amount 100, Unpaid) in the remote fee DB could not be deleted — the standalone Atlas SRV DNS fails outside the running services. Harmless and inert.
- **Known cosmetic debt, not fixed by design/non-goals**: legacy orphan `src/pages/.../Platform.jsx`; `BusTracking.jsx` still carries "Bhopal fleet"/CCTV demo copy; `ReportCard`/`Students` contain stale commented helpers; general lint debt (~92 warnings, 0 errors) predates this pass.

## Verification artifacts

- Suites (all green after this pass): `phase1-verify.js`, `phase1-regress.js`, `p2-verify.js`.
- Phase-3 checks: `p3-reset-verify.js` (15/15), `p3-guards-verify.js` (8/8).
- `node --check` clean on every touched backend file; `npm run lint` 0 errors; `npm run build` succeeds.
- Backend restart procedure unchanged: kill `school-erp-backend|dev-all|nodemon` node processes, `node scripts/dev-all.js`, verify ports 5000–5008. In-memory rate limiters flush only on restart.