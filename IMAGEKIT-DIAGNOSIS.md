# ImageKit Diagnosis

Diagnosed read-only on 2026-09-09. No credentials were printed, `.env` contents were not committed, no real student document/photo was uploaded, and no credentials were rotated or modified.

## Runtime Configuration

| Item | Value |
|---|---|
| Env source | Single root env `school-erp-backend/.env` (no per-service `.env` files exist) |
| Loader | `scripts/dev-all.js:8` → `dotenv.config({ path: root/.env, override: true })`; children spawned with `cwd: services/<svc>` and `env: process.env` |
| IMAGEKIT_PUBLIC_KEY | Configured: YES (value length 35, no quotes / whitespace / multiline) |
| IMAGEKIT_PRIVATE_KEY | Configured: YES (value length 36, no quotes / whitespace / multiline) |
| IMAGEKIT_URL_ENDPOINT | Configured: YES (valid URL, hostname `ik.imagekit.io`) |
| Variable names vs code | Exact match (`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`) |
| SDK version | `imagekit` 6.0.0 (`^6.0.0`) — installed in student-service and academic-service only |
| Instances | student-service and academic-service construct ImageKit (uploadEndpoint `upload.imagekit.io`, urlEndpoint `ik.imagekit.io`) |
| Other services | auth/fee/communication/library/facility define `src/config/imagekit.js` but do NOT have `imagekit` installed and nothing imports the config (inactive); staff-service has no config file |

Runtime env verified: the running fleet is `scripts/dev-all.js` (PID 10500) plus its 8 `nodemon src/index.js` children on ports 5001–5008, so every service process inherits the root `.env` values (the live 502 observed against `/api/students/upload-photo` already proved the student instance was truthy at runtime, not null).

Caveat: if any service is started standalone (not via dev-all), its plain `require("dotenv").config()` finds no `.env` in its own directory → ImageKit vars absent → instance is null → uploads return 503 "Image provider is not configured". Not the current situation (dev-all is running).

## Actual Failure

- Failing service / operation: student-service `POST /api/students/upload-photo` (and the analogous academic-service path). Live repro returned HTTP 502; the controller's error message was empty before a fallback fix (`err?.message || "Image upload failed"`), which is consistent with the SDK rejecting with a bare provider-error object rather than an `Error`.
- Authenticated read-only test using the exact configured credentials (ImageKit SDK v6 `listFiles(limit:1)`, Basic-auth private key — the same auth mechanism and request util used by `upload()`):

```
HTTP 403
message = "Your account cannot be authenticated."
help    = "For support kindly contact us at support@imagekit.io ."
```

- Control checks (provider reachable, no credential exposure):
  - `GET  https://api.imagekit.io/v1/files` (no auth) → 401 (endpoint live, auth required)
  - `POST https://upload.imagekit.io/api/v1/files/upload` (no auth) → 400 (endpoint live)
- Upload mechanics: SDK v6 `upload()` POSTs to `https://upload.imagekit.io/api/v1/files/upload` with Basic auth (username = privateKey, empty password). It does NOT use `IMAGEKIT_URL_ENDPOINT`, which is only used for URL building. Therefore the upload path hits the same 403 before any file bytes are consumed.

## Root Cause

- **A Env loading** — RULED OUT. All three vars are present in the root `.env`, loaded with `override`, propagated to all child processes, and the student/academic instances are non-null at runtime.
- **C Key mismatch (names)** — RULED OUT. Config code and `.env` names match exactly.
- **D Wrong endpoint** — RULED OUT. Endpoint hostname is a valid `ik.imagekit.io` account endpoint, and server-side upload/list do not depend on `urlEndpoint` at all.
- **F SDK-API usage** — RULED OUT. SDK 6.0.0 API usage in the app is correct (`imagekit.upload({file, fileName, folder, useUniqueFileName})`); the SDK constructs the documented multipart request to `upload.imagekit.io`.
- **G App integration bug** — MINOR/incidental (see below), not the source of the 403.
- **B Invalid credentials / E Account-permission** — **ROOT CAUSE.** ImageKit returns **HTTP 403 "Your account cannot be authenticated."** when the private key's account cannot be authenticated: the key is recognized as a credential but rejected at account level. Per ImageKit semantics this maps to one of: private key does not belong to the same account as the configured URL endpoint, the credentials/account are disabled or revoked, the key was rotated and the `.env` still holds the old value, or an account restriction (e.g., IP allow-listing) is blocking the request origin. This happens before any upload, so no provider-side file was created.

Incidental finding (secondary): the app's catch reads `err?.message`; the v6 SDK rejects with a plain object carrying `$ResponseMetadata.statusCode` (non-enumerable) plus provider fields. For this specific 403 the message field IS populated, so today the API would return `502 {"success":false,"message":"Your account cannot be authenticated."}` — misleading status/UX only, not the failure cause.

## Recommended Fix

1. In the ImageKit dashboard (account matching `ik.imagekit.io`), open API Keys and confirm the `IMAGEKIT_PRIVATE_KEY` in `school-erp-backend/.env`:
   - exists, is active (not revoked/regenerated), and
   - belongs to the same account as `IMAGEKIT_URL_ENDPOINT`.
2. If uncertain, generate a fresh private key and update the `.env` value (keep it clean — no quotes, trailing spaces, or newlines; current value is already clean). Restart via `scripts/dev-all.js` (kill node.exe trees for `school-erp-backend`/`dev-all`/`nodemon` first).
3. Re-run the read-only connectivity check (see `ik-diag.js` in the opencode temp dir) — expected `listFiles` → HTTP 200 with 1 item. Then a real upload will succeed.
4. Latent landmine (recommended cleanup, not blocking today): `auth/fee/communication/library/facility` each ship `src/config/imagekit.js` but lack the `imagekit` package. Because all 3 env vars are set, the guard in those configs evaluates true and `require("imagekit")` throws `MODULE_NOT_FOUND` the moment any of those services imports its config. Either install `imagekit@^6.0.0` in those services or delete the unused config files.
5. Optional app improvement: in `studentController.uploadStudentPhoto` (and document upload), propagate `err.$ResponseMetadata?.statusCode` so provider rejections surface the true upstream code instead of a generic 502, and prefer `err.message || err.help`.