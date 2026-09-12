// Shared client-side validation helpers. Backend re-validates everything, so
// these exist only to give the user immediate, consistent feedback (tone:
// "error") instead of relying on the network round-trip or silent no-ops.
// Pattern set mirrors the backend conventions (admission/enquiry line, the
// de-facto email regex, canonical short academic-year labels like "2026-27").

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+]?[0-9\s-]{10,15}$/;
// Academic year label: "2026", "2026-27" or "2026-2027".
export const SESSION_RE_STR = "(\\d{4})(\\s*[-—–]\\s*(\\d{2}|\\d{4}))?";
export const SESSION_RE = new RegExp(`^${SESSION_RE_STR}$`);
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isNonEmpty = (v) => v != null && String(v).trim() !== "";
export const isPositiveNumber = (v) => Number.isFinite(Number(v)) && Number(v) > 0;
export const isNonNegativeNumber = (v) => Number.isFinite(Number(v)) && Number(v) >= 0;
export const isValidEmail = (v) => isNonEmpty(v) && EMAIL_RE.test(String(v).trim());
// Empty phone is allowed (optional field); if present it must match.
export const isValidPhone = (v) => !isNonEmpty(v) || PHONE_RE.test(String(v).trim());
export const isValidSession = (v) => isNonEmpty(v) && SESSION_RE.test(String(v).trim());