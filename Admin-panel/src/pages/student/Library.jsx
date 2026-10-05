import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Library as LibraryIcon, CalendarClock } from "lucide-react";
import { PageIntro, Card, Pill } from "../../components/UI";
import PageArtwork from "../../components/PageArtwork";
import StudentMaterialsPanel from "../../components/library/StudentMaterialsPanel";
import { api } from "../../lib/api";
import { fmtDate, dateOf } from "./useStudentContext";

// One Library for students: issued physical books + the class shelf of study
// materials/e-books (with the in-app reader). Tabs are deep-linkable via
// /student/library?tab=materials.
export default function Library() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() =>
    ["issued", "materials"].includes(searchParams.get("tab")) ? searchParams.get("tab") : "issued"
  );

  const switchTab = (key) => {
    setTab(key);
    setSearchParams(key === "issued" ? {} : { tab: key }, { replace: true });
  };

  useEffect(() => {
    setLoading(true);
    api.issues
      .list()
      .then(({ data }) => setIssues(data || []))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, []);

  const today = dateOf(new Date());
  const decorated = useMemo(
    () => issues.map((i) => ({ ...i, overdue: i.dueDate && !returned(i) && dateOf(i.dueDate) < today })),
    [issues, today],
  );
  const active = decorated.filter((i) => !i.returnDate);
  const history = decorated.filter((i) => i.returnDate);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Library"
        title="My Library" art="library"
        description="Issued books, e-books and study materials shared with your class."
      />

      <div className="flex gap-1.5">
        {[
          { key: "issued", label: "Issued Books" },
          { key: "materials", label: "Study Materials" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border transition-colors ${
              tab === t.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-text border-slate-300 hover:border-ink/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "materials" ? (
        <StudentMaterialsPanel />
      ) : (
        <>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="p-1">
            <p className="font-display text-3xl font-bold text-ink">{active.length}</p>
            <p className="text-[11px] text-slate-text/80 mt-1">Books with you</p>
          </div>
        </Card>
        <Card><p className="font-display text-xl font-bold text-alert">{active.filter((i) => i.overdue).length}</p><p className="text-[11px] text-slate-text/80 mt-1">Overdue</p></Card>
      </div>

      <Card title={`Currently Issued (${active.length})`}>
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading…</p>
        ) : active.length === 0 ? (
          <div className="py-10 text-center">
            <PageArtwork name="library" size={64} className="mx-auto mb-4" />
            <p className="text-[15px] font-semibold text-ink">No books issued</p>
            <p className="text-[13px] text-slate-text/80 mt-1">Books you borrow from the library will show here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {active.map((i) => (
              <div key={i._id} className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-200 last:border-0">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{i.bookTitle || i.bookId?.title || "Book"}</p>
                  <p className="text-[12px] text-slate-text/80 mt-0.5">{i.bookId?.author || i.bookTitle || ""}{i.bookId?.isbn ? ` · ${i.bookId.isbn}` : ""}</p>
                  <div className="flex items-center gap-4 mt-1.5 text-[11.5px] text-slate-text/80">
                    <span>Issued {fmtDate(i.issueDate || i.createdAt)}</span>
                    <span className="flex items-center gap-1"><CalendarClock size={11} />Due {fmtDate(i.dueDate)}</span>
                  </div>
                </div>
                {i.overdue ? <Pill tone="alert">Overdue</Pill> : <Pill tone="neutral">Issued</Pill>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Returned (${history.length})`}>
        {history.length === 0 ? (
          <p className="text-[13px] text-slate-text py-4 text-center">No return history.</p>
        ) : (
          <div className="schema space-y-2.5">
            {history.map((i) => (
              <div key={i._id} className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-200 last:border-0">
                <p className="text-[13.5px] font-medium text-ink">{i.bookTitle || i.bookId?.title || "Book"}</p>
                <div className="text-right shrink-0 text-[12px] text-slate-text/80">
                  <p>Returned {fmtDate(i.returnDate)}</p>
                  {i.fine && <p className="text-alert">Fine {i.fine}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="text-[12.5px] text-slate-text/80 flex items-center gap-2">
          <LibraryIcon size={14} className="text-slate-text/50" />
          Return books on the due date to avoid fines. For new issues or renewals, visit the school library.
        </p>
      </Card>
        </>
      )}
    </div>
  );
}

function returned(i) {
  return Boolean(i.returnDate);
}
