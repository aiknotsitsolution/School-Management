# Upload UX Implementation Report

## 1. Goal

Replace every old/basic file chooser with modern, reusable upload components across the School Management frontend, and add the minimal backend support needed so homework file attachments are a real, persisted flow.

## 2. What was done

### 2a. Backend — homework file attachments (academic-service)

**Why a backend change was needed**

The existing `POST /api/homework/submissions/:homeworkId` was JSON-only. It accepted `{ content, attachments[] }` (attachment values were URL strings with no upload path). The frontend requirement to attach a local file could not be met by any existing upload API, so a minimal multipart addition was justified under the earlier-agreed exception ("existing upload API genuinely incompatible").

**Changes**

| Area | File | Change |
|------|------|--------|
| Model | `academic-service/src/models/HomeworkSubmission.js` | `attachments` changed from `[{ type: String }]` to `[{ type: Mixed, default: [] }]`. Legacy URL strings are still stored. |
| Controller | `academic-service/src/controllers/homeworkSubmissionController.js` | Optional `req.file` → ImageKit upload (`/school-erp/homework`); attachment pushed as `{ fileName, fileUrl, fileId, mimeType, fileSize }`. A guard returns `400` when no `content` and no `file` are present. Legacy `body.attachments` (JSON array) still merges. JSON-string `attachments` from multipart fields is safely parsed. |
| Routes | `academic-service/src/routes/homeworkSubmissionRoutes.js` | `multer` (memoryStorage, 10 MB, JPEG/PNG/PDF/DOCX/PPTX) added to `POST /:homeworkId`. Multer `LIMIT_FILE_SIZE` → JSON `413`; bad MIME → JSON `400`. Non-multipart JSON requests pass through unchanged. |
| Package | `academic-service/package.json` | Added `multer ^2.3.0`. |

**Why not a dedicated homework upload endpoint**

Not needed. The attachment is a single optional file per submission; the multer middleware + existing submission path keeps the surface minimal while still storing the file securely server-side via ImageKit (keys never reach the browser).

### 2b. Frontend — shared reusable components

New `src/components/upload/` directory:

| Component | Purpose |
|-----------|---------|
| `FileDropzone.jsx` | Controlled drag & drop + click-to-browse + keyboard-accessible file picker. Validates mime/extension/size; shows inline error, status, and loading overlay. Drag is a progressive enhancement; browsing always works. |
| `FilePreview.jsx` | Shows the selected/remote file as a compact row (thumbnail for images, icon for others) with name, size, Replace and Remove actions. |
| `ImageDropzone.jsx` | Thin config wrapper over FileDropzone for image-only picks (JPG/PNG/GIF/WEBP, 5 MB default). |
| `UploadProgress.jsx` | Indeterminate determinate progress bar for active uploads. Defines the `upload-slide` animation. |
| `AttachmentLinks.jsx` | Renders submission attachments as clickable links. Supports both the legacy string URL shape and the new object shape. |
| `AvatarEditor.jsx` | Modal with square crop preview, zoom slider, drag-to-pan, and canvas-based 512 × 512 square export. Does **not** upload on select; only on Save (calls `onSave(file)`). Cancel discards. |
| `uploadUtils.js` | Shared helpers (`formatBytes`, `fileTypeLabel`) kept out of the component-only file to satisfy the Fast Refresh lint rule. |

**Design system adherence**

All components use the existing Tailwind v4 `@theme` tokens (ink, amber, paper, slate-text, success, alert), `font-display`, `rounded-xl`, `border-black/[0.06]`, `bg-paper/60`, and the Button/Input UI primitives from `src/components/UI.jsx`. No new dependencies were introduced; lucide-react icons match the project's established set.

**Accessibility**

- Every interactive element is a native `<button>` or `<input>` (no fake clickable `<div>`).
- `role="button"`, `tabIndex`, `onKeyDown` for Enter/Space on drop zones.
- `sr-only` status region with `aria-live="polite"` for screen reader feedback.
- AvatarEditor is a proper `role="dialog" aria-modal="true"` with Escape-to-close.
- FileDropzone accepts a `label` prop that produces a `<label htmlFor>` tied to the hidden `<input id>`.

### 2c. Frontend — page wiring

| Page | What changed |
|------|-------------|
| `student/Documents.jsx` | Raw `<input type="file">` replaced with `FileDropzone` (10 MB, images/PDF/DOCX). Upload spinner via `UploadProgress`. Removed manual `fileRef` reset. |
| `student/Homework.jsx` | Submit form now includes optional `FileDropzone` (10 MB, JPG/PNG/PDF/DOCX/PPTX). Text **or** file **or** both allowed. Disabled state + toast validation. Submission panel shows attachment links via `AttachmentLinks`. |
| `teacher/Homework.jsx` | Submissions list always shows attachment links (compact, line-clamped). Review modal renders attachments under "Student's response" or "Student's file". |
| `AddStudent.jsx` | "Photo URL" block replaced with Avatar modal flow: Add/Change Photo button → `AvatarEditor` → `onSave` sets `photoFile` (no immediate upload). Remove button clears the photo. Pencil overlay on the avatar preview opens the editor. Photo URL text input retained as a fallback. |

### 2d. `api.js` change

`homework.submissions.submit` now accepts an optional `file` field. When a `File` is present, it builds a `FormData` (fields: `file`, optional `content`, optional JSON-stringified `attachments`) instead of `JSON.stringify`. This keeps legacy JSON callers working while enabling the multipart path.

### 2e. Minor fixes

- `UI.jsx` `Avatar` — added initials fallback (`bg-amber/20 text-amber-dark`) + `onError` handler so broken images degrade gracefully.
- `src/index.css` — added the `upload-slide` keyframe and `--animate-upload-indeterminate` token for the indeterminate progress bar.
- Removed 10 unused imports from pages that were touched or already had stale imports.

## 3. Validation results

### Backend (13/13 green)

```
PASS  teacher login
PASS  teacher lists class students
PASS  student login
PASS  student lists homework
PASS  empty submission rejected 400
PASS  invalid type (.txt) rejected 400
PASS  oversized rejected 413
PASS  file submission 201 + attachment
PASS  attachment object shape
PASS  uploaded file reachable 200
PASS  json text-only submission 201
PASS  teacher sees student submission
PASS  teacher review -> Reviewed
```

### Frontend lint + build

| Check | Result |
|-------|--------|
| `npm run lint` (oxlint) | **0 errors**, 85 warnings (all pre-existing: set-state-in-effect, exhaustive-deps, unused vars in untouched staff pages) |
| `npm run build` (vite) | **Clean build**, 1,439 kB JS bundle, 78 kB CSS |

### Old-UI audit (post-implementation)

Repo-wide search for `type="file"`, `Choose File`, `No file chosen` in `src/**/*.jsx`:

| Match | File | Classification |
|-------|------|---------------|
| `type="file"` | `components/upload/FileDropzone.jsx:171` | **Internal — Hidden input (safe)**. This is the native `<input type="file">` inside the reusable dropzone, rendered `sr-only` and only programmatically triggered. It is the required enhancement layer over the native browser picker. |

**No raw file inputs remain in any page component.** All user-facing upload surfaces now go through the shared components.

## 4. Files changed (summary)

**Backend (academic-service)**

- `services/academic-service/src/models/HomeworkSubmission.js` — `attachments` Mixed[]
- `services/academic-service/src/controllers/homeworkSubmissionController.js` — ImageKit upload + 400 guard
- `services/academic-service/src/routes/homeworkSubmissionRoutes.js` — multer middleware
- `services/academic-service/package.json` — multer dependency

**Frontend**

- `src/components/upload/FileDropzone.jsx` (new)
- `src/components/upload/FilePreview.jsx` (new)
- `src/components/upload/ImageDropzone.jsx` (new)
- `src/components/upload/UploadProgress.jsx` (new)
- `src/components/upload/AvatarEditor.jsx` (new)
- `src/components/upload/AttachmentLinks.jsx` (new)
- `src/components/upload/uploadUtils.js` (new)
- `src/components/UI.jsx` — Avatar initials fallback
- `src/index.css` — upload-slide keyframe
- `src/lib/api.js` — homework submit FormData path
- `src/pages/student/Documents.jsx` — FileDropzone + UploadProgress
- `src/pages/student/Homework.jsx` — FileDropzone + AttachmentLinks
- `src/pages/teacher/Homework.jsx` — AttachmentLinks in list + review modal
- `src/pages/AddStudent.jsx` — AvatarEditor modal integration

## 5. No regressions

- Existing JSON submission path (text-only, no file) works unchanged.
- Teacher review workflow unchanged.
- RBAC/tenant scoping untouched (multer runs inside the existing auth/permission middleware chain).
- All ImageKit uploads go through the server-side service credentials (never exposed to the browser).
