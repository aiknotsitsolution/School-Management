import { useMemo, useState } from "react";
import { ID_CARD_W, ID_CARD_H, idCardSettings } from "./StudentIdCard";
import { sessionLabel } from "../../lib/session";

// Staff ID cards share the school's ID-card design infrastructure (accent,
// logo, footer note) but carry a "STAFF ID CARD" header — the student title in
// the shared settings is never reused for person records.
export const STAFF_ID_CARD_TITLE = "STAFF ID CARD";

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initialsOf(name) {
  return (
    String(name || "S")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "S"
  );
}

function schoolLogoMarkup(school, accent) {
  const src = school?.logo;
  const letter = esc((school?.shortName || "S").slice(0, 1).toUpperCase());
  return src
    ? `<img src="${esc(src)}" alt="" style="width:58px;height:58px;border-radius:50%;background:#fff;object-fit:contain;border:1px solid rgba(255,255,255,.4);"/>`
    : `<div style="width:58px;height:58px;border-radius:50%;background:#fff;color:${accent};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;">${letter}</div>`;
}

function photoMarkup(teacher) {
  const src = teacher.photoUrl;
  if (src)
    return `<img src="${esc(src)}" alt="" style="width:96px;height:96px;border-radius:18px;object-fit:cover;border:1px solid rgba(15,23,42,.12);"/>`;
  return `<div style="width:96px;height:96px;border-radius:18px;background:${teacher.profileStatus === "complete" ? "#E8F5EE" : "#F6EFE3"};color:${teacher.profileStatus === "complete" ? "#1B7A45" : "#B4652F"};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:26px;border:1px solid rgba(15,23,42,.08);">${esc(initialsOf(teacher.name))}</div>`;
}

function detailRow(label, value) {
  if (!value) return "";
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px dashed rgba(15,23,42,.1);padding-bottom:4px;gap:8px;"><span style="color:#64748b;font-size:10.5px;white-space:nowrap;">${label}</span><span style="font-weight:600;font-size:11.5px;text-align:right;">${value}</span></div>`;
}

// Renders a "real ID card" front & back for a Teacher/Staff person record —
// the same layout family as the student card (school header, photo, identity
// rows, signatures and validity) so the two share a coherent design system.
export function staffIdCardMarkup({ teacher, school }) {
  const s = idCardSettings(school);
  const accent = s.accent;
  const schoolName = school?.name || "Zipschool OS";
  const shortName = school?.shortName || "SCHOOL";
  const session = sessionLabel(school) || String(new Date().getFullYear());
  const idNumber = teacher.idCardNumber || "—";
  const issuedDate = formatDate(teacher.idCardIssuedAt);

  const cardBase =
    `width:${ID_CARD_W}px;height:${ID_CARD_H}px;border-radius:18px;overflow:hidden;position:relative;font-family:Inter,system-ui,sans-serif;background:#fff;color:#0f172a;box-shadow:0 10px 30px rgba(15,23,42,.16);`;

  // ---------------- FRONT ----------------
  const front = `
    <div style="${cardBase}">
      <div style="background:${accent};color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px;">
        ${schoolLogoMarkup(school, accent)}
        <div style="min-width:0;flex:1;">
          <div style="font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;opacity:.78;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(shortName)} · ${esc(schoolName)}</div>
          <div style="font-size:15px;font-weight:800;letter-spacing:.02em;margin-top:2px;">${esc(STAFF_ID_CARD_TITLE)}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:20px;padding:20px 18px 14px;">
        ${photoMarkup(teacher)}
        <div style="min-width:0;flex:1;">
          <div style="font-size:17px;font-weight:800;color:#0f172a;line-height:1.2;">${esc(teacher.name || "—")}</div>
          <div style="margin-top:10px;font-size:11.5px;color:#475569;display:flex;flex-direction:column;gap:6px;">
            <div><span style="text-transform:uppercase;letter-spacing:.06em;font-weight:700;font-size:9px;color:#94a3b8;">Designation</span> <span style="font-weight:700;color:#0f172a;">${esc(teacher.designation || "—")}</span></div>
            <div><span style="text-transform:uppercase;letter-spacing:.06em;font-weight:700;font-size:9px;color:#94a3b8;">Staff ID</span> <span style="font-weight:700;font-family:ui-monospace,monospace;color:#0f172a;">${esc(idNumber)}</span></div>
            ${teacher.department ? `<div><span style="text-transform:uppercase;letter-spacing:.06em;font-weight:700;font-size:9px;color:#94a3b8;">Department</span> <span style="font-weight:600;color:#334155;">${esc(teacher.department)}</span></div>` : ""}
          </div>
        </div>
      </div>
      <div style="position:absolute;left:18px;right:18px;bottom:40px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div style="text-align:center;width:44%;">
          <div style="border-top:1px solid rgba(15,23,42,.25);height:0;"></div>
          <div style="font-size:8.5px;color:#64748b;margin-top:3px;">Authorised Sign</div>
        </div>
        <div style="text-align:center;width:44%;">
          <div style="border-top:1px solid rgba(15,23,42,.25);height:0;"></div>
          <div style="font-size:8.5px;color:#64748b;margin-top:3px;">Staff Sign</div>
        </div>
      </div>
      <div style="position:absolute;left:0;right:0;bottom:0;background:${accent};color:#fff;padding:7px 18px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;display:flex;align-items:center;justify-content:space-between;">
        <span>Valid for Session ${esc(session)}</span>
        <span>${esc(shortName)} · Staff Identity</span>
      </div>
    </div>`;

  // ---------------- BACK ----------------
  const detailRows = [
    detailRow("Date of Birth", teacher.dob ? esc(formatDate(teacher.dob)) : ""),
    detailRow("Gender", teacher.gender ? esc(teacher.gender) : ""),
    detailRow("Contact", teacher.contact ? `<span style="font-family:ui-monospace,monospace;">${esc(teacher.contact)}</span>` : ""),
    detailRow("Qualification", teacher.qualification ? esc(teacher.qualification) : ""),
    detailRow("Employee ID", teacher.employeeId ? `<span style="font-family:ui-monospace,monospace;">${esc(teacher.employeeId)}</span>` : ""),
  ].join("");

  const back = `
    <div style="${cardBase}">
      <div style="background:${accent};color:#fff;padding:9px 18px;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;">${esc(shortName)} — ${esc(STAFF_ID_CARD_TITLE)}</span>
        <span style="font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.8;">Back of card</span>
      </div>
      <div style="padding:12px 18px;display:flex;flex-direction:column;gap:5px;">
        ${detailRows || `<span style="font-size:11px;color:#94a3b8;">Additional details appear here once the profile is completed.</span>`}
      </div>
      <div style="position:absolute;left:18px;right:18px;bottom:34px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="background:repeating-linear-gradient(90deg,#0f172a 0 1px,transparent 1px 3px);opacity:.55;width:80px;height:24px;"></div>
          <span style="background:${accent};border-radius:8px;color:#fff;font-family:ui-monospace,monospace;font-size:11px;font-weight:700;padding:3px 10px;">ID ${esc(teacher.idCardNumber || teacher.employeeId || "—")}</span>
        </div>
        ${teacher.idCardNumber ? `<span style="font-size:9px;color:#94a3b8;text-align:right;">Issued ${esc(issuedDate)}</span>` : ""}
      </div>
      <div style="position:absolute;left:18px;right:18px;bottom:8px;font-size:8.5px;color:#94a3b8;font-style:italic;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(s.footerNote)}</div>
    </div>`;

  return { front, back, settings: s };
}

// Opens a print window containing the real-size staff ID card (front + back).
export function printTeacherIdCard({ teacher, school }) {
  const { front, back } = staffIdCardMarkup({ teacher, school });
  const win = window.open("", "_blank", "width=900,height=640");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><title>Staff ID Card</title><style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font-family: Inter, system-ui, sans-serif; background: #eef1f5; margin: 0; padding: 28px; display: flex; gap: 28px; align-items: flex-start; justify-content: center; flex-wrap: wrap; }
      .frame { border-radius: 18px; padding: 12px; background: #fff; box-shadow: 0 2px 10px rgba(15,23,42,.08); }
      .label { text-align: center; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 8px; }
      @media print { body { background: #fff; padding: 0; } .frame { box-shadow: none; padding: 6px; } .print-hide { display: none !important; } }
    </style></head><body>
      <div class="frame"><div class="label print-hide">Front</div>${front}</div>
      <div class="frame"><div class="label print-hide">Back</div>${back}</div>
    </body></html>`,
  );
  win.document.close();
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
}

const CARD_W = ID_CARD_W;
const CARD_H = ID_CARD_H;

// The shared person-record ID card: a 3D flip card (front/back) rendered with
// the school's ID-card design, exactly like the student card's UI.
export default function TeacherIdCard({ teacher, school }) {
  const [flipped, setFlipped] = useState(false);
  const { front, back } = useMemo(
    () => staffIdCardMarkup({ teacher, school }),
    [teacher, school],
  );

  const faceStyle = {
    position: "absolute",
    inset: 0,
    width: CARD_W,
    height: CARD_H,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <div className="flex flex-col items-center gap-2.5 w-full">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label="Flip staff ID card"
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className="w-full flex justify-center outline-none cursor-pointer select-none"
        style={{ minHeight: CARD_H + 4, perspective: 1400 }}
      >
        <div
          className="relative transition-transform duration-600 ease-[cubic-bezier(.4,.2,.2,1)]"
          style={{
            width: CARD_W,
            height: CARD_H,
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div style={{ ...faceStyle, transform: "rotateY(0deg)" }}>
            <div
              className="rounded-2xl overflow-hidden shadow-lg"
              dangerouslySetInnerHTML={{ __html: front }}
            />
          </div>
          <div style={{ ...faceStyle, transform: "rotateY(180deg)" }}>
            <div
              className="rounded-2xl overflow-hidden shadow-lg"
              dangerouslySetInnerHTML={{ __html: back }}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-info bg-info/10 hover:bg-info/20 px-3 py-1.5 rounded-lg transition-colors"
      >
        <span aria-hidden="true">⟳</span>
        {flipped ? "Show front" : "Show back"}
      </button>
      <p className="text-[11px] text-slate-text/50 -mt-1">
        Tap the card to flip it over.
      </p>
    </div>
  );
}