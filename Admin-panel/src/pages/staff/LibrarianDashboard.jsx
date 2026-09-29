import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Library,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookMarked,
  BookPlus,
  BookUp,
  RotateCcw,
  Sparkles,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtDate, todayISO, dateOf } from "./useStaffContext";
import {
  HeroBanner,
  GlassStat,
  QuickActions,
  MetricGrid,
  MetricCard,
  Panel,
  Donut,
  Badge,
  ListRow,
  EmptyPanel,
  DashboardSkeleton,
  ACCENTS,
  greeting,
} from "../../components/dashboard/DashKit";

const QUICK_LINKS = [
  { to: "/librarian/books", icon: BookPlus, label: "Add a book", tone: ACCENTS.primary.icon },
  { to: "/librarian/circulation", icon: BookUp, label: "Issue a book", tone: ACCENTS.violet.icon },
  { to: "/librarian/circulation", icon: RotateCcw, label: "Record returns", tone: ACCENTS.success.icon },
  { to: "/librarian/books", icon: BookOpen, label: "Browse catalogue", tone: ACCENTS.info.icon },
];

export default function LibrarianDashboard() {
  const { school } = useStaffContext();
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
      titles: books.length,
      copies,
      available,
      issued: issued.length,
      overdue: overdue.length,
      returnedToday: returnedToday.length,
    };
  }, [books, issues, today]);

  const activeIssues = issues.filter((r) => r.status === "Issued");
  const lowStock = books.filter((b) => Number(b.availableCopies || 0) < 3);
  const shelfPct = stats.copies > 0 ? (stats.available / stats.copies) * 100 : 0;
  const dueSoon = activeIssues.filter(
    (r) => r.dueDate && dateOf(r.dueDate) >= today,
  ).length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        gradient="amber"
        eyebrow={`${greeting()} · Librarian Workspace`}
        name="Library Overview"
        title={school?.name || "Library"}
        meta="Catalogue every title, keep the shelf stocked and make sure no borrowed book is ever lost."
        dateLabel={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        quote="A library is not a luxury but one of the necessities of life."
        quoteTitle="Reading room"
        right={
          <>
            <GlassStat value={stats.titles} label="Titles" />
            <GlassStat value={stats.available} label="On shelf" />
            <GlassStat value={stats.issued} label="Issued" />
          </>
        }
      />

      <QuickActions
        title="Library Shortcuts"
        icon={Sparkles}
        columns={4}
        action={
          <button
            type="button"
            onClick={() => navigate("/librarian/circulation")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-amber-200 hover:bg-amber-50"
          >
            Circulation <ArrowRight size={14} />
          </button>
        }
        items={QUICK_LINKS}
      />

      {loading ? (
        <DashboardSkeleton metricCols={4} />
      ) : (
        <>
          <MetricGrid columns={4}>
            <MetricCard
              icon={BookOpen}
              label="Titles"
              value={stats.titles}
              sub={`${stats.copies} total copies`}
              accent="info"
            />
            <MetricCard
              icon={Library}
              label="Available"
              value={stats.available}
              sub="copies on the shelf"
              accent="success"
              progress={shelfPct}
            />
            <MetricCard
              icon={BookMarked}
              label="Issued"
              value={stats.issued}
              sub={`${dueSoon} still within due date`}
              accent="primary"
            />
            <MetricCard
              icon={AlertTriangle}
              label="Overdue"
              value={stats.overdue}
              sub={`${stats.returnedToday} returned today`}
              accent={stats.overdue > 0 ? "alert" : "success"}
            />
          </MetricGrid>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel
              title="Shelf availability"
              icon={Library}
              iconTone={ACCENTS.success.icon}
              subtitle="Copies in versus out"
              className="lg:col-span-1"
            >
              <div className="flex flex-col items-center gap-4">
                <Donut
                  value={shelfPct}
                  color="text-emerald-500"
                  label={`${Math.round(shelfPct)}%`}
                  sublabel="on shelf"
                  size={148}
                />
                <div className="grid w-full grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-center">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-text/60">
                      Available
                    </p>
                    <p className="mt-1 font-display text-[19px] font-bold text-emerald-600">
                      {stats.available}
                    </p>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-center">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-text/60">
                      Issued
                    </p>
                    <p className="mt-1 font-display text-[19px] font-bold text-indigo-600">
                      {stats.issued}
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              title="Active issues"
              icon={BookMarked}
              iconTone={ACCENTS.violet.icon}
              subtitle={`${activeIssues.length} book${activeIssues.length === 1 ? "" : "s"} currently out`}
              className="lg:col-span-2"
              action={
                <button
                  type="button"
                  onClick={() => navigate("/librarian/circulation")}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-info transition-colors hover:text-blue-700"
                >
                  Circulation <ArrowRight size={14} />
                </button>
              }
            >
              {activeIssues.length === 0 ? (
                <EmptyPanel
                  icon={BookOpen}
                  iconTone={ACCENTS.success.icon}
                  title="No books currently issued"
                  text="Every issued book has been returned. Issue a new one from circulation."
                  action={
                    <button
                      type="button"
                      onClick={() => navigate("/librarian/circulation")}
                      className="rounded-xl bg-info px-3.5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      Issue a book
                    </button>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {activeIssues.slice(0, 6).map((r) => {
                    const isOverdue = r.dueDate && dateOf(r.dueDate) < today;
                    return (
                      <ListRow
                        key={r._id}
                        icon={BookOpen}
                        iconTone={isOverdue ? ACCENTS.alert.icon : ACCENTS.violet.icon}
                        title={r.bookId?.title || "—"}
                        meta={`${r.borrowerId || "—"} · due ${fmtDate(r.dueDate)}`}
                        trailing={
                          <>
                            <Badge tone={r.borrowerType === "Staff" ? "info" : "neutral"}>
                              {r.borrowerType || "Student"}
                            </Badge>
                            {isOverdue ? <Badge tone="alert">Overdue</Badge> : null}
                          </>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Low stock alerts"
              icon={AlertTriangle}
              iconTone={ACCENTS.warn.icon}
              subtitle={
                lowStock.length
                  ? `${lowStock.length} title${lowStock.length === 1 ? "" : "s"} with fewer than 3 copies left`
                  : "Stock levels are healthy"
              }
              action={
                <button
                  type="button"
                  onClick={() => navigate("/librarian/books")}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-info transition-colors hover:text-blue-700"
                >
                  Manage books <ArrowRight size={14} />
                </button>
              }
            >
              {lowStock.length === 0 ? (
                <EmptyPanel
                  icon={CheckCircle2}
                  iconTone={ACCENTS.success.icon}
                  title="All titles have sufficient stock"
                  text="Nothing is running low. Add new titles whenever your budget allows."
                />
              ) : (
                <div className="space-y-2.5">
                  {lowStock.slice(0, 6).map((b) => (
                    <ListRow
                      key={b._id}
                      icon={BookOpen}
                      iconTone={
                        Number(b.availableCopies || 0) === 0
                          ? ACCENTS.alert.icon
                          : ACCENTS.warn.icon
                      }
                      title={b.title}
                      description={b.author}
                      trailing={
                        <Badge
                          tone={Number(b.availableCopies || 0) === 0 ? "alert" : "warning"}
                        >
                          {b.availableCopies || 0} left
                        </Badge>
                      }
                    />
                  ))}
                </div>
              )}
            </Panel>

            <Panel
              title="Today's circulation"
              icon={Clock}
              iconTone={ACCENTS.info.icon}
              subtitle="Returns processed today"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-text/60">
                    Returned today
                  </p>
                  <p className="mt-1.5 font-display text-[28px] font-bold leading-none text-emerald-600">
                    {stats.returnedToday}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-text/60">
                    Still with readers
                  </p>
                  <p className="mt-1.5 font-display text-[28px] font-bold leading-none text-indigo-600">
                    {stats.issued}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4">
                <p className="text-[12.5px] font-bold text-ink">Reading room tip</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-text/70">
                  Remind borrowers a day before the due date — a quick call keeps returns
                  on time and the shelf full.
                </p>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
