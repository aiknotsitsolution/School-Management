import { useEffect, useMemo, useState } from "react";
import { BookOpen, ArrowDownToLine, ArrowLeft, Search } from "lucide-react";
import {
  PageIntro,
  Card,
  Input,
  Select,
  Button,
  Pill,
  StatCard,
  toast,
} from "../../components/UI";
import { api } from "../../lib/api";
import useStaffContext, { fmtMoney, fmtDate, todayISO, dateOf } from "./useStaffContext";

const emptyDraft = { bookId: "", borrowerId: "", borrowerType: "student", dueDate: "" };

export default function Circulation() {
  const [issues, setIssues] = useState([]);
  const [books, setBooks] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentsSearch, setStudentsSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("Issued");
  const [showIssue, setShowIssue] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  const refresh = () => {
    setLoading(true);
    Promise.allSettled([api.issues.list(), api.books.list()])
      .then(([i, b]) => {
        setIssues(i.status === "fulfilled" ? i.value.data || [] : []);
        setBooks(b.status === "fulfilled" ? b.value.data || [] : []);
        if (i.status === "rejected") toast(i.value?.message, "error");
        if (b.status === "rejected") toast(b.value?.message, "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const today = todayISO();
  const bookById = useMemo(() => {
    const m = {};
    (books || []).forEach((b) => { m[b._id] = b; });
    return m;
  }, [books]);

  const issued = (issues || []).filter((r) => r.status === "Issued");
  const returned = (issues || []).filter((r) => r.status === "Returned");
  const availableBooks = (books || []).filter((b) => Number(b.availableCopies || 0) > 0);

  const handleIssue = async (e) => {
    e.preventDefault();
    const { bookId, borrowerId, borrowerType, dueDate } = draft;
    if (!bookId || !borrowerId || !dueDate) {
      toast("Book, borrower and due date are required", "error");
      return;
    }
    try {
      await api.issues.issue({ bookId, borrowerId, borrowerType, dueDate });
      toast("Book issued", "success");
      setShowIssue(false);
      setDraft(emptyDraft);
      refresh();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleReturn = async (id) => {
    try {
      await api.issues.return(id);
      const rec = issues.find((r) => r._id === id);
      if (rec?.fine) toast(`Returned · Fine ${fmtMoney(rec.fine)}`, "success");
      else toast("Book returned", "success");
      refresh();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const matchedStudents = useMemo(() => {
    const q = studentsSearch.toLowerCase();
    return (students || []).filter(
      (s) =>
        !q ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.admissionNo || "").toLowerCase().includes(q),
    );
  }, [students, studentsSearch]);

  const pickStudent = (admissionNo) => {
    setDraft((d) => ({ ...d, borrowerId: admissionNo }));
    setStudentsSearch("");
    setStudents([]);
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Librarian Workspace"
        title="Circulation"
        description="Issue, return and track borrowed books."
        right={
          <Button variant="amber" onClick={() => setShowIssue((v) => !v)}>
            <BookOpen size={15} /> Issue Book
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={null} label="Currently Issued" value={String(issued.length)} accent="info" />
        <StatCard icon={null} label="Returned" value={String(returned.length)} accent="success" />
        <StatCard icon={null} label="Overdue" value={String(issued.filter((r) => r.dueDate && dateOf(r.dueDate) < today).length)} accent="alert" />
        <StatCard icon={null} label="Available Titles" value={String(availableBooks.length)} accent="amber" />
      </div>

      {showIssue && (
        <Card title="Issue a Book" action={<ArrowLeft size={15} className="text-slate-text/40" />}>
          <form onSubmit={handleIssue} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[12px] font-semibold text-slate-text/70">Book</label>
              <Select
                value={draft.bookId}
                onChange={(e) => setDraft({ ...draft, bookId: e.target.value })}
                className="w-full mt-1"
              >
                <option value="">Select available book…</option>
                {availableBooks.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.title} ({b.availableCopies} left)
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-slate-text/70">Borrower (Admission/Staff ID)</label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-text/40" />
                <Input
                  value={studentsSearch || draft.borrowerId}
                  onChange={(e) => {
                    setStudentsSearch(e.target.value);
                    setDraft((d) => ({ ...d, borrowerId: e.target.value }));
                    if (e.target.value.trim()) {
                      api.students.list(`q=${encodeURIComponent(e.target.value)}&limit=10`).then(({ data }) => setStudents(data || [])).catch(() => {});
                    } else {
                      setStudents([]);
                    }
                  }}
                  placeholder="Search student or type ID"
                  className="pl-8 w-full"
                />
                {draft.borrowerId && !studentsSearch && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-success">selected</span>
                )}
              </div>
              {students.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-w-sm bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden">
                  {matchedStudents.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => pickStudent(s.admissionNo)}
                      className="w-full text-left px-3 py-2 hover:bg-paper text-[13px]"
                    >
                      <span className="font-semibold text-ink">{s.name}</span>
                      <span className="text-slate-text/60 ml-2">{s.admissionNo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[12px] font-semibold text-slate-text/70">Borrower Type</label>
              <Select
                value={draft.borrowerType}
                onChange={(e) => setDraft({ ...draft, borrowerType: e.target.value })}
                className="w-full mt-1"
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </Select>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-slate-text/70">Due Date</label>
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                className="w-full mt-1"
                required
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowIssue(false); setDraft(emptyDraft); }}>Cancel</Button>
              <Button type="submit"><ArrowDownToLine size={15} /> Issue Book</Button>
            </div>
          </form>
        </Card>
      )}

      <Card
        title="Issue Records"
        action={
          <div className="flex gap-2">
            {["Issued", "Returned"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusTab(s)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                  statusTab === s ? "bg-ink text-white" : "bg-paper text-slate-text"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <p className="text-[13px] text-slate-text py-10 text-center">Loading circulation…</p>
        ) : (statusTab === "Issued" ? issued : returned).length === 0 ? (
          <p className="text-[13px] text-slate-text py-10 text-center">No {statusTab.toLowerCase()} records.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-slate-text/50 uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Book</th>
                  <th className="px-3 py-2 font-semibold">Borrower</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Issued</th>
                  <th className="px-3 py-2 font-semibold">Due</th>
                  <th className="px-3 py-2 font-semibold">Fine</th>
                  <th className="px-3 py-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {(statusTab === "Issued" ? issued : returned).map((r) => {
                  const overdue = r.status === "Issued" && r.dueDate && dateOf(r.dueDate) < today;
                  return (
                    <tr key={r._id} className="border-t border-black/[0.06] hover:bg-paper/60">
                      <td className="px-5 py-2.5">
                        <p className="font-semibold text-ink">{r.bookId?.title || "—"}</p>
                        <p className="text-[12px] text-slate-text/60">{bookById[r.bookId?._id || r.bookId]?.author || ""}</p>
                      </td>
                      <td className="px-3 py-2.5">{r.borrowerId || "—"}</td>
                      <td className="px-3 py-2.5"><Pill tone="neutral">{r.borrowerType}</Pill></td>
                      <td className="px-3 py-2.5 text-slate-text/80">{fmtDate(r.issueDate)}</td>
                      <td className="px-3 py-2.5">
                        <Pill tone={overdue ? "alert" : "neutral"}>{fmtDate(r.dueDate)}</Pill>
                      </td>
                      <td className="px-3 py-2.5">{r.fine ? fmtMoney(r.fine) : "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        {r.status === "Issued" ? (
                          <Button variant="outline" className="py-1.5 px-3" onClick={() => handleReturn(r._id)}>
                            Return
                          </Button>
                        ) : (
                          <Pill tone="success">Returned</Pill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}