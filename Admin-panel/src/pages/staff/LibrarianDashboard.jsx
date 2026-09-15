import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Library,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookMarked,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageIntro, Card, StatCard, Pill, Button, toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtDate, todayISO, dateOf } from "./useStaffContext";

export default function LibrarianDashboard() {
  const { user, school } = useStaffContext();
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([api.books.list(), api.issues.list()])
      .then(([b, i]) => {
        setBooks(b.status === "fulfilled" ? b.value.data || [] : []);
        setIssues(i.status === "fulfilled" ? i.value.data || [] : []);
        if (b.status === "rejected") toast(b.value?.message, "error");
        if (i.status === "rejected") toast(i.value?.message, "error");
      })
      .finally(() => setLoading(false));
  }, []);

  const today = todayISO();
  const stats = useMemo(() => {
    const issued = issues.filter((r) => r.status === "Issued");
    const overdue = issued.filter((r) => r.dueDate && dateOf(r.dueDate) < today);
    const returnedToday = issues.filter(
      (r) => r.returnDate && dateOf(r.returnDate) === today,
    );
    const copies = books.reduce((s, b) => s + Number(b.totalCopies || 0), 0);
    const available = books.reduce((s, b) => s + Number(b.availableCopies || 0), 0);
    return {
      titles: books.length, copies, available,
      issued: issued.length, overdue: overdue.length, returnedToday: returnedToday.length,
    };
  }, [books, issues, today]);

  if (loading) {
    return <p className="text-[13px] text-slate-text py-10 text-center">Loading library…</p>;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Librarian Workspace"
        title="Library Overview"
        description={`Catalogue and circulation at ${school?.name || "your school"}.`}
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/librarian/circulation")}>
              Circulation <ArrowRight size={15} />
            </Button>
            <Button variant="amber" onClick={() => navigate("/librarian/books")}>
              Manage Books <ArrowRight size={15} />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Titles" value={String(stats.titles)} sub={`${stats.copies} total copies`} accent="info" />
        <StatCard icon={Library} label="Available" value={String(stats.available)} sub="Copy on shelf" accent="success" />
        <StatCard icon={BookMarked} label="Issued" value={String(stats.issued)} sub="Currently out" accent="amber" />
        <StatCard icon={AlertTriangle} label="Overdue" value={String(stats.overdue)} sub={`${stats.returnedToday} returned today`} accent="alert" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Active Issues">
          {issues.filter((r) => r.status === "Issued").length === 0 ? (
            <p className="text-[13px] text-slate-text py-8 text-center">No books currently issued.</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                    <th className="px-5 py-2 font-semibold">Book</th>
                    <th className="px-3 py-2 font-semibold">Borrower</th>
                    <th className="px-3 py-2 font-semibold">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {issues
                    .filter((r) => r.status === "Issued")
                    .slice(0, 6)
                    .map((r) => (
                      <tr key={r._id} className="border-t border-black/[0.06]">
                        <td className="px-5 py-2.5 font-semibold text-ink">{r.bookId?.title || "—"}</td>
                        <td className="px-3 py-2.5">{r.borrowerId || "—"} <Pill tone="neutral">{r.borrowerType}</Pill></td>
                        <td className="px-3 py-2.5">
                          <Pill tone={r.dueDate && dateOf(r.dueDate) < today ? "alert" : "neutral"}>{fmtDate(r.dueDate)}</Pill>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Low Stock Alerts">
          {books.filter((b) => Number(b.availableCopies || 0) < 3).length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={34} className="mx-auto text-success mb-2" />
              <p className="text-[13px] text-slate-text">All titles have sufficient stock.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {books
                .filter((b) => Number(b.availableCopies || 0) < 3)
                .slice(0, 6)
                .map((b) => (
                  <div key={b._id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">{b.title}</p>
                      <p className="text-[12px] text-slate-text/60">{b.author}</p>
                    </div>
                    <Pill tone={Number(b.availableCopies || 0) === 0 ? "alert" : "amber"}>
                      {b.availableCopies || 0} left
                    </Pill>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}