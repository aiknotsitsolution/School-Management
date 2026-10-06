// Character Certificate (C9) — a printable, A4 statement of conduct for an
// enrolled student. Deliberately client-side: it renders exactly the fields the
// signed-in user can already read from the student's profile (students:read),
// so it adds no new endpoint, no new model and no new permission to enforce.
// Output mirrors the existing printIdCard approach in components/idcard.

const esc = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
};

const formatClass = (c) => {
  if (!c) return "—";
  if (["Nursery", "LKG", "UKG"].includes(c)) return c;
  return `Class ${c}`;
};

// The standing sentence. `conduct` follows the same vocabulary the Transfer
// Certificate flow already uses, so both documents read consistently.
const conductLine = (conduct) => {
  const c = String(conduct || "Good").trim();
  const wording = {
    Excellent: "his/her conduct has been excellent",
    Good: "his/her conduct has been good",
    Satisfactory: "his/her conduct has been satisfactory",
    "Needs Improvement": "his/her conduct needs improvement",
  }[c];
  return wording || `his/her conduct has been recorded as "${c}"`;
};

export function printCharacterCertificate({ student, school, conduct = "Good", remarks = "" }) {
  if (!student) return;
  const s = student || {};
  const schoolName = school?.name || "Zipschool OS";
  const schoolAddress = school?.address || "";
  const issuedOn = fmtDate(new Date().toISOString());
  const gender = String(s.gender || "").toLowerCase();
  const pronoun = gender === "female" ? "She" : gender === "male" ? "He" : "The student";

  const details = [
    ["Admission No.", s.admissionNo || "—"],
    ["Class / Section", `${formatClass(s.class)}${s.section ? ` - ${s.section}` : ""}`],
    ["Date of Birth", s.dob ? fmtDate(s.dob) : "—"],
    ["Father's Name", s.fatherName || s.parentName || "—"],
    ["Mother's Name", s.motherName || "—"],
    ["Studying Since", s.admissionDate ? fmtDate(s.admissionDate) : "—"],
  ];

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;

  win.document.write(
    `<!doctype html><html><head><title>Character Certificate - ${esc(s.name || "")}</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      * { box-sizing: border-box; }
      body { font-family: Georgia, "Times New Roman", serif; background: #eef1f5; margin: 0; padding: 28px; color: #0f172a; }
      .sheet { background: #fff; max-width: 760px; margin: 0 auto; padding: 46px 52px 40px; border: 1px solid #dbe2ea;
               box-shadow: 0 2px 12px rgba(15,23,42,.08); position: relative; }
      .rule { height: 4px; background: #0f172a; }
      .rule.thin { height: 1px; background: #94a3b8; margin-top: 6px; }
      .school { text-align: center; margin-top: 22px; }
      .school h1 { font-size: 25px; letter-spacing: .04em; margin: 0; text-transform: uppercase; }
      .school p { font-size: 12.5px; color: #475569; margin: 6px 0 0; }
      h2 { text-align: center; font-size: 20px; letter-spacing: .22em; text-transform: uppercase;
           margin: 34px 0 6px; }
      .underline { width: 240px; height: 2px; background: #0f172a; margin: 0 auto 30px; }
      p.body { font-size: 15px; line-height: 2.05; text-align: justify; margin: 0 0 18px; }
      table { width: 100%; border-collapse: collapse; margin: 22px 0 8px; font-size: 13.5px; }
      td { border: 1px solid #d7dee7; padding: 9px 12px; }
      td.k { width: 40%; background: #f8fafc; font-weight: 700; letter-spacing: .02em; }
      .remarks { font-size: 14px; font-style: italic; color: #334155; margin-top: 14px; }
      .sign { display: flex; justify-content: space-between; margin-top: 74px; font-size: 13px; }
      .sign div { width: 44%; text-align: center; }
      .line { border-top: 1px solid #334155; padding-top: 7px; margin-top: 46px; }
      .stamp { width: 34%; text-align: center; }
      .stamp .box { border: 1px dashed #94a3b8; border-radius: 6px; height: 74px; display: flex;
                    align-items: center; justify-content: center; color: #94a3b8; font-size: 11px;
                    letter-spacing: .1em; text-transform: uppercase; }
      .foot { margin-top: 30px; font-size: 11.5px; color: #64748b; text-align: center; }
      .print-hide { margin: 0 auto 18px; max-width: 760px; text-align: right; }
      .print-hide button { font: 600 13px Inter, system-ui, sans-serif; background: #0f172a; color: #fff;
                           border: 0; border-radius: 8px; padding: 9px 18px; cursor: pointer; }
      @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border: 0; padding: 10px 4px; }
                     .print-hide { display: none !important; } }
    </style></head><body>
      <div class="print-hide"><button onclick="window.print()">Print / Save as PDF</button></div>
      <div class="sheet">
        <div class="rule"></div><div class="rule thin"></div>
        <div class="school">
          <h1>${esc(schoolName)}</h1>
          ${schoolAddress ? `<p>${esc(schoolAddress)}</p>` : ""}
        </div>
        <h2>Character Certificate</h2>
        <div class="underline"></div>

        <p class="body">
          This is to certify that <b>${esc(s.name || "—")}</b>, daughter/son of
          <b>${esc(s.fatherName || s.parentName || "—")}</b> and
          <b>${esc(s.motherName || "—")}</b>, is a bona fide student of this school,
          presently studying in <b>${esc(formatClass(s.class))}${s.section ? ` - ${esc(s.section)}` : ""}</b>
          (Admission No. <b>${esc(s.admissionNo || "—")}</b>).
        </p>
        <p class="body">
          During the period of ${pronoun.toLowerCase()} study at this school, ${conductLine(conduct)}.
          ${esc(s.name || "The student")} has been disciplined, regular in attendance and
          considerate towards teachers and fellow students.
        </p>

        <table>
          ${details
            .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
            .join("")}
        </table>

        ${remarks ? `<p class="remarks">Remarks: ${esc(remarks)}</p>` : ""}

        <div class="sign">
          <div><div class="line">Class Teacher</div></div>
          <div class="stamp"><div class="box">School Seal</div></div>
          <div><div class="line">Principal</div></div>
        </div>

        <p class="foot">Issued on ${esc(issuedOn)} · This certificate is computer generated and
          requires the school seal to be valid.</p>
      </div>
    </body></html>`,
  );
  win.document.close();
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
}
