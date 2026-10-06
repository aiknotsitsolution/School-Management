import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Download, FileBarChart, FileText, Printer } from "lucide-react";
import { PageIntro, Card, Button, Pill, toast } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
// One shared sheet renders the card for students and staff alike, so the two
// portals (and the server PDF) can never show a different report card.
import ReportCardSheet from "../../components/reportcard/ReportCardSheet";
import { fmtDate } from "../../components/reportcard/reportCardMeta";
import { api } from "../../lib/api";
import { computeGrade } from "../../lib/grading";
import { sessionLabel } from "../../lib/session";
import { selectSchool, selectUser } from "../../store/selectors";

/**
 * The staff picker saves co-scholastic rows against a TERM label ("Term 1"),
 * while marks snapshot the full exam name ("Term 1 — Unit Test"). Resolve the
 * label from the exam record first and fall back to the name itself.
 */
function termLabelFor(examName, meta) {
  if (meta?.term) return meta.term;
  const name = String(examName || "");
  const match = /term\s*([12])/i.exec(name);
  if (match) return `Term ${match[1]}`;
  if (/final/i.test(name)) return "Final";
  return name;
}

export default function Results() {
  const school = useSelector(selectSchool);
  const user = useSelector(selectUser);
  // The opened term lives in the URL, so refresh and browser-back behave the
  // way a link to a document should.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTerm = searchParams.get("exam") || "";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [profile, setProfile] = useState(null);
  const [exams, setExams] = useState([]);
  const [card, setCard] = useState({ term: "", loading: false, data: null, error: "" });
  const [cce, setCce] = useState({ term: "", data: null });
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Term list + identity + exam calendar in one round trip. Any single miss
  // still renders the list: the report card payload is the only hard need.
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.marks.reportCard(),
      api.students.me(),
      api.exams.list("limit=500"),
    ]).then((settled) => {
      if (!alive) return;
      const dataOf = (i) =>
        settled[i].status === "fulfilled" ? settled[i].value?.data ?? null : null;
      setSummary(dataOf(0));
      setProfile(dataOf(1));
      setExams(dataOf(2) || []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** examName -> exam record (term label, date, session) for the list rows. */
  const examMeta = useMemo(() => {
    const map = new Map();
    (exams || []).forEach((exam) => {
      if (exam?.examName && !map.has(exam.examName)) map.set(exam.examName, exam);
    });
    return map;
  }, [exams]);

  /** Published terms, newest first, each with its own totals for the row. */
  const terms = useMemo(() => {
    const groups = new Map();
    (summary?.subjects || []).forEach((row) => {
      const key = row.examName || "All";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return [...groups.entries()]
      .map(([examName, subjects]) => {
        const obtained = subjects.reduce((sum, m) => sum + (Number(m.marksObtained) || 0), 0);
        const max = subjects.reduce((sum, m) => sum + (Number(m.maxMarks) || 0), 0);
        const meta = examMeta.get(examName) || null;
        return {
          examName,
          count: subjects.length,
          obtained,
          max,
          pct: max ? Math.round((obtained / max) * 100) : 0,
          grade: max ? computeGrade(obtained, max) : "—",
          date: meta?.date || "",
          termLabel: termLabelFor(examName, meta),
        };
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [summary, examMeta]);

  // Opening a term fetches exactly that term's report card (and its
  // co-scholastic row). Students are pinned to their own marks server-side, so
  // the query only ever carries the term. Nothing is cleared synchronously:
  // `card.term !== activeTerm` / `cce.term !== activeTerm` hide stale rows at
  // render time instead, so there is no flash and no extra render pass.
  useEffect(() => {
    if (!activeTerm) return;
    let alive = true;

    api.marks
      .reportCard(`examName=${encodeURIComponent(activeTerm)}`)
      .then(({ data }) => {
        if (alive) setCard({ term: activeTerm, loading: false, data, error: "" });
      })
      .catch((requestError) => {
        if (alive)
          setCard({
            term: activeTerm,
            loading: false,
            data: null,
            error: requestError.message || "Could not load this report card",
          });
      });

    const termLabel = termLabelFor(activeTerm, examMeta.get(activeTerm) || null);
    api.cce
      .getCoScholastic(
        `term=${encodeURIComponent(termLabel)}&session=${encodeURIComponent(
          summary?.session || sessionLabel(school) || "",
        )}`,
      )
      .then(({ data }) => {
        if (alive) setCce({ term: activeTerm, data: data || null });
      })
      .catch(() => {
        if (alive) setCce({ term: activeTerm, data: null });
      });

    return () => {
      alive = false;
    };
  }, [activeTerm, examMeta, summary, school]);

  /** Identity block for the sheet — profile first, report payload as backup. */
  const cardStudent = useMemo(
    () => ({
      name: profile?.name || user?.name || "",
      admissionNo: profile?.admissionNo || card.data?.studentId || "",
      class: profile?.class || card.data?.class || "",
      section: profile?.section || card.data?.section || "",
      roll: profile?.rollNo || "",
      fatherName: profile?.parentName || "",
      dob: profile?.dob || null,
      avatar: profile?.photoUrl || "",
    }),
    [profile, user, card.data],
  );

  const openTerm = (examName) => setSearchParams({ exam: examName });
  const backToTerms = () => setSearchParams({});

  const downloadPdf = async () => {
    if (!activeTerm || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await api.marks.downloadReportCardPdf(
        `examName=${encodeURIComponent(activeTerm)}`,
      );
      toast("Report card downloaded");
    } catch (e) {
      toast(e.message || "Download failed", "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Academics" title="My Results" art="chart" description="Your report cards for this session." />
        <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />)}</div>
      </div>
    );
  }

  // ── Opened term: the report card itself ──────────────────────────────────
  if (activeTerm) {
    return (
      <div className="space-y-6">
        <div className="no-print">
          <PageIntro
            eyebrow="Academics"
            title="Report Card"
            art="exams"
            description={activeTerm}
            right={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={backToTerms}>
                  <ArrowLeft size={15} /> All terms
                </Button>
                <Button variant="outline" onClick={downloadPdf} disabled={downloadingPdf}>
                  <Download size={15} /> {downloadingPdf ? "Preparing..." : "Download PDF"}
                </Button>
                <Button variant="primary" onClick={() => window.print()}>
                  <Printer size={15} /> Print
                </Button>
              </div>
            }
          />
        </div>

        {card.loading || card.term !== activeTerm ? (
          <div className="mx-auto max-w-3xl h-[520px] bg-white rounded-2xl border border-slate-200 animate-pulse" />
        ) : card.error ? (
          <Card>
            <div className="py-10 text-center">
              <p className="text-[15px] font-semibold text-ink">Report card unavailable</p>
              <p className="text-[13px] text-slate-text/70 mt-1">{card.error}</p>
            </div>
          </Card>
        ) : (
          <Card bodyClassName="p-0">
            <ReportCardSheet
              school={school}
              student={cardStudent}
              termLabel={activeTerm}
              report={card.data}
              cce={cce.term === activeTerm ? cce.data : null}
            />
          </Card>
        )}
      </div>
    );
  }

  // ── Term list: pick a result to open ─────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Academics"
        title="My Results"
        art="chart"
        description="Pick a term to open, print or download its report card."
      />

      {terms.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <PageArtwork name="chart" size={64} className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-ink">No results published</p>
            <p className="text-[13px] text-slate-text/70 mt-1">Your report cards will appear here once teachers publish them.</p>
          </div>
        </Card>
      ) : (
        <Card
          title="Published results"
          subtitle={summary?.session ? `Session ${summary.session}` : "Report cards for your class"}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-slate-100">
            {terms.map((t) => (
              <li key={t.examName}>
                <button
                  type="button"
                  onClick={() => openTerm(t.examName)}
                  className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-dark">
                    <FileText size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-ink">{t.examName}</span>
                      {t.termLabel && t.termLabel !== t.examName && (
                        <Pill tone="primary">{t.termLabel}</Pill>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-slate-text/70">
                      {t.count} {t.count === 1 ? "subject" : "subjects"} · {t.obtained} / {t.max} marks
                      {t.date ? ` · ${fmtDate(t.date)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-xl font-bold text-ink">{t.pct}%</span>
                    <Pill tone={t.pct >= 40 ? "success" : "alert"}>{t.grade}</Pill>
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-slate-text/40 transition group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <FileBarChart size={14} className="text-slate-text/50" />
          Results are published by teachers for your class. Contact the school office for any discrepancy.
        </p>
      </Card>
    </div>
  );
}
